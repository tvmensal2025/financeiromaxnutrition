const MAX_BODY_BYTES = 64 * 1024;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export type RpcName =
  | "registrar_update_telegram" | "reivindicar_trabalho_telegram"
  | "concluir_trabalho_telegram" | "reivindicar_saida_telegram"
  | "renovar_trabalho_telegram"
  | "concluir_saida_telegram" | "reagendar_saida_telegram";

export interface TelegramDependencies {
  webhookSecret?: string;
  workerSecret?: string;
  callRpc: (name: RpcName, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  sendMessage: (chatId: number, text: string) => Promise<number>;
}

export class RpcError extends Error {
  readonly code: string | undefined;
  readonly identifier: string | undefined;
  constructor(code: string | undefined, identifier?: string) {
    super("Telegram RPC failed");
    this.code = code;
    this.identifier = identifier;
  }
}

function json(status: number, value: Record<string, unknown>): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  } });
}

async function secretMatches(actual: string | null, expected: string | undefined): Promise<boolean> {
  if (!expected || !SECRET_PATTERN.test(expected)) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual ?? "")),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return actual !== null && mismatch === 0;
}

async function readBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

async function drainOne(deps: TelegramDependencies): Promise<boolean> {
  const item = await deps.callRpc("reivindicar_saida_telegram", {});
  if (typeof item.id !== "string") return false;
  if (typeof item.lease_token !== "string" || typeof item.chat_id !== "string" ||
      !/^[1-9][0-9]{0,15}$/.test(item.chat_id) || typeof item.texto !== "string" ||
      item.texto.length < 1 || item.texto.length > 4096) throw new Error("Invalid outbox item");
  const chatId = Number(item.chat_id);
  if (!positiveSafeInteger(chatId)) throw new Error("Invalid outbox chat");
  try {
    const messageId = await deps.sendMessage(chatId, item.texto);
    if (!positiveSafeInteger(messageId)) throw new Error("Invalid Telegram acknowledgement");
    await deps.callRpc("concluir_saida_telegram", {
      p_id: item.id, p_lease_token: item.lease_token, p_message_id: messageId,
    });
  } catch {
    // A timeout may mean Telegram accepted the message. Retrying can duplicate
    // the chat response; the durable receipt always remains in SQL.
    await deps.callRpc("reagendar_saida_telegram", { p_id: item.id, p_lease_token: item.lease_token });
  }
  return true;
}

export async function handleTelegramRequest(request: Request, deps: TelegramDependencies): Promise<Response> {
  if (request.method !== "POST") return json(405, { ok: false });
  const path = new URL(request.url).pathname;
  const workerRoute = /\/(worker\/claim|worker\/complete|worker\/renew|drain)$/.exec(path)?.[1];
  const header = workerRoute ? "x-helena-telegram-worker-secret" : "x-telegram-bot-api-secret-token";
  const secret = workerRoute ? deps.workerSecret : deps.webhookSecret;
  if (!secret || !SECRET_PATTERN.test(secret)) return json(503, { ok: false });
  if (!await secretMatches(request.headers.get(header), secret)) return json(401, { ok: false });

  if (workerRoute === "worker/claim") {
    try {
      const job = await deps.callRpc("reivindicar_trabalho_telegram", {});
      return json(200, { ok: true, job: Object.keys(job).length ? job : null });
    } catch { return json(503, { ok: false }); }
  }
  if (workerRoute === "worker/complete" || workerRoute === "worker/renew") {
    let body: unknown;
    try { body = await readBody(request); }
    catch (error) { return json(error instanceof RangeError ? 413 : 400, { ok: false }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { ok: false });
    const b = body as Record<string, unknown>;
    if (typeof b.update_id !== "string" || !/^[1-9][0-9]{0,15}$/.test(b.update_id) ||
        !positiveSafeInteger(Number(b.update_id)) || typeof b.lease_token !== "string" ||
        (workerRoute === "worker/complete" && b.resposta !== null && b.resposta !== undefined && typeof b.resposta !== "string") ||
        (workerRoute === "worker/complete" && b.proposta !== null && b.proposta !== undefined &&
          (typeof b.proposta !== "object" || Array.isArray(b.proposta)))) return json(400, { ok: false });
    try {
      await deps.callRpc(workerRoute === "worker/renew" ?
        "renovar_trabalho_telegram" : "concluir_trabalho_telegram", workerRoute === "worker/renew" ?
        { p_update_id: b.update_id, p_lease_token: b.lease_token } :
        { p_update_id: b.update_id, p_lease_token: b.lease_token,
          p_resposta: b.resposta ?? null, p_proposta: b.proposta ?? null });
      return json(200, { ok: true });
    } catch { return json(503, { ok: false }); }
  }
  if (workerRoute === "drain") {
    try {
      let count = 0;
      while (count < 10 && await drainOne(deps)) count++;
      return json(200, { ok: true, processed: count });
    } catch { return json(503, { ok: false }); }
  }

  let update: unknown;
  try { update = await readBody(request); }
  catch (error) { return json(error instanceof RangeError ? 413 : 400, { ok: false }); }
  if (!update || typeof update !== "object" || Array.isArray(update) ||
      !positiveSafeInteger((update as Record<string, unknown>).update_id)) return json(400, { ok: false });
  try {
    const receipt = await deps.callRpc("registrar_update_telegram", { p_update: update });
    if (receipt.update_id !== String((update as Record<string, unknown>).update_id))
      return json(503, { ok: false });
  } catch { return json(503, { ok: false }); }
  // The inbox and any receipt/outbox entry have committed before ACK.
  // Delivery is best effort here and can be retried through /drain.
  try { await drainOne(deps); } catch { /* durable outbox remains */ }
  return json(200, { ok: true });
}
