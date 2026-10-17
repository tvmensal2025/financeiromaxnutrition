import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { validOAuthRedirect } from "@/lib/oauth-redirect";

type Details = {
  authorization_id: string;
  redirect_url?: string;
  client?: { id?: string; name?: string; uri?: string };
  user?: { id?: string; email?: string };
  scope?: string;
};

type Loaded = { key: string; details: Details };

function goToOAuthRedirect(value: unknown): boolean {
  if (!validOAuthRedirect(value)) return false;
  window.location.assign(value);
  return true;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, appAccess, isFounder, loading } = useAuth();
  const authorizationId = params.get("authorization_id")?.trim() || "";
  const key = `${user?.id || ""}\u0000${authorizationId}`;
  const generation = useRef(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fetching, setFetching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const allowed = Boolean(user && isFounder && appAccess?.active && appAccess.user_id === user.id);

  useEffect(() => {
    const current = ++generation.current;
    setLoaded(null);
    setError("");
    setProcessing(false);
    if (loading || !allowed || !authorizationId) {
      setFetching(false);
      return;
    }
    setFetching(true);
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      .then(({ data, error: requestError }) => {
        if (generation.current !== current) return;
        if (requestError || !data) throw requestError || new Error("Solicitação não encontrada.");
        const details = data as Details;
        if (details.authorization_id !== authorizationId || (details.user?.id && details.user.id !== user?.id)) {
          throw new Error("A solicitação não pertence à sessão atual.");
        }
        if (details.redirect_url && !details.client) {
          if (!goToOAuthRedirect(details.redirect_url)) throw new Error("Destino de retorno inválido.");
          return;
        }
        if (!details.client || !(details.client.id || details.client.name) || !details.scope?.trim()) {
          throw new Error("O servidor não informou o cliente e as permissões solicitadas.");
        }
        setLoaded({ key, details });
      })
      .catch((cause: unknown) => {
        if (generation.current === current) setError(cause instanceof Error ? cause.message : "Não foi possível consultar a autorização.");
      })
      .finally(() => { if (generation.current === current) setFetching(false); });
    const requestTracker = generation;
    return () => { requestTracker.current++; };
  }, [authorizationId, key, loading, allowed, user?.id]);

  if (!loading && !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  async function decide(approve: boolean) {
    if (processing || !allowed || !loaded || loaded.key !== key || !authorizationId) return;
    const current = generation.current;
    setProcessing(true);
    setError("");
    try {
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (generation.current !== current) return;
      if (result.error) throw result.error;
      if (!goToOAuthRedirect(result.data?.redirect_url)) throw new Error("Destino de retorno inválido na resposta do servidor.");
    } catch (cause) {
      if (generation.current === current) setError(cause instanceof Error ? cause.message : "Não foi possível concluir a solicitação.");
    } finally {
      if (generation.current === current) setProcessing(false);
    }
  }

  const details = loaded?.key === key ? loaded.details : null;
  const scopes = details?.scope?.trim().split(/\s+/).filter(Boolean) || [];
  const clientUri = details?.client?.uri && validOAuthRedirect(details.client.uri) ? details.client.uri : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-4 py-10 text-foreground">
      <section className="w-full space-y-5 rounded-2xl border bg-card p-6 shadow-sm" aria-busy={fetching || processing}>
        <div>
          <p className="text-sm font-semibold text-primary">Sistema Helena</p>
          <h1 className="mt-2 text-2xl font-semibold">Autorizar acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Revise o aplicativo e as permissões informados pelo servidor antes de decidir.</p>
        </div>
        {loading || fetching ? <p role="status">Consultando solicitação de autorização…</p> : null}
        {!loading && !allowed && user ? <p role="alert">Sua conta não pode autorizar esta integração.</p> : null}
        {!loading && allowed && !authorizationId ? <p role="alert">O parâmetro authorization_id não foi fornecido.</p> : null}
        {error ? <p role="alert" className="text-destructive">{error}</p> : null}
        {details && allowed ? (
          <>
            <div className="space-y-1 rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Aplicativo solicitante</p>
              <p className="font-semibold">{details.client?.name || details.client?.id}</p>
              {clientUri ? <a href={clientUri} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{clientUri}</a> : null}
              <p className="pt-2 text-xs text-muted-foreground">Conta: {user?.email || user?.id}</p>
            </div>
            <div>
              <h2 className="font-semibold">Permissões solicitadas</h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">{scopes.map(scope => <li key={scope}>{scope}</li>)}</ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={processing} onClick={() => void decide(false)} className="rounded-lg border px-4 py-2 disabled:opacity-50">Negar acesso</button>
              <button type="button" disabled={processing} onClick={() => void decide(true)} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Autorizar acesso</button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
