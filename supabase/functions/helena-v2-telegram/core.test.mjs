import test from "node:test";
import assert from "node:assert/strict";
import { handleTelegramRequest } from "./core.ts";
import { createRpcClient, createTelegramSender } from "./transport.ts";

const WEBHOOK_SECRET = "synthetic_webhook_secret_32_characters_long";
const WORKER_SECRET = "synthetic_worker_secret_32_characters_long";
const UPDATE = { update_id: 101, message: { message_id: 102,
  chat: { id: 103, type: "private" }, from: { id: 103, is_bot: false }, text: "/pedido teste" } };

function request(path = "", body = UPDATE, secret = WEBHOOK_SECRET, header = "x-telegram-bot-api-secret-token") {
  return new Request(`https://example.test/helena-v2-telegram${path}`, { method: "POST",
    headers: { [header]: secret }, body: JSON.stringify(body) });
}

function harness() {
  const calls = [];
  const sent = [];
  const inbox = new Map();
  const outbox = [];
  const jobs = [];
  let failPersist = false;
  let failSend = false;
  const deps = {
    webhookSecret: WEBHOOK_SECRET, workerSecret: WORKER_SECRET,
    callRpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "registrar_update_telegram") {
        if (failPersist) throw new Error("database unavailable");
        const value = args.p_update;
        const old = inbox.get(value.update_id);
        if (old && JSON.stringify(old) !== JSON.stringify(value)) throw new Error("divergent replay");
        if (!old) {
          inbox.set(value.update_id, value);
          outbox.push({ id: "12345678-1234-4123-8123-123456789abc", lease_token: "lease-a",
            chat_id: "103", texto: "Pedido recebido", delivered: false, available: true });
          jobs.push({ update_id: "101", lease_token: "lease-b", tipo: "PEDIDO", update: value });
        }
        return { update_id: String(value.update_id), tipo: "PEDIDO", novo: !old };
      }
      if (name === "reivindicar_saida_telegram") {
        const item = outbox.find((x) => x.available && !x.delivered);
        if (!item) return {};
        item.available = false;
        return { id: item.id, lease_token: item.lease_token, chat_id: item.chat_id, texto: item.texto };
      }
      if (name === "concluir_saida_telegram") {
        const item = outbox.find((x) => x.id === args.p_id);
        item.delivered = true;
        return { ok: true };
      }
      if (name === "reagendar_saida_telegram") {
        const item = outbox.find((x) => x.id === args.p_id);
        item.available = true;
        return { ok: true };
      }
      if (name === "reivindicar_trabalho_telegram") return jobs.shift() ?? {};
      if (name === "renovar_trabalho_telegram") return { ok: true };
      if (name === "concluir_trabalho_telegram") {
        if (!inbox.has(Number(args.p_update_id))) throw new Error("unknown update");
        outbox.push({ id: "12345678-1234-4123-8123-123456789abd", lease_token: "lease-c",
          chat_id: "103", texto: args.p_resposta, delivered: false, available: true });
        return { ok: true };
      }
      throw new Error("unexpected RPC");
    },
    sendMessage: async (chatId, text) => {
      if (failSend) throw new Error("ambiguous Telegram failure");
      sent.push({ chatId, text });
      return 201;
    },
  };
  return { deps, calls, sent, inbox, outbox,
    failPersist: () => { failPersist = true; }, failSend: (value) => { failSend = value; } };
}

test("webhook authenticates before reading and ACKs only after durable inbox", async () => {
  const h = harness();
  assert.equal((await handleTelegramRequest(request("", UPDATE, "wrong"), h.deps)).status, 401);
  assert.equal(h.calls.length, 0);
  h.failPersist();
  assert.equal((await handleTelegramRequest(request(), h.deps)).status, 503);
  assert.equal(h.inbox.size, 0);
});

test("raw media/callback and replay are passed unchanged to durable RPC", async () => {
  const h = harness();
  for (const update of [
    { update_id: 102, message: { ...UPDATE.message, text: undefined, photo: [{ file_id: "file" }] } },
    { update_id: 103, callback_query: { id: "callback", data: "approve" } },
  ]) {
    assert.equal((await handleTelegramRequest(request("", update), h.deps)).status, 200);
    assert.deepEqual(h.inbox.get(update.update_id), JSON.parse(JSON.stringify(update)));
  }
  assert.equal((await handleTelegramRequest(request("", UPDATE), h.deps)).status, 200);
  assert.equal((await handleTelegramRequest(request("", UPDATE), h.deps)).status, 200);
  assert.equal(h.inbox.size, 3);
  assert.equal((await handleTelegramRequest(request("", { ...UPDATE, message: { ...UPDATE.message, text: "changed" } }), h.deps)).status, 503);
});

test("worker capability can only claim and complete an existing job; Edge delivers by inbox chat", async () => {
  const h = harness();
  await handleTelegramRequest(request(), h.deps);
  const claim = await handleTelegramRequest(request("/worker/claim", {}, WORKER_SECRET,
    "x-helena-telegram-worker-secret"), h.deps);
  assert.equal(claim.status, 200);
  const job = (await claim.json()).job;
  assert.equal(job.update_id, "101");
  assert.deepEqual(job.update, UPDATE);
  const renew = await handleTelegramRequest(request("/worker/renew", {
    update_id: job.update_id, lease_token: job.lease_token, chat_id: 999,
  }, WORKER_SECRET, "x-helena-telegram-worker-secret"), h.deps);
  assert.equal(renew.status, 200);
  assert.deepEqual(h.calls.at(-1), { name: "renovar_trabalho_telegram",
    args: { p_update_id: "101", p_lease_token: "lease-b" } });
  const forged = await handleTelegramRequest(request("", UPDATE, WORKER_SECRET,
    "x-helena-telegram-worker-secret"), h.deps);
  assert.equal(forged.status, 401);
  const done = await handleTelegramRequest(request("/worker/complete", {
    update_id: job.update_id, lease_token: job.lease_token, resposta: "Plano sugerido",
    proposta: { natureza: "rascunho" }, chat_id: 999, usuario_id: 999,
  }, WORKER_SECRET, "x-helena-telegram-worker-secret"), h.deps);
  assert.equal(done.status, 200);
  assert.equal(h.calls.at(-1).name, "concluir_trabalho_telegram");
  assert.deepEqual(Object.keys(h.calls.at(-1).args).sort(),
    ["p_lease_token", "p_proposta", "p_resposta", "p_update_id"].sort());
  await handleTelegramRequest(request("/drain", {}, WORKER_SECRET,
    "x-helena-telegram-worker-secret"), h.deps);
  assert.deepEqual(h.sent.at(-1), { chatId: 103, text: "Plano sugerido" });
});

test("Telegram failure leaves outbox retryable and webhook ACK remains durable", async () => {
  const h = harness();
  h.failSend(true);
  assert.equal((await handleTelegramRequest(request(), h.deps)).status, 200);
  assert.equal(h.outbox[0].delivered, false);
  assert.equal(h.outbox[0].available, true);
  h.failSend(false);
  const result = await handleTelegramRequest(request("/drain", {}, WORKER_SECRET,
    "x-helena-telegram-worker-secret"), h.deps);
  assert.equal(result.status, 200);
  assert.equal(h.outbox[0].delivered, true);
  assert.equal(h.sent.length, 1);
});

test("backend role key stays in Edge and Telegram sender requires message_id", async () => {
  let call;
  const rpc = createRpcClient("https://wxkgrykduqtsgmjkzlou.supabase.co", "synthetic-service-key",
    async (url, options) => { call = { url, options }; return new Response('{"update_id":"101"}'); });
  await rpc("registrar_update_telegram", { p_update: UPDATE });
  assert.equal(call.options.headers.authorization, "Bearer synthetic-service-key");
  assert.match(call.url, /\/rest\/v1\/rpc\/registrar_update_telegram$/);
  assert.throws(() => createRpcClient("https://wrong.example", "key"));
  const sender = createTelegramSender("123:synthetic-token", async () =>
    new Response('{"ok":true,"result":{"message_id":201}}'));
  assert.equal(await sender(103, "teste"), 201);
  const bad = createTelegramSender("123:synthetic-token", async () => new Response('{"ok":true}'));
  await assert.rejects(() => bad(103, "teste"), /delivery failed/);
});

test("Edge entrypoint requires distinct server secrets and rejects legacy poller mode", async () => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let handler;
  const outgoing = [];
  const values = {
    HELENA_V2_TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
    HELENA_V2_TELEGRAM_WORKER_SECRET: WORKER_SECRET,
    HELENA_V2_TELEGRAM_BOT_TOKEN: "123:synthetic-token",
    SUPABASE_URL: "https://wxkgrykduqtsgmjkzlou.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
  };
  globalThis.Deno = { env: { get: (name) => values[name] }, serve: (fn) => { handler = fn; } };
  globalThis.fetch = async (url, options) => {
    outgoing.push({ url, options });
    if (url.includes("/registrar_update_telegram")) return new Response('{"update_id":"101"}');
    return new Response('{}');
  };
  try {
    await import("./index.ts?edge-entrypoint-secure-test");
    assert.equal((await handler(request())).status, 200);
    assert.ok(outgoing[0].url.endsWith("/registrar_update_telegram"));
    assert.equal(outgoing[0].options.headers.authorization, "Bearer synthetic-service-key");
    values.HELENA_V2_TELEGRAM_MODE = "hermes-poller";
    await import("./index.ts?edge-entrypoint-poller-disabled-test");
    assert.equal((await handler(request())).status, 503);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  }
});
