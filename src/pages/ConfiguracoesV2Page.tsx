import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckCircle2, ChevronRight, FileJson2, History, Plus, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth';
import { DocumentEditor } from '@/integrations/config-v2/DocumentEditor';
import { repositorioConfigV2DoApp } from '@/integrations/config-v2/runtime';
import type { ConfigBundle, ConfigDetail, ConfigRevision, JsonValue, RepositorioConfigV2 } from '@/integrations/config-v2/repository';

const grupos = [
  { id: 'agents', titulo: 'Agentes', testa: (p: string) => p.startsWith('helena-v2/agents/') || p === 'helena-v2/organograma.yaml' },
  { id: 'services', titulo: 'Serviços', testa: (p: string) => p === 'helena-v2/servicos.yaml' },
  { id: 'playbooks', titulo: 'Roteiros', testa: (p: string) => p.startsWith('helena-v2/playbooks/') },
  { id: 'models', titulo: 'Modelos', testa: (p: string) => p === 'helena-v2/models.yaml' },
  { id: 'deliverables', titulo: 'Entregas', testa: (p: string) => p.startsWith('helena-v2/deliverables/') },
] as const;
const botao = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';
const primario = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50';
const entrada = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function erroTexto(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Consulte a situação antes de tentar novamente.'; }
function caminhoEditavel(path: string) { return grupos.some(g => g.testa(path)); }
function caminhoNovoValido(path: string) {
  return /^helena-v2\/(?:agents|deliverables|playbooks)\/[a-z0-9_-]{1,250}\.yaml$/.test(path) || path === 'helena-v2/servicos.yaml' || path === 'helena-v2/models.yaml';
}
function formatoDocumento(valor: JsonValue) { return JSON.stringify(valor, null, 2); }

export default function ConfiguracoesV2Page({ repositorio }: { repositorio?: RepositorioConfigV2 }) {
  const { isFounder, user } = useAuth();
  const [repo, setRepo] = useState<RepositorioConfigV2 | null>(repositorio ?? null);
  const [lista, setLista] = useState<ConfigRevision[] | null>(null);
  const [detalhe, setDetalhe] = useState<ConfigDetail | null>(null);
  const [conteudo, setConteudo] = useState<ConfigBundle | null>(null);
  const [nome, setNome] = useState('');
  const [grupo, setGrupo] = useState<(typeof grupos)[number]['id']>('agents');
  const [caminho, setCaminho] = useState<string | null>(null);
  const [novoCaminho, setNovoCaminho] = useState('');
  const [textoAvancado, setTextoAvancado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const requisicao = useRef(0);
  const operacao = useRef(false);
  const importando = useRef(false);
  const identidadeAnterior = useRef<string | null | undefined>(undefined);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const identidade = isFounder ? user?.id ?? 'fundador' : null;

  useEffect(() => {
    if (identidadeAnterior.current !== undefined && identidadeAnterior.current !== identidade) {
      ++requisicao.current;
      setRepo(repositorio ?? null); setLista(null); setDetalhe(null); setConteudo(null);
      setNome(''); setCaminho(null); setTextoAvancado(null); setErro(null); setAviso(null);
      operacao.current = false; importando.current = false; setOcupado(false);
    }
    identidadeAnterior.current = identidade;
  }, [identidade, repositorio]);

  useEffect(() => {
    if (!isFounder || repositorio) return;
    let vivo = true;
    repositorioConfigV2DoApp().then(r => { if (vivo) setRepo(r); }).catch(e => { if (vivo) setErro(erroTexto(e)); });
    return () => { vivo = false; };
  }, [isFounder, repositorio]);

  useEffect(() => {
    if (!isFounder || !repo) return;
    let vivo = true;
    setCarregando(true);
    repo.listar().then(rows => { if (vivo) setLista(rows); }).catch(e => { if (vivo) setErro(erroTexto(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [identidade, isFounder, repo]);

  async function atualizarLista() {
    if (!repo || ocupado || carregando || importando.current) return;
    const atual = ++requisicao.current;
    setCarregando(true);
    try {
      const [rows, dado] = await Promise.all([repo.listar(), detalhe && !alterado && !jsonPendente ? repo.ler(detalhe.id) : Promise.resolve(null)]);
      if (atual !== requisicao.current) return;
      setLista(rows);
      if (dado) { setDetalhe(dado); setConteudo(dado.conteudo); setNome(dado.nome); }
      setErro(null);
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { if (atual === requisicao.current) setCarregando(false); }
  }

  async function abrir(id: string) {
    if (!repo || ocupado || carregando || importando.current) return;
    if ((alterado || jsonPendente) && !window.confirm('Há alterações não salvas. Descartar e abrir outra revisão?')) return;
    const atual = ++requisicao.current;
    setCarregando(true); setErro(null); setAviso(null);
    try {
      const dado = await repo.ler(id);
      if (atual !== requisicao.current) return;
      setDetalhe(dado); setConteudo(dado.conteudo); setNome(dado.nome);
      setCaminho(null); setTextoAvancado(null);
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { if (atual === requisicao.current) setCarregando(false); }
  }

  const editavel = detalhe?.estado === 'RASCUNHO' && !detalhe.validacao_pendente;
  const alterado = useMemo(() => Boolean(detalhe && conteudo && (nome !== detalhe.nome || JSON.stringify(conteudo) !== JSON.stringify(detalhe.conteudo))), [conteudo, detalhe, nome]);
  const jsonPendente = textoAvancado !== null && caminho !== null && conteudo?.[caminho] !== undefined && textoAvancado !== formatoDocumento(conteudo[caminho]);
  const ativo = lista?.find(r => r.ativa) ?? null;
  const documentos = useMemo(() => Object.keys(conteudo ?? {}).filter(p => grupos.find(g => g.id === grupo)?.testa(p)).sort(), [conteudo, grupo]);

  function iniciarOperacao() {
    if (operacao.current || carregando || importando.current) return false;
    operacao.current = true; ++requisicao.current; setOcupado(true);
    return true;
  }
  function terminarOperacao(atual: number) { if (atual === requisicao.current) { operacao.current = false; setOcupado(false); } }

  async function salvar() {
    if (!repo || !detalhe || !conteudo || !editavel || jsonPendente || !nome.trim() || !iniciarOperacao()) return;
    const atual = requisicao.current;
    setErro(null); setAviso(null);
    try {
      const salvo = await repo.salvar({ id: detalhe.id, versao_esperada: detalhe.versao, nome: nome.trim(), conteudo });
      if (atual !== requisicao.current) return;
      setDetalhe(salvo); setConteudo(salvo.conteudo); setNome(salvo.nome);
      setAviso('Rascunho salvo. Solicite a validação antes de ativar.');
      const rows = await repo.listar();
      if (atual === requisicao.current) setLista(rows);
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { terminarOperacao(atual); }
  }

  async function clonar() {
    if (!repo || !detalhe || carregando || ocupado) return;
    if ((alterado || jsonPendente) && !window.confirm('Há alterações não salvas. Clonar a versão salva e descartar estas alterações?')) return;
    if (!iniciarOperacao()) return;
    const atual = requisicao.current;
    setErro(null); setAviso(null);
    try {
      const copia = await repo.salvar({ base_id: detalhe.id, nome: detalhe.nome, conteudo: detalhe.conteudo });
      if (atual !== requisicao.current) return;
      setDetalhe(copia); setConteudo(copia.conteudo); setNome(copia.nome); setCaminho(null); setTextoAvancado(null);
      setAviso('Nova revisão em rascunho. As revisões anteriores continuam no histórico.');
      const rows = await repo.listar();
      if (atual === requisicao.current) setLista(rows);
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { terminarOperacao(atual); }
  }

  async function solicitarValidacao() {
    if (!repo || !detalhe || !editavel || alterado || jsonPendente || !iniciarOperacao()) return;
    const atual = requisicao.current;
    setErro(null); setAviso(null);
    try {
      await repo.solicitarValidacao(detalhe.id, detalhe.versao);
      await abrirDepoisDaOperacao(detalhe.id, atual);
      if (atual === requisicao.current) setAviso('Validação solicitada. Atualize o estado para acompanhar o resultado.');
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { terminarOperacao(atual); }
  }

  async function abrirDepoisDaOperacao(id: string, atual: number) {
    if (!repo) return;
    const [rows, dado] = await Promise.all([repo.listar(), repo.ler(id)]);
    if (atual !== requisicao.current) return;
    setLista(rows); setDetalhe(dado); setConteudo(dado.conteudo); setNome(dado.nome);
  }

  async function ativar() {
    if (!repo || !detalhe || detalhe.estado !== 'VALIDADA' || alterado || jsonPendente || !iniciarOperacao()) return;
    const atual = requisicao.current;
    setErro(null); setAviso(null);
    try {
      await repo.ativar(detalhe.id, ativo?.id ?? null);
      await abrirDepoisDaOperacao(detalhe.id, atual);
      if (atual === requisicao.current) setAviso('Revisão ativada para novos cards. Cards existentes conservam sua revisão.');
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { terminarOperacao(atual); }
  }

  async function aposentar() {
    if (!repo || !detalhe || detalhe.estado === 'APOSENTADA' || detalhe.ativa || detalhe.tecnica || ocupado || carregando || jsonPendente || alterado) return;
    if (!window.confirm('Inativar esta revisão para novos cards? O histórico será preservado.')) return;
    if (!iniciarOperacao()) return;
    const atual = requisicao.current;
    setErro(null); setAviso(null);
    try {
      await repo.aposentar(detalhe.id);
      await abrirDepoisDaOperacao(detalhe.id, atual);
      if (atual === requisicao.current) setAviso('Revisão inativada. Ela permanece disponível no histórico.');
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { terminarOperacao(atual); }
  }

  async function importarArquivo(file: File | undefined) {
    if (!file || !repo || ocupado || carregando || importando.current || operacao.current) return;
    importando.current = true; setOcupado(true);
    const atual = ++requisicao.current;
    setErro(null); setAviso(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('O arquivo excede 5 MB. Divida a configuração antes de importar.');
      const parseado: unknown = JSON.parse(await file.text());
      if (atual !== requisicao.current) return;
      if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) throw new Error('O arquivo precisa conter um objeto JSON com caminhos de configuração.');
      const bundle = parseado as ConfigBundle;
      if (!Object.keys(bundle).length || Object.keys(bundle).some(p => !p.startsWith('helena-v2/') || !/^[\w./-]+$/.test(p) || p.split('/').includes('..')))
        throw new Error('O arquivo não contém caminhos de configuração válidos.');
      const criado = await repo.salvar({ nome: file.name.replace(/\.json$/i, ''), conteudo: bundle });
      if (atual !== requisicao.current) return;
      setDetalhe(criado); setConteudo(criado.conteudo); setNome(criado.nome); setCaminho(null);
      const rows = await repo.listar();
      if (atual === requisicao.current) setLista(rows);
      if (atual === requisicao.current) setAviso('Arquivo local importado como rascunho. Confira os dados e solicite a validação.');
    } catch (e) { if (atual === requisicao.current) setErro(erroTexto(e)); }
    finally { if (atual === requisicao.current) { importando.current = false; setOcupado(false); if (arquivoRef.current) arquivoRef.current.value = ''; } }
  }

  if (!isFounder) return <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o fundador pode gerenciar a configuração da Helena v2.</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline" to="/sistema">Voltar ao sistema</Link></div>;

  return <div className="he-v2-config-page mx-auto max-w-7xl space-y-6 px-1 py-2 sm:px-4">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Sistema Helena / v2</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Configuração e revisões</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Edite uma revisão em rascunho, peça a validação técnica e ative quando estiver aprovada. O histórico e os cards em andamento permanecem vinculados às versões anteriores.</p></div>
      <button type="button" className={botao} onClick={atualizarLista} disabled={!repo || carregando || ocupado}><RefreshCw size={16}/>Atualizar estado</button>
    </header>
    {erro && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{erro}</div>}
    {aviso && <div role="status" className="rounded-xl border border-emerald-700/20 bg-emerald-700/5 p-4 text-sm text-emerald-900 dark:text-emerald-300">{aviso}</div>}
    {carregando && <p role="status" className="text-sm text-muted-foreground">Consultando configurações…</p>}
    {!carregando && lista?.length === 0 && <section className="rounded-xl border border-dashed border-border bg-card p-6"><FileJson2 className="mb-3 text-primary" size={24}/><h2 className="text-lg font-semibold">Nenhuma configuração cadastrada</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Carregue um arquivo JSON com a configuração existente para criar um rascunho. Nenhum conteúdo é gerado automaticamente.</p><input ref={arquivoRef} type="file" accept=".json,application/json" aria-label="Importar configuração existente em JSON" className="mt-4 block max-w-full text-sm" onChange={e => void importarArquivo(e.target.files?.[0])}/></section>}
    {lista && lista.length > 0 && <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 border-b border-border pb-3"><History size={17} className="text-primary"/><h2 className="font-semibold">Histórico</h2></div>
        <ul className="mt-2 max-h-[30rem] space-y-1 overflow-y-auto">{lista.map(r => <li key={r.id}><button type="button" disabled={carregando || ocupado} onClick={() => void abrir(r.id)} className={`min-h-11 w-full rounded-lg p-3 text-left hover:bg-muted disabled:opacity-50 ${detalhe?.id === r.id ? 'bg-primary/10' : ''}`} aria-current={detalhe?.id === r.id ? 'true' : undefined}><span className="flex items-center justify-between gap-2"><strong className="min-w-0 truncate text-sm">{r.nome}</strong>{r.ativa && <span className="shrink-0 rounded-full bg-emerald-700/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Ativa</span>}</span><span className="mt-1 block text-xs text-muted-foreground">Versão {r.versao} · {r.estado.toLowerCase()}</span></button></li>)}</ul>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Revisões antigas ficam disponíveis para consulta. Inativar não apaga registros.</p>
      </aside>
      <div className="min-w-0 space-y-5">{!detalhe || !conteudo ? <section className="rounded-xl border border-border bg-card p-6"><h2 className="font-semibold">Selecione uma revisão</h2><p className="mt-2 text-sm text-muted-foreground">Escolha uma versão no histórico para consultar, clonar ou editar o rascunho.</p></section> : <>
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Revisão {detalhe.versao} · {detalhe.estado.toLowerCase()}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{detalhe.nome}</h2>{detalhe.hash_sha256 && <p className="mt-1 font-mono text-xs text-muted-foreground">Identificação: {detalhe.hash_sha256.slice(0, 16)}…</p>}</div><span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{detalhe.ativa ? 'Ativa para novos cards' : 'Fora de uso para novos cards'}</span></div>
          {editavel && <label className="mt-5 block max-w-md text-sm font-medium">Nome da revisão<input className={`${entrada} mt-1`} value={nome} onChange={e => setNome(e.target.value)}/></label>}
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" className={botao} onClick={() => void clonar()} disabled={ocupado || carregando}><Plus size={16}/>Clonar revisão</button>
            {editavel && <button type="button" className={botao} onClick={() => void salvar()} disabled={ocupado || carregando || jsonPendente || !alterado || !nome.trim()}><Save size={16}/>Salvar rascunho</button>}
            {editavel && <button type="button" className={botao} onClick={() => void solicitarValidacao()} disabled={ocupado || carregando || jsonPendente || alterado}><ShieldCheck size={16}/>Solicitar validação</button>}
            {detalhe.estado === 'VALIDADA' && !detalhe.ativa && <button type="button" className={primario} onClick={() => void ativar()} disabled={ocupado || carregando || jsonPendente || alterado}><CheckCircle2 size={16}/>Ativar revisão</button>}
            {detalhe.estado !== 'APOSENTADA' && <button type="button" className={botao} onClick={() => void aposentar()} disabled={ocupado || carregando || jsonPendente || alterado || detalhe.ativa || detalhe.tecnica}><Archive size={16}/>Inativar</button>}</div>
          {detalhe.tecnica && <p className="mt-3 text-xs text-muted-foreground">Base técnica preservada: esta revisão não pode ser inativada.</p>}
          {!detalhe.tecnica && detalhe.ativa && <p className="mt-3 text-xs text-muted-foreground">Ative outra revisão antes de inativar esta.</p>}
          {detalhe.validacao_pendente && <p role="status" className="mt-4 text-sm text-muted-foreground">Aguardando validação técnica. Atualize o estado para consultar o resultado.</p>}
          {detalhe.resultado_validacao?.ok === false && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm"><strong>Validação não aprovada</strong><ul className="mt-1 list-inside list-disc">{(detalhe.resultado_validacao.erros ?? []).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {alterado && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Há alterações neste navegador que ainda não foram salvas.</p>}
          {jsonPendente && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">Aplique ou descarte o JSON avançado antes de salvar ou mudar o estado.</p>}
        </section>
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Conteúdo da revisão</p><h2 className="mt-1 text-lg font-semibold">Editar documentos</h2></div><p className="text-xs text-muted-foreground">{Object.keys(conteudo).length} documentos nesta revisão</p></div>
          <div role="tablist" aria-label="Área de configuração" className="mt-5 flex gap-1 overflow-x-auto border-b border-border">{grupos.map(g => <button type="button" role="tab" aria-selected={grupo === g.id} key={g.id} className={`min-h-11 shrink-0 border-b-2 px-3 py-2 text-sm ${grupo === g.id ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => { if (jsonPendente && !window.confirm('O JSON avançado não foi aplicado. Descartar estas edições?')) return; setGrupo(g.id); setCaminho(null); setTextoAvancado(null); }}>{g.titulo}</button>)}</div>
          <div className="mt-4 grid gap-5 xl:grid-cols-[14rem_minmax(0,1fr)]"><div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documentos</p><div className="space-y-1">{documentos.map(p => <button type="button" key={p} className={`min-h-11 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${caminho === p ? 'bg-primary/10 font-semibold' : ''}`} onClick={() => { if (jsonPendente && !window.confirm('O JSON avançado não foi aplicado. Descartar estas edições?')) return; setCaminho(p); setTextoAvancado(null); }}><span className="min-w-0 break-all">{p.split('/').pop()}</span><ChevronRight size={15} className="shrink-0"/></button>)}</div>
              {!documentos.length && <p className="text-sm text-muted-foreground">Nenhum documento nesta área.</p>}
              {editavel && grupo !== 'services' && grupo !== 'models' && <div className="mt-4 space-y-2"><label className="text-xs font-semibold" htmlFor="novo-documento">Novo documento</label><input id="novo-documento" aria-describedby="novo-documento-ajuda" className={entrada} value={novoCaminho} onChange={e => setNovoCaminho(e.target.value)} placeholder={`helena-v2/${grupo}/nome.yaml`}/><p id="novo-documento-ajuda" className="text-xs text-muted-foreground">Use até 250 letras minúsculas, números, hífens ou sublinhados antes de .yaml.</p><button type="button" className={botao} disabled={!caminhoNovoValido(novoCaminho) || !grupos.find(g => g.id === grupo)?.testa(novoCaminho) || Object.prototype.hasOwnProperty.call(conteudo, novoCaminho)} onClick={() => { if (jsonPendente && !window.confirm('O JSON avançado não foi aplicado. Descartar estas edições?')) return; setConteudo({ ...conteudo, [novoCaminho]: {} }); setCaminho(novoCaminho); setTextoAvancado(null); setNovoCaminho(''); }}><Plus size={15}/>Adicionar documento</button></div>}
            </div><div className="min-w-0">{caminho && conteudo[caminho] !== undefined ? <><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><h3 className="min-w-0 break-all font-semibold">{caminho}</h3>{editavel && caminhoEditavel(caminho) && <button type="button" className="min-h-11 text-xs font-medium text-destructive hover:underline" onClick={() => { const next = { ...conteudo }; delete next[caminho]; setConteudo(next); setCaminho(null); }}>Retirar deste rascunho</button>}</div>
                {editavel && caminhoEditavel(caminho) ? <><DocumentEditor key={caminho} label="Campos" value={conteudo[caminho]} onChange={valor => setConteudo({ ...conteudo, [caminho]: valor })}/><div className="mt-4"><button type="button" className="min-h-11 text-sm font-medium text-primary underline" onClick={() => { if (jsonPendente && !window.confirm('O JSON avançado não foi aplicado. Descartar estas edições?')) return; setTextoAvancado(textoAvancado === null ? formatoDocumento(conteudo[caminho]) : null); }}>{textoAvancado === null ? 'Editar JSON avançado' : 'Fechar editor avançado'}</button>{textoAvancado !== null && <div className="mt-3 space-y-2"><textarea aria-label="JSON do documento" spellCheck={false} className={`${entrada} min-h-72 font-mono text-xs`} value={textoAvancado} onChange={e => setTextoAvancado(e.target.value)}/><button type="button" className={botao} onClick={() => { try { const valor = JSON.parse(textoAvancado) as JsonValue; setConteudo({ ...conteudo, [caminho]: valor }); setTextoAvancado(null); setErro(null); } catch { setErro('O JSON deste documento não está válido. Corrija antes de aplicar.'); } }}>Aplicar JSON ao rascunho</button></div>}</div></>
                  : <pre className="mt-4 max-h-[38rem] overflow-auto rounded-lg bg-muted/50 p-4 text-xs leading-relaxed">{formatoDocumento(conteudo[caminho])}</pre>}
              </> : <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Selecione um documento para ver seus campos.</p>}</div></div>
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">Alterações de nome, cargo ou estado de agente também precisam ser refletidas no organograma. A validação técnica verifica a coerência. Regras da máquina, identidades e permissões exigem revisão técnica própria.</p>
        </section>
      </>}</div>
    </div>}
  </div>;
}
