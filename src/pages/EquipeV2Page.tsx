import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth';
import { repositorioConfigV2DoApp } from '@/integrations/config-v2/runtime';
import type { RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import { lerCatalogoAtivo, type CatalogoV2 } from '@/integrations/operacao-v2/catalogo';

export default function EquipeV2Page({ repositorio }: { repositorio?: RepositorioConfigV2 }) {
  const { user, isFounder } = useAuth();
  if (!user || !isFounder) return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-semibold">Equipe</h1><p className="mt-3">A configuração dos agentes está disponível somente para o fundador.</p></main>;
  return <Equipe key={user.id} repositorio={repositorio} />;
}

function Equipe({ repositorio }: { repositorio?: RepositorioConfigV2 }) {
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [catalogo, setCatalogo] = useState<CatalogoV2 | null>(null);
  const [ciclo, setCiclo] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado('carregando'); setCatalogo(null);
    void (async () => {
      try {
        const dados = await lerCatalogoAtivo(repositorio ?? await repositorioConfigV2DoApp());
        if (vivo) { setCatalogo(dados); setEstado('pronto'); }
      } catch { if (vivo) setEstado('erro'); }
    })();
    return () => { vivo = false; };
  }, [repositorio, ciclo]);
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-8">
    <header className="rounded-3xl bg-emerald-950 p-7 text-white"><p className="text-xs uppercase tracking-widest text-emerald-200">Sistema Helena · configuração v2</p><h1 className="mt-2 text-3xl font-semibold">Equipe e serviços</h1><p className="mt-3 max-w-3xl text-emerald-50/90">Veja os papéis e serviços da revisão ativa. O estado configurado indica a intenção da revisão; disponibilidade do motor e execução precisam de verificação própria.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Fonte: configuração v2 ativa e validada no banco, lida nesta sessão.</p><button className="min-h-11 font-semibold underline" onClick={() => setCiclo(n => n + 1)}>Atualizar</button></div>
    {estado === 'carregando' && <p role="status">Consultando revisão ativa…</p>}
    {estado === 'erro' && <p role="alert" className="text-destructive">Não foi possível confirmar a equipe da revisão ativa. Consulte a configuração e tente atualizar.</p>}
    {catalogo && <>
      <p className="rounded-xl border border-border bg-card p-4 text-sm">Revisão <strong>{catalogo.revisao}</strong> · versão {catalogo.versao} · {catalogo.agentes.length} agentes cadastrados · {catalogo.servicos.length} serviços definidos. <Link to="/configuracoes" className="font-semibold text-emerald-700 underline dark:text-emerald-400">Abrir configuração</Link></p>
      <section><h2 className="text-xl font-semibold">Agentes</h2>{catalogo.agentes.length === 0 ? <p className="mt-3">A revisão ativa não contém agentes.</p> : <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalogo.agentes.map(agente => <li key={agente.id} className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{agente.id} · {agente.estado}</p><h3 className="mt-2 text-lg font-semibold">{agente.nome}</h3><p className="text-sm">{agente.cargo || 'Cargo não informado'}</p><p className="mt-2 text-xs text-muted-foreground">{agente.grupo || 'Grupo não informado'} · {agente.escopo || 'Escopo não informado'}{agente.fase && ` · ${agente.fase}`}</p><p className="mt-2 text-xs text-muted-foreground">Estado da configuração; runtime não verificado.</p></li>)}</ul>}</section>
      <section><h2 className="text-xl font-semibold">Serviços</h2>{catalogo.servicos.length === 0 ? <p className="mt-3">A revisão ativa não contém serviços.</p> : <ul className="mt-4 grid gap-3 md:grid-cols-2">{catalogo.servicos.map(servico => <li key={servico.id} className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{servico.id} · {servico.estado}</p><h3 className="mt-2 font-semibold">{servico.nome}</h3><p className="mt-2 text-sm text-muted-foreground">Responsável: {servico.dono || 'não informado'} · Revisor: {servico.revisor || 'não informado'}</p><p className="mt-1 text-xs text-muted-foreground">Empresas no catálogo: {servico.empresas.join(', ') || 'não informadas'}</p></li>)}</ul>}</section>
    </>}
  </main>;
}
