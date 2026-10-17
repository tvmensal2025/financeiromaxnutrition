import { RpcError } from "./core.ts";

type Fetch = typeof fetch;
const SUPABASE_HOST = "wxkgrykduqtsgmjkzlou.supabase.co";

export function createRpcClient(supabaseUrl: string, serviceRoleKey: string, doFetch: Fetch = fetch) {
  const base = new URL(supabaseUrl);
  if (base.protocol !== "https:" || base.hostname !== SUPABASE_HOST || base.port ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash ||
      !serviceRoleKey) {
    throw new Error("Telegram backend is not configured");
  }
  const rpcBase = `${base.href.replace(/\/+$/, "")}/rest/v1/rpc/`;
  return async (name: "vincular_telegram" | "receber_pedido_telegram", args: Record<string, unknown>) => {
    const response = await doFetch(`${rpcBase}${name}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-profile": "helena_v2",
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      let code: string | undefined;
      let identifier: string | undefined;
      try {
        const error: unknown = await response.json();
        if (error && typeof error === "object" && "code" in error &&
            typeof error.code === "string") code = error.code;
        if (error && typeof error === "object" && "message" in error &&
            typeof error.message === "string" &&
            /^(PAREAMENTO_NAO_VALIDO|TELEGRAM_NAO_VINCULADO|TELEGRAM_UPDATE_DIVERGENTE|ENTRADA_EVENTO_DIVERGENTE)$/.test(error.message)) {
          identifier = error.message;
        }
      } catch { /* Never expose the backend response. */ }
      throw new RpcError(code, identifier);
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new RpcError(undefined);
    return data as Record<string, unknown>;
  };
}

export function createTelegramSender(botToken: string, doFetch: Fetch = fetch) {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
    throw new Error("Telegram backend is not configured");
  }
  return async (chatId: number, text: string): Promise<void> => {
    const response = await doFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) throw new Error("Telegram delivery failed");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
      throw new Error("Telegram delivery failed");
    }
  };
}
