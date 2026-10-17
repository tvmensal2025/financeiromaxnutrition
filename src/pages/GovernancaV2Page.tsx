import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth';
import { repositorioConfigV2DoApp } from '@/integrations/config-v2/runtime';
import type { RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import { lerRevisaoGovernanca, repositorioGovernancaV2DoApp, type CheckpointResumo, type DecisaoResumo, type RepositorioGovernancaV2 } from '@/integrations/operacao-v2/governanca';
import type { CatalogoV2 } from '@/integrations/operacao-v2/catalogo';

type Leitura<T> = { estado: 'carregando' | 'pronto' | 'erro'; valor: T | null };
const inicial = <T,>(): Leitura<T> => ({ estado: 'carregando', valor: null });
export default function GovernancaV2Page({ repositorio, repositorioConfig }: { repositorio?: RepositorioGovernancaV2; repositorioConfig?: RepositorioConfigV2 }) {
  const { user, isFounder } = useAuth();
  if (!user || !isFounder) return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-semibold">Governança</h1><p className="mt-3">A governança está disponível somente para o fundador.</p></main>;
  return <Governanca key={user.id} repositorio={repositorio} repositorioConfig={repositorioConfig} />;
}
function Governanca({ repositorio, repositorioConfig }: { repositorio?: RepositorioGovernancaV2; repositorioConfig?: RepositorioConfigV2 }) {
  const [checkpoint, setCheckpoint] = useState<Leitura<CheckpointResumo>>(inicial);
  const [decisoes, setDecisoes] = useState<Leitura<DecisaoResumo[]>>(inicial);
  const [config, setConfig] = useState<Leitura<CatalogoV2>>(inicial);
  const [ciclo, setCiclo] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCheckpoint(inicial()); setDecisoes(inicial()); setConfig(inicial());
    void (async () => {
      let repo: RepositorioGovernancaV2;
      try { repo = repositorio ?? await repositorioGovernancaV2DoApp(); }
      catch { if (vivo) { setCheckpoint({ estado: 'erro', valor: null }); setDecisoes({ estado: 'erro', valor: null }); } return; }
      // O checkpoint é a primeira leitura canônica; falha impede afirmações sobre sincronização.
      try { const valor = await repo.checkpoint(); if (vivo) setCheckpoint({ estado: 'pronto', valor }); }
      catch { if (vivo) setCheckpoint({ estado: 'erro', valor: null }); }
      if (!vivo) return;
      const [resultadoDecisoes, resultadoConfig] = await Promise.allSettled([
        repo.decisoes(),
        (async () => lerRevisaoGovernanca(repositorioConfig ?? await repositorioConfigV2DoApp()))(),
      ]);
      if (!vivo) return;
      setDecisoes(resultadoDecisoes.status === 'fulfilled' ? { estado: 'pronto', valor: resultadoDecisoes.value } : { estado: 'erro', valor: null });
      setConfig(resultadoConfig.status === 'fulfilled' ? { estado: 'pronto', valor: resultadoConfig.value } : { estado: 'erro', valor: null });
    })();
    return () => { vivo = false; };
  }, [repositorio, repositorioConfig, ciclo]);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-8">
    <header className="rounded-3xl bg-emerald-950 p-7 text-white"><p className="text-xs uppercase tracking-widest text-emerald-200">Sistema Helena · fontes canônicas</p><h1 className="mt-2 text-3xl font-semibold">Governança</h1><p className="mt-3 max-w-3xl text-emerald-50/90">Consulte o identificador do checkpoint atual, metadados das decisões recentes e a revisão de configuração ativa. Esta visão não exibe conteúdo de memória, contexto ou segredos.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Leituras com a sessão atual, sem alterar estado.</p><button className="min-h-11 font-semibold underline" onClick={() => setCiclo(n => n + 1)}>Atualizar</button></div>
    <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Checkpoint mestre atual</h2>
      {checkpoint.estado === 'carregando' && <p role="status" className="mt-3">Consultando checkpoint…</p>}
      {checkpoint.estado === 'erro' && <p role="alert" className="mt-3 text-destructive">Checkpoint indisponível. Não é possível afirmar que a configuração e as decisões estão sincronizadas.</p>}
      {checkpoint.estado === 'pronto' && (checkpoint.valor ? <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Identificador</dt><dd className="font-semibold">{checkpoint.valor.id}</dd></div><div><dt className="text-muted-foreground">Versão e estado</dt><dd>{checkpoint.valor.versao || 'não informada'} · {checkpoint.valor.estado || 'não informado'}</dd></div><div><dt className="text-muted-foreground">Atualizado em</dt><dd>{checkpoint.valor.atualizadoEm || 'não informado'}</dd></div></dl> : <p className="mt-3 text-sm">Nenhum checkpoint atual foi retornado.</p>)}
    </section>
    <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Decisões recentes</h2><p className="mt-1 text-sm text-muted-foreground">Até 30 registros ordenados pela data; identificador, escopo e estado. Esta amostra não confirma todas as decisões vigentes.</p>
      {decisoes.estado === 'carregando' && <p role="status" className="mt-3">Consultando decisões…</p>}
      {decisoes.estado === 'erro' && <p role="alert" className="mt-3 text-destructive">Não foi possível consultar as decisões.</p>}
      {decisoes.valor && (decisoes.valor.length ? <ul className="mt-3 divide-y divide-border">{decisoes.valor.map(decisao => <li key={decisao.id} className="py-2 text-sm"><strong>{decisao.id}</strong> · {decisao.estado} · {decisao.escopo || 'escopo não informado'} · {decisao.data || 'data não informada'}</li>)}</ul> : <p className="mt-3 text-sm">Nenhuma decisão retornada.</p>)}
    </section>
    <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Configuração v2 ativa</h2>
      {config.estado === 'carregando' && <p role="status" className="mt-3">Consultando configuração…</p>}
      {config.estado === 'erro' && <p role="alert" className="mt-3 text-destructive">Não foi possível confirmar uma revisão ativa e validada.</p>}
      {config.valor && <p className="mt-3 text-sm">{config.valor.revisao} · versão {config.valor.versao} · {config.valor.agentes.length} agentes e {config.valor.servicos.length} serviços cadastrados. Os estados da configuração não comprovam runtime. <Link to="/configuracoes" className="font-semibold text-emerald-800 underline dark:text-emerald-400">Ver revisões</Link></p>}
      <p className="mt-3 text-xs text-muted-foreground">A comparação semântica com o snapshot do checkpoint não é feita nesta tela; divergência permanece não confirmada.</p>
    </section>
  </main>;
}
