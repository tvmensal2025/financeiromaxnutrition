import { FormEvent, useState } from "react";
import { Leaf } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth";

export default function Entrar() {
  const { user, loading, entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    const msg = await entrar(email.trim(), senha);
    if (msg) setErro(msg);
    setEnviando(false);
  }

  return (
    <div className="painel-elite pe-auth">
      <form className="pe-auth-card" onSubmit={onSubmit}>
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#007A3D] text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#007A3D]">Helena</p>
            <h1 className="text-xl">Entrar no ecossistema</h1>
          </div>
        </div>
        <p className="pe-page-sub">iGreen, Saúde e Humano Digital ficam na mesma mesa, cada um com os próprios registros.</p>
        <label className="mt-5 block text-sm font-medium">
          E-mail
          <input className="pe-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Senha
          <input className="pe-input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
        <button className="pe-button" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
