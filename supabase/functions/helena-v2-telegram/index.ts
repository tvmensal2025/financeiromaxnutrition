import { handleTelegramWebhook } from "./core.ts";
import { createRpcClient, createTelegramSender } from "./transport.ts";

const webhookSecret = Deno.env.get("HELENA_V2_TELEGRAM_WEBHOOK_SECRET");
const botToken = Deno.env.get("HELENA_V2_TELEGRAM_BOT_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const modeValue = Deno.env.get("HELENA_V2_TELEGRAM_MODE");
const mode = modeValue === "hermes-poller" ? "hermes-poller" : "webhook";

let backend: {
  callRpc: ReturnType<typeof createRpcClient>;
  sendMessage?: ReturnType<typeof createTelegramSender>;
} | undefined;
try {
  if ((!modeValue || modeValue === "webhook" || modeValue === "hermes-poller") &&
      supabaseUrl && serviceRoleKey && (mode === "hermes-poller" || botToken)) {
    backend = {
      callRpc: createRpcClient(supabaseUrl, serviceRoleKey),
      sendMessage: mode === "webhook" ? createTelegramSender(botToken!) : undefined,
    };
  }
} catch {
  // The webhook fails closed until configuration is corrected.
}

Deno.serve((request: Request) => {
  if (!backend) return new Response('{"ok":false}', {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
  return handleTelegramWebhook(request, {
    webhookSecret,
    mode,
    ...backend,
    reportPending: (updateId, kind) =>
      console.warn(`helena_v2_telegram_delivery_pending kind=${kind} update_id=${updateId}`),
  });
});
