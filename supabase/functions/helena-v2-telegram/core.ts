const MAX_BODY_BYTES = 64 * 1024;
const MAX_TEXT_CHARACTERS = 10_000;
const LINK_COMMAND = /^\/vincular ([0-9a-fA-F]{48})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcName = "vincular_telegram" | "receber_pedido_telegram";
type RpcResult = Record<string, unknown>;

export interface WebhookDependencies {
  webhookSecret: string | undefined;
  mode?: "webhook" | "hermes-poller";
  callRpc: (name: RpcName, args: Record<string, unknown>) => Promise<RpcResult>;
  sendMessage?: (chatId: number, text: string) => Promise<void>;
  reportPending?: (updateId: number, kind: "link" | "order") => void;
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

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function secretMatches(actual: string | null, expected: string): Promise<boolean> {
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

async function readLimitedBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

type TelegramMessage = {
  updateId: number;
  messageId: number;
  chatId: number;
  userId: number;
  text: string;
};

function parseMessage(update: unknown, maxTextCharacters: number): TelegramMessage | "unsupported" | "invalid" {
  if (typeof update !== "object" || update === null || Array.isArray(update)) return "invalid";
  const value = update as Record<string, unknown>;
  if (!("message" in value)) return "unsupported";
  if (typeof value.message !== "object" || value.message === null || Array.isArray(value.message)) return "invalid";
  const message = value.message as Record<string, unknown>;
  const chat = message.chat as Record<string, unknown> | null;
  const from = message.from as Record<string, unknown> | null;
  if (!positiveSafeInteger(value.update_id) || !positiveSafeInteger(message.message_id) ||
      !chat || typeof chat !== "object" || Array.isArray(chat) || !positiveSafeInteger(chat.id) ||
      !from || typeof from !== "object" || Array.isArray(from) || !positiveSafeInteger(from.id) ||
      chat.type !== "private" || chat.id !== from.id || from.is_bot !== false ||
      typeof message.text !== "string" || Array.from(message.text).length > maxTextCharacters ||
      !message.text.trim() || message.text.includes("\u0000")) return "invalid";
  return {
    updateId: value.update_id,
    messageId: message.message_id,
    chatId: chat.id,
    userId: from.id,
    text: message.text,
  };
}

function isReceipt(value: RpcResult): value is RpcResult & { request_id: string; estado: "RECEBIDO"; novo_evento: boolean } {
  return typeof value.request_id === "string" && UUID.test(value.request_id) &&
    value.estado === "RECEBIDO" && typeof value.novo_evento === "boolean";
}

export async function handleTelegramWebhook(request: Request, deps: WebhookDependencies): Promise<Response> {
  if (request.method !== "POST") return response(405, { ok: false });
  if (!deps.webhookSecret || !/^[A-Za-z0-9_-]{32,256}$/.test(deps.webhookSecret)) {
    return response(503, { ok: false });
  }
  if (!await secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), deps.webhookSecret)) {
    return response(401, { ok: false });
  }

  let raw: string | null;
  try {
    raw = await readLimitedBody(request);
  } catch {
    return response(400, { ok: false });
  }
  if (raw === null) return response(413, { ok: false });

  let update: unknown;
  try {
    update = JSON.parse(raw);
  } catch {
    return response(400, { ok: false });
  }
  const broker = deps.mode === "hermes-poller";
  const message = parseMessage(update, broker ? MAX_TEXT_CHARACTERS + 8 : MAX_TEXT_CHARACTERS);
  if (message === "unsupported") return response(200, { ok: true });
  if (message === "invalid") return response(200, { ok: true });

  const linking = message.text.startsWith("/vincular");
  const code = LINK_COMMAND.exec(message.text)?.[1]?.toLowerCase();
  if (linking && !code) return response(200, broker ?
    { ok: true, respostas: ["Não foi possível confirmar o vínculo. Gere um novo código no site."] } :
    { ok: true });
  const order = broker ? /^\/pedido[ \t]+([\s\S]+)$/.exec(message.text)?.[1] : message.text;
  if (broker && !linking && !message.text.startsWith("/pedido")) {
    return response(200, { ok: true, respostas: [] });
  }
  if (broker && !linking && (!order || !order.trim() || Array.from(order).length > MAX_TEXT_CHARACTERS)) {
    return response(200, { ok: true, respostas: ["Use /pedido seguido do texto do pedido."] });
  }

  let reply: string;
  try {
    if (linking) {
      const linked = await deps.callRpc("vincular_telegram", {
        p_codigo: code,
        p_chat_id: message.chatId,
        p_usuario_id: message.userId,
      });
      if (linked.vinculado !== true) return response(503, { ok: false });
      reply = "Vínculo confirmado. Confira o status no site.";
    } else {
      const receipt = await deps.callRpc("receber_pedido_telegram", {
        p_chat_id: message.chatId,
        p_usuario_id: message.userId,
        p_update_id: message.updateId,
        p_mensagem_id: message.messageId,
        p_texto: order,
        p_request_id: null,
      });
      if (!isReceipt(receipt)) return response(503, { ok: false });
      if (!broker && !receipt.novo_evento) return response(200, { ok: true });
      reply = `Pedido recebido. Estado: RECEBIDO. Protocolo: ${receipt.request_id}. A Helena ainda vai analisar o pedido.`;
    }
  } catch (error) {
    if (error instanceof RpcError && (
      (error.code === "42501" &&
        (error.identifier === "PAREAMENTO_NAO_VALIDO" || error.identifier === "TELEGRAM_NAO_VINCULADO")) ||
      (error.code === "23505" &&
        (error.identifier === "TELEGRAM_UPDATE_DIVERGENTE" || error.identifier === "ENTRADA_EVENTO_DIVERGENTE"))
    )) {
      return response(200, broker ?
        { ok: true, respostas: ["Não foi possível confirmar. Confira o vínculo e o pedido no site."] } :
        { ok: true });
    }
    return response(503, { ok: false });
  }

  if (broker) return response(200, { ok: true, respostas: [reply] });

  try {
    if (!deps.sendMessage) return response(503, { ok: false });
    await deps.sendMessage(message.chatId, reply);
  } catch {
    deps.reportPending?.(message.updateId, linking ? "link" : "order");
    return response(200, { ok: true, delivery_pending: true });
  }
  return response(200, { ok: true });
}
