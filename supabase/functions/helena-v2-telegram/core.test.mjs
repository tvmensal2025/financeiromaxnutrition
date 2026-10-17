import test from "node:test";
import assert from "node:assert/strict";
import { handleTelegramWebhook, RpcError } from "./core.ts";
import { createRpcClient, createTelegramSender } from "./transport.ts";

const SECRET = "synthetic_webhook_secret_32_characters_long";
const UUID = "12345678-1234-4123-8123-123456789abc";
const LINK_CODE = "a".repeat(48);

function update(text = "Crie um card para a empresa", overrides = {}) {
  return {
    update_id: 101,
    message: {
      message_id: 102,
      chat: { id: 103, type: "private" },
      from: { id: 103, is_bot: false },
      text,
    },
    ...overrides,
  };
}

function request(body, secret = SECRET) {
  return new Request("https://example.test/telegram", {
    method: "POST",
    headers: secret === null ? {} : { "x-telegram-bot-api-secret-token": secret },
    body: typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body),
  });
}

function harness(override = {}) {
  const rpcCalls = [];
  const sent = [];
  const pending = [];
  return {
    rpcCalls, sent,
    pending,
    deps: {
      webhookSecret: SECRET,
      callRpc: async (name, args) => {
        rpcCalls.push({ name, args });
        return name === "vincular_telegram" ? { vinculado: true } :
          { request_id: UUID, estado: "RECEBIDO", novo_evento: true };
      },
      sendMessage: async (chatId, text) => { sent.push({ chatId, text }); },
      reportPending: (updateId, kind) => { pending.push({ updateId, kind }); },
      ...override,
    },
  };
}

test("webhook rejects missing, wrong and weak secrets before parsing or RPC", async () => {
  for (const secret of [null, "wrong"]) {
    const h = harness();
    const res = await handleTelegramWebhook(request(update(), secret), h.deps);
    assert.equal(res.status, 401);
    assert.equal(h.rpcCalls.length, 0);
    assert.equal(h.sent.length, 0);
  }
  const h = harness({ webhookSecret: "short" });
  assert.equal((await handleTelegramWebhook(request(update(), "short"), h.deps)).status, 503);
  assert.equal(h.rpcCalls.length, 0);
});

test("rejects oversized or malformed body without backend access", async () => {
  const h = harness();
  const tooBig = request("x".repeat(65_537));
  assert.equal((await handleTelegramWebhook(tooBig, h.deps)).status, 413);
  assert.equal((await handleTelegramWebhook(request("{", h.deps.webhookSecret), h.deps)).status, 400);
  assert.equal((await handleTelegramWebhook(request(new Uint8Array([0xff])), h.deps)).status, 400);
  assert.equal(h.rpcCalls.length, 0);
});

test("only safe private human text reaches SQL", async () => {
  const bad = [
    update("text", { update_id: Number.MAX_SAFE_INTEGER + 1 }),
    update("text", { update_id: 0 }),
    update("text", { message: { ...update().message, chat: { id: 103, type: "group" } } }),
    update("text", { message: { ...update().message, from: { id: 104, is_bot: false } } }),
    update("text", { message: { ...update().message, from: { id: 103, is_bot: true } } }),
    update(" "),
    update("x".repeat(10_001)),
    update("text", { message: { ...update().message, message_id: 1.5 } }),
    update("text", { message: { ...update().message, chat: { id: Number.MAX_SAFE_INTEGER + 1, type: "private" } } }),
    update("has\u0000nul"),
  ];
  const h = harness();
  for (const item of bad) assert.equal((await handleTelegramWebhook(request(item), h.deps)).status, 200);
  assert.equal(h.rpcCalls.length, 0);
  assert.equal(h.sent.length, 0);
  assert.equal((await handleTelegramWebhook(request({ update_id: 101, edited_message: update().message }), h.deps)).status, 200);
  assert.equal(h.rpcCalls.length, 0);
});

test("link command calls only linking RPC, normalizes code and confirms linkage", async () => {
  const h = harness();
  const res = await handleTelegramWebhook(request(update(`/vincular ${LINK_CODE.toUpperCase()}`)), h.deps);
  assert.equal(res.status, 200);
  assert.deepEqual(h.rpcCalls, [{
    name: "vincular_telegram",
    args: { p_codigo: LINK_CODE, p_chat_id: 103, p_usuario_id: 103 },
  }]);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].text, /Vínculo confirmado/);
  assert.ok(!h.sent[0].text.includes(LINK_CODE));
  const malformed = harness();
  await handleTelegramWebhook(request(update("/vincular wrong")), malformed.deps);
  assert.equal(malformed.rpcCalls.length, 0);
});

test("order sends receipt only for new SQL event and never claims execution", async () => {
  const h = harness();
  assert.equal((await handleTelegramWebhook(request(update()), h.deps)).status, 200);
  assert.deepEqual(h.rpcCalls[0], {
    name: "receber_pedido_telegram",
    args: { p_chat_id: 103, p_usuario_id: 103, p_update_id: 101,
      p_mensagem_id: 102, p_texto: "Crie um card para a empresa", p_request_id: null },
  });
  assert.match(h.sent[0].text, /Estado: RECEBIDO/);
  assert.match(h.sent[0].text, new RegExp(UUID));
  assert.doesNotMatch(h.sent[0].text, /executad[oa]/i);
  const replay = harness({ callRpc: async () => ({ request_id: UUID, estado: "RECEBIDO", novo_evento: false }) });
  assert.equal((await handleTelegramWebhook(request(update()), replay.deps)).status, 200);
  assert.equal(replay.sent.length, 0);
});

test("unlinked or consumed code receives no details; infrastructure failure stays generic", async () => {
  const denied = harness({ callRpc: async () => { throw new RpcError("42501", "PAREAMENTO_NAO_VALIDO"); } });
  const result = await handleTelegramWebhook(request(update(`/vincular ${LINK_CODE}`)), denied.deps);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(denied.sent.length, 0);
  const divergent = harness({ callRpc: async () => { throw new RpcError("23505", "TELEGRAM_UPDATE_DIVERGENTE"); } });
  const divergentResult = await handleTelegramWebhook(request(update()), divergent.deps);
  assert.equal(divergentResult.status, 200);
  assert.equal(divergent.sent.length, 0);
  const serviceMisconfigured = harness({ callRpc: async () => { throw new RpcError("42501", "SOMENTE_SERVICO"); } });
  assert.equal((await handleTelegramWebhook(request(update()), serviceMisconfigured.deps)).status, 503);
  const failed = harness({ callRpc: async () => { throw new Error("secret backend detail"); } });
  const errorResult = await handleTelegramWebhook(request(update()), failed.deps);
  assert.equal(errorResult.status, 503);
  assert.ok(!(await errorResult.text()).includes("secret backend detail"));
});

test("Telegram delivery failure records pending, leaves durable SQL receipt, and avoids resend on replay", async () => {
  const h = harness({ sendMessage: async () => { throw new Error("synthetic send failure"); } });
  const res = await handleTelegramWebhook(request(update()), h.deps);
  assert.deepEqual(await res.json(), { ok: true, delivery_pending: true });
  assert.equal(h.rpcCalls.length, 1);
  assert.deepEqual(h.pending, [{ updateId: 101, kind: "order" }]);
  const replay = harness({ callRpc: async () => ({ request_id: UUID, estado: "RECEBIDO", novo_evento: false }) });
  await handleTelegramWebhook(request(update()), replay.deps);
  assert.equal(replay.sent.length, 0);
});

test("RPC transport uses service role only in backend headers and v2 schema", async () => {
  let call;
  const rpc = createRpcClient("https://wxkgrykduqtsgmjkzlou.supabase.co/", "synthetic-service-key", async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({ request_id: UUID, estado: "RECEBIDO", novo_evento: true }),
      { status: 200, headers: { "content-type": "application/json" } });
  });
  await rpc("receber_pedido_telegram", { p_request_id: null });
  assert.equal(call.url, "https://wxkgrykduqtsgmjkzlou.supabase.co/rest/v1/rpc/receber_pedido_telegram");
  assert.equal(call.options.headers["content-profile"], "helena_v2");
  assert.equal(call.options.headers.authorization, "Bearer synthetic-service-key");
  assert.equal(call.options.redirect, "error");
  assert.deepEqual(JSON.parse(call.options.body), { p_request_id: null });
  assert.throws(() => createRpcClient("http://wxkgrykduqtsgmjkzlou.supabase.co", "synthetic-service-key"));
  assert.throws(() => createRpcClient("https://other.supabase.co", "synthetic-service-key"));
});

test("RPC error code is classified without returning backend message", async () => {
  const rpc = createRpcClient("https://wxkgrykduqtsgmjkzlou.supabase.co", "synthetic-service-key", async () =>
    new Response(JSON.stringify({ code: "42501", message: "PAREAMENTO_NAO_VALIDO" }), { status: 403 }));
  await assert.rejects(() => rpc("vincular_telegram", {}), (error) =>
    error instanceof RpcError && error.code === "42501" && error.identifier === "PAREAMENTO_NAO_VALIDO" &&
      !error.message.includes("PAREAMENTO_NAO_VALIDO"));
});

test("Telegram sender uses sendMessage and checks API acknowledgement", async () => {
  let call;
  const sender = createTelegramSender("123:synthetic-token", async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  await sender(103, "test receipt");
  assert.equal(call.url, "https://api.telegram.org/bot123:synthetic-token/sendMessage");
  assert.deepEqual(JSON.parse(call.options.body), { chat_id: 103, text: "test receipt" });
  assert.equal(call.options.redirect, "error");
  const failed = createTelegramSender("123:synthetic-token", async () =>
    new Response(JSON.stringify({ ok: false }), { status: 200 }));
  await assert.rejects(() => failed(103, "test receipt"), /Telegram delivery failed/);
});

test("Edge entrypoint accepts Telegram header without Supabase JWT and uses backend-only service key", async () => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let handler;
  const outgoing = [];
  globalThis.Deno = {
    env: { get: (name) => ({
      HELENA_V2_TELEGRAM_WEBHOOK_SECRET: SECRET,
      HELENA_V2_TELEGRAM_BOT_TOKEN: "123:synthetic-token",
      SUPABASE_URL: "https://wxkgrykduqtsgmjkzlou.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
    })[name] },
    serve: (callback) => { handler = callback; },
  };
  globalThis.fetch = async (url, options) => {
    outgoing.push({ url, options });
    return url.includes("/rest/v1/rpc/") ?
      new Response(JSON.stringify({ request_id: UUID, estado: "RECEBIDO", novo_evento: true }), { status: 200 }) :
      new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await import("./index.ts?synthetic-entrypoint-test");
    const res = await handler(request(update()));
    assert.equal(res.status, 200);
    assert.equal(outgoing.length, 2);
    assert.equal(outgoing[0].options.headers.authorization, "Bearer synthetic-service-key");
    assert.ok(!outgoing[1].options.headers.authorization);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  }
});

test("poller broker accepts only explicit commands and returns receipt on SQL replay", async () => {
  const h = harness({ mode: "hermes-poller", sendMessage: undefined });
  const plain = await handleTelegramWebhook(request(update("conversa normal")), h.deps);
  assert.deepEqual(await plain.json(), { ok: true, respostas: [] });
  assert.equal(h.rpcCalls.length, 0);
  const order = await handleTelegramWebhook(request(update("/pedido Comprar equipamentos")), h.deps);
  assert.equal(order.status, 200);
  assert.equal(h.rpcCalls[0].args.p_texto, "Comprar equipamentos");
  const orderBody = await order.json();
  assert.equal(orderBody.respostas.length, 1);
  assert.match(orderBody.respostas[0], /RECEBIDO/);
  assert.equal(h.sent.length, 0);

  const replay = harness({
    mode: "hermes-poller", sendMessage: undefined,
    callRpc: async () => ({ request_id: UUID, estado: "RECEBIDO", novo_evento: false }),
  });
  const replayBody = await (await handleTelegramWebhook(request(update("/pedido Comprar equipamentos")), replay.deps)).json();
  assert.equal(replayBody.respostas[0], orderBody.respostas[0]);
  assert.equal(replay.sent.length, 0);
});

test("poller broker reports malformed command and unauthorized account generically", async () => {
  const h = harness({ mode: "hermes-poller", sendMessage: undefined });
  const malformed = await handleTelegramWebhook(request(update("/pedido")), h.deps);
  assert.match((await malformed.json()).respostas[0], /Use \/pedido/);
  assert.equal(h.rpcCalls.length, 0);
  const denied = harness({ mode: "hermes-poller", sendMessage: undefined,
    callRpc: async () => { throw new RpcError("42501", "TELEGRAM_NAO_VINCULADO"); } });
  const deniedResult = await handleTelegramWebhook(request(update("/pedido teste")), denied.deps);
  assert.equal(deniedResult.status, 200);
  assert.match((await deniedResult.json()).respostas[0], /Confira.*site/);
  const link = await handleTelegramWebhook(request(update(`/vincular ${LINK_CODE}`)), h.deps);
  assert.match((await link.json()).respostas[0], /Vínculo confirmado/);
  assert.equal(h.rpcCalls[0].name, "vincular_telegram");
});

test("poller broker entrypoint starts without bot token and makes no Telegram API call", async () => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let handler;
  const outgoing = [];
  globalThis.Deno = {
    env: { get: (name) => ({
      HELENA_V2_TELEGRAM_WEBHOOK_SECRET: SECRET,
      HELENA_V2_TELEGRAM_MODE: "hermes-poller",
      SUPABASE_URL: "https://wxkgrykduqtsgmjkzlou.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
    })[name] },
    serve: (callback) => { handler = callback; },
  };
  globalThis.fetch = async (url, options) => {
    outgoing.push({ url, options });
    return new Response(JSON.stringify({ request_id: UUID, estado: "RECEBIDO", novo_evento: true }), { status: 200 });
  };
  try {
    await import("./index.ts?synthetic-broker-entrypoint-test");
    const result = await handler(request(update("/pedido teste")));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).respostas.length, 1);
    assert.equal(outgoing.length, 1);
    assert.ok(outgoing[0].url.includes("/rest/v1/rpc/"));
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  }
});
