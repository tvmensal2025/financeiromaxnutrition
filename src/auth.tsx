import { createContext, useContext, useEffect, useState } from "react";
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
  passwordRecovery: boolean;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  concluirRecuperacaoSenha: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appAccess, setAppAccess] = useState<AppAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const carregarAppAccess = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("app_access")
        .select("user_id,role,active")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setAppAccess(data as AppAccess);
      } else {
        setAppAccess(null);
      }
    } catch {
      setAppAccess(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        carregarAppAccess(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }
      if (event === "SIGNED_OUT") {
        setPasswordRecovery(false);
      }
      setSession(next);
      if (next?.user) {
        carregarAppAccess(next.user.id).finally(() => setLoading(false));
      } else {
        setAppAccess(null);
        setLoading(false);
      }
    });

    return () => data.subscription.unsubscribe();
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
      // Validação mandatória de app_access.active = true
      try {
        const { data: accessData, error: accessError } = await supabase
          .from("app_access")
          .select("user_id,role,active")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (accessError || !accessData || !accessData.active) {
          // Bloqueia e desloga imediatamente
          await supabase.auth.signOut();
          setSession(null);
          setAppAccess(null);
          return "Usuário não autorizado para o Sistema Helena.";
        }

        setAppAccess(accessData as AppAccess);
      } catch (err: any) {
        await supabase.auth.signOut();
        setSession(null);
        setAppAccess(null);
        return "Usuário não autorizado para o Sistema Helena.";
      }
    }

    return null;
  }

  async function sair() {
    await supabase.auth.signOut();
    setSession(null);
    setAppAccess(null);
    setPasswordRecovery(false);
  }

  function concluirRecuperacaoSenha() {
    setPasswordRecovery(false);
  }

  const role = appAccess?.role || null;
  const isFounder = role === "founder";
  const isAdmin = isFounder || role === "admin";
  const isMember = Boolean(appAccess?.active);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        appAccess,
        role,
        isFounder,
        isAdmin,
        isMember,
        loading,
        passwordRecovery,
        entrar,
        sair,
        concluirRecuperacaoSenha,
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
