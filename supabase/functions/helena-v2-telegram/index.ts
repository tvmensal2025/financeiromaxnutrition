import { handleTelegramRequest } from "./core.ts";
import { createRpcClient, createTelegramSender } from "./transport.ts";

const webhookSecret = Deno.env.get("HELENA_V2_TELEGRAM_WEBHOOK_SECRET");
const workerSecret = Deno.env.get("HELENA_V2_TELEGRAM_WORKER_SECRET");
const botToken = Deno.env.get("HELENA_V2_TELEGRAM_BOT_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const mode = Deno.env.get("HELENA_V2_TELEGRAM_MODE");

let backend: {
  callRpc: ReturnType<typeof createRpcClient>;
  sendMessage: ReturnType<typeof createTelegramSender>;
} | undefined;
try {
  // The legacy Hermes poller mode cannot be enabled with this webhook.
  if ((!mode || mode === "webhook") && supabaseUrl && serviceRoleKey && botToken &&
      webhookSecret && workerSecret && webhookSecret !== workerSecret) {
    backend = {
      callRpc: createRpcClient(supabaseUrl, serviceRoleKey),
      sendMessage: createTelegramSender(botToken),
    };
  }
} catch { /* Fail closed until configuration is corrected. */ }

Deno.serve((request: Request) => {
  if (!backend) return new Response('{"ok":false}', { status: 503, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  } });
  return handleTelegramRequest(request, { webhookSecret, workerSecret, ...backend });
});
