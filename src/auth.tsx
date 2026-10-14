import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "founder" | "admin" | "member";

export type AppAccess = {
  user_id: string;
  role: AppRole;
  active: boolean;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  appAccess: AppAccess | null;
  role: AppRole | null;
  isFounder: boolean;
  isAdmin: boolean;
  isMember: boolean;
  loading: boolean;
  accessCheckFailed: boolean;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const MODO_TESTE_SEM_SENHA =
  import.meta.env.DEV &&
  import.meta.env.MODE !== "test" &&
  import.meta.env.VITE_MODO_TESTE_SEM_SENHA === "true" &&
  Boolean(import.meta.env.VITE_TESTE_EMAIL) &&
  Boolean(import.meta.env.VITE_TESTE_SENHA);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appAccess, setAppAccess] = useState<AppAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessCheckFailed, setAccessCheckFailed] = useState(false);
  const sessionEpoch = useRef(0);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;

    const carregarSessao = (next: Session | null) => {
      const request = ++sessionEpoch.current;
      currentUserId.current = next?.user.id ?? null;
      setSession(next);
      setAppAccess(null);
      setAccessCheckFailed(false);

      if (!next?.user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Auth callbacks must return before making another Supabase request.
      setTimeout(() => {
        if (!mounted || request !== sessionEpoch.current) return;
        void Promise.resolve(supabase
          .from("app_access")
          .select("user_id,role,active")
          .eq("user_id", next.user.id)
          .maybeSingle())
          .then(({ data: accessData, error: accessError }) => {
            if (!mounted || request !== sessionEpoch.current) return;
            setAppAccess(!accessError && accessData ? (accessData as AppAccess) : null);
            setAccessCheckFailed(Boolean(accessError));
          })
          .catch(() => {
            if (!mounted || request !== sessionEpoch.current) return;
            setAppAccess(null);
            setAccessCheckFailed(true);
          })
          .finally(() => {
            if (mounted && request === sessionEpoch.current) setLoading(false);
          });
      });
    };

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      carregarSessao(next);
    });

    void supabase.auth.getSession().then(async ({ data: sessionData, error }) => {
      // INITIAL_SESSION may win this race; never let a late getSession result
      // overwrite a newer sign-in, sign-out, or token refresh event.
      if (!mounted || authEventReceived) return;
      if (error) {
        setSession(null);
        setAppAccess(null);
        setAccessCheckFailed(true);
        setLoading(false);
        return;
      }
      let atual = sessionData.session;
      if (!atual && MODO_TESTE_SEM_SENHA) {
        const { data: login } = await supabase.auth.signInWithPassword({
          email: String(import.meta.env.VITE_TESTE_EMAIL),
          password: String(import.meta.env.VITE_TESTE_SENHA),
        });
        if (!mounted || authEventReceived) return;
        atual = login.session;
      }
      carregarSessao(atual);
    }).catch(() => {
      if (!mounted || authEventReceived) return;
      setSession(null);
      setAppAccess(null);
      setAccessCheckFailed(true);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sessionEpoch.current += 1;
      data.subscription.unsubscribe();
    };
  }, []);

  async function entrar(email: string, senha: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("invalid login credentials") ||
        error.message.toLowerCase().includes("invalid_grant")
      ) {
        return "E-mail ou senha incorretos.";
      }
      return error.message;
    }

    if (data.user) {
      const revision = sessionEpoch.current;
      const sessaoVigente = () => sessionEpoch.current === revision && currentUserId.current === data.user.id;
      if (!sessaoVigente()) return "A sessão mudou durante o login. Confira a conta atual.";
      // Validação mandatória de app_access.active = true
      try {
        const { data: accessData, error: accessError } = await supabase
          .from("app_access")
          .select("user_id,role,active")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!sessaoVigente()) return "A sessão mudou durante o login. Confira a conta atual.";
        if (accessError || !accessData || !accessData.active || accessData.user_id !== data.user.id) {
          // Bloqueia e desloga imediatamente
          setAppAccess(null);
          setAccessCheckFailed(Boolean(accessError));
          const { error: logoutError } = await supabase.auth.signOut();
          if (sessaoVigente()) {
            if (!logoutError) { currentUserId.current = null; sessionEpoch.current += 1; setSession(null); }
            else setAccessCheckFailed(true);
          }
          return accessError
            ? "Não foi possível validar seu acesso agora. Tente novamente em instantes."
            : "Usuário não autorizado para o Sistema Helena.";
        }

        setAppAccess(accessData as AppAccess);
      } catch {
        if (sessaoVigente()) {
          setAppAccess(null);
          setAccessCheckFailed(true);
        }
        return "Não foi possível validar seu acesso agora. Tente novamente em instantes.";
      }
    }

    return null;
  }

  async function sair() {
    const revision = ++sessionEpoch.current;
    try {
      const { error } = await supabase.auth.signOut();
      if (sessionEpoch.current !== revision) return;
      if (error) { setLoading(false); setAccessCheckFailed(true); return; }
      currentUserId.current = null;
      setSession(null);
      setAppAccess(null);
      setLoading(false);
      setAccessCheckFailed(false);
    } catch {
      if (sessionEpoch.current === revision) {
        setLoading(false);
        setAccessCheckFailed(true);
      }
    }
  }

  const acessoAtual = session?.user.id === appAccess?.user_id && appAccess?.active;
  const role = acessoAtual ? appAccess.role : null;
  const isFounder = role === "founder";
  const isAdmin = isFounder || role === "admin";
  const isMember = Boolean(acessoAtual);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        appAccess: acessoAtual ? appAccess : null,
        role,
        isFounder,
        isAdmin,
        isMember,
        loading,
        accessCheckFailed,
        entrar,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("Auth ausente");
  return ctx;
}
