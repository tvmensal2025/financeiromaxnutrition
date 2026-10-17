import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Database, Search } from 'lucide-react';
import { useAuth } from '@/auth';
import { useBusiness } from '@/contexts/BusinessContext';
import { ExecutivePageHeader } from '@/components/executive/ExecutivePageHeader';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { ExecutiveDrawer } from '@/components/executive/ExecutiveDrawer';
import { supabase } from '@/lib/supabase';
import { escreverRegistro, ehConflitoDeVersao, MENSAGEM_CONFLITO, TABELAS_PROTEGIDAS } from '@/lib/escrita-protegida';
import { CONTRATOS_MODULOS } from '@/lib/modulo-contratos';
import { obterModulo } from '@/lib/modulos';

type Linha = Record<string, unknown>;
const TAMANHO = 25;
const PREFIXOS_CRIACAO: Record<string, string> = {
  ideias: 'IDEA', marketing: 'CAM', atendimento: 'TKT', projetos: 'PRJ',
  marcos: 'MIL', produto: 'PRD', processos: 'PROC', riscos: 'RSK',
};
const mensagemLeitura = (code?: string) => code === '42501'
  ? 'Você não tem permissão para consultar este módulo. Confira a conta usada para entrar.'
  : 'Não foi possível consultar este módulo. Confira sua conexão e o contrato de dados publicado.';
const texto = (value: unknown) => value == null || value === '' ? '—' :
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'Dado estruturado';
const identificadorSeguro = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export default function Modulo() {
  const { tabela = '' } = useParams();
  const modulo = obterModulo(tabela);
  const contrato = Object.prototype.hasOwnProperty.call(CONTRATOS_MODULOS, tabela) ? CONTRATOS_MODULOS[tabela] : undefined;
  const { user, isFounder } = useAuth();
  const { currentBusinessId, isConsolidated, selecionadas, loading: loadingBusiness, error: businessError, rotulo } = useBusiness();
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState<Linha | null>(null);
  const [editando, setEditando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [erroEscrita, setErroEscrita] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const sequencia = useRef(0);
  const idsKey = selecionadas.filter(id => /^BIZ-[0-9]+$/.test(id)).join(',');
  const ids = useMemo(() => idsKey ? idsKey.split(',') : [], [idsKey]);
  const contextoValido = !loadingBusiness && !businessError && (isConsolidated ? ids.length > 0 : ids.includes(currentBusinessId));
  const contratoValido = Boolean(modulo && contrato && contrato.columns.includes(contrato.id) && (!contrato.business || contrato.columns.includes(contrato.business)));
  const escopoPermitido = Boolean(modulo && contrato && (tabela === 'portfolio' || contrato.business ? contextoValido : modulo.escopo === 'GLOBAL' || contrato.global));

  useEffect(() => { setPagina(0); setBusca(''); setTermo(''); setDetalhe(null); setEditando(false); setCriando(false); }, [tabela, user?.id, currentBusinessId]);
  useEffect(() => {
    const leituraAtual = sequencia;
    const seq = ++leituraAtual.current;
    setLinhas([]); setTotal(null); setErro(''); setDetalhe(null); setEditando(false); setCriando(false);
    if (!user?.id || !contrato || !modulo || !contratoValido || !escopoPermitido) { setCarregando(false); return; }
    setCarregando(true);
    const carregar = async () => {
      try {
        let query = supabase.from(tabela).select(contrato.columns.join(','), { count: 'exact' });
        if (contrato.business && tabela !== 'portfolio') {
          const coluna = contrato.business;
          if (modulo.escopo === 'MISTO') {
            // IDs are validated against the access-limited business list above.
            const values = (isConsolidated ? ids : [currentBusinessId]).join(',');
            query = query.or(`${coluna}.is.null,${coluna}.eq.GLOBAL,${coluna}.eq.GRUPO,${coluna}.in.(${values})`);
          } else if (isConsolidated) query = query.in(coluna, ids);
          else query = query.eq(coluna, currentBusinessId);
        }
        if (termo && contrato.search) query = query.ilike(contrato.search, `%${termo.replace(/[\\%_]/g, '\\$&')}%`);
        const { data, error, count } = await query.order(contrato.id).range(pagina * TAMANHO, (pagina + 1) * TAMANHO - 1);
        if (seq !== sequencia.current) return;
        if (error) { setErro(mensagemLeitura(error.code)); return; }
        setLinhas((data ?? []) as unknown as Linha[]); setTotal(count);
      } catch {
        if (seq === sequencia.current) setErro(mensagemLeitura());
      } finally {
        if (seq === sequencia.current) setCarregando(false);
      }
    };
    void carregar();
    return () => { if (leituraAtual.current === seq) leituraAtual.current++; };
  }, [tabela, modulo, contrato, contratoValido, escopoPermitido, user?.id, currentBusinessId, isConsolidated, ids, pagina, termo, revisao]);

  function abrir(linha: Linha) { setDetalhe(linha); setEditando(false); setErroEscrita(''); setRascunho({}); }
  function editar() {
    if (!isFounder || !contrato || !detalhe || !contrato.edit || !TABELAS_PROTEGIDAS.has(tabela)) return;
    setRascunho(Object.fromEntries(contrato.edit.map(campo => [campo, String(detalhe[campo] ?? '')])));
    setErroEscrita(''); setEditando(true);
  }
  function novo() {
    if (!isFounder || !contrato?.create || !contrato.edit || !contrato.business || isConsolidated || !contextoValido) return;
    setDetalhe(null); setRascunho({}); setErroEscrita(''); setEditando(false); setCriando(true);
  }
  async function salvar(event: FormEvent) {
    event.preventDefault();
    if (!isFounder || !contrato?.edit || salvando || !TABELAS_PROTEGIDAS.has(tabela)) return;
    if (criando && (!contrato.create || !contrato.business || !Object.prototype.hasOwnProperty.call(PREFIXOS_CRIACAO, tabela) || isConsolidated || !contextoValido)) return;
    if (!criando && !detalhe) return;
    const id = detalhe ? identificadorSeguro(detalhe[contrato.id]) : '';
    if (!criando && (!id || !/^\d+$/.test(String(detalhe?.row_version ?? '')))) { setErroEscrita('Versão não disponível. Reabra o registro antes de alterar.'); return; }
    const changes = Object.fromEntries(contrato.edit.filter(key => criando ? Boolean(rascunho[key]?.trim()) : rascunho[key] !== String(detalhe?.[key] ?? '')).map(key => [key, rascunho[key]?.trim() || null]));
    if (!Object.keys(changes).length) { if (criando) setErroEscrita('Preencha ao menos um campo.'); else setEditando(false); return; }
    setSalvando(true); setErroEscrita('');
    try {
      const { error } = criando
        ? await supabase.from(tabela).insert({ ...changes, [contrato.id]: `${PREFIXOS_CRIACAO[tabela]}-${crypto.randomUUID()}`, [contrato.business!]: currentBusinessId })
        : await escreverRegistro(tabela, id, detalhe!.row_version, changes);
      if (error) { setErroEscrita(ehConflitoDeVersao(error.code) ? MENSAGEM_CONFLITO : 'Não foi possível salvar o registro. Confira suas permissões e tente novamente.'); return; }
      setDetalhe(null); setEditando(false); setCriando(false); setRevisao(value => value + 1);
    } catch { setErroEscrita('Não foi possível salvar o registro. Confira suas permissões e tente novamente.'); }
    finally { setSalvando(false); }
  }

  if (!modulo) return <main className="p-6"><ExecutiveEmptyState title="Módulo não encontrado" description="Este endereço não faz parte do catálogo de módulos do Sistema Helena." /></main>;
  const semContrato = !contratoValido || !escopoPermitido && !loadingBusiness && !businessError && contextoValido;
  return <main className="space-y-5 p-4 md:p-6">
    <ExecutivePageHeader title={modulo.titulo} description={modulo.descricao} icon={Database} breadcrumb={`${modulo.grupo.toUpperCase()} · ${rotulo}`} />
    {semContrato ? <ExecutiveEmptyState title="Consulta indisponível" description="Este módulo está preservado no catálogo, mas ainda não possui um contrato de leitura seguro para esta tela. Consulte sua página dedicada ou peça a publicação do contrato." />
    : loadingBusiness ? <ExecutiveLoadingState />
    : businessError || !contextoValido && modulo.escopo !== 'GLOBAL' && tabela !== 'portfolio' ? <ExecutiveErrorState message="Não foi possível confirmar as empresas permitidas para sua sessão." />
    : <>
      <div className="flex flex-wrap items-center gap-2">
      {contrato?.search && <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setPagina(0); setTermo(busca.trim().slice(0, 100)); }}>
        <label className="sr-only" htmlFor="busca-modulo">Buscar registros</label><input id="busca-modulo" value={busca} onChange={event => setBusca(event.target.value)} placeholder={`Buscar por ${contrato.search.replace(/_/g, ' ')}`} className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><Search size={16} /> Buscar</button>
      </form>}
      {isFounder && contrato?.create && !isConsolidated && contextoValido && <button type="button" onClick={novo} className="rounded-md border border-border px-3 py-2 text-sm">Novo registro</button>}
      </div>
      {carregando ? <ExecutiveLoadingState /> : erro ? <ExecutiveErrorState message={erro} onRetry={() => setRevisao(value => value + 1)} /> : !linhas.length ? <ExecutiveEmptyState title="Nenhum registro encontrado" description="A consulta foi concluída sem registros para este filtro e empresa." /> : <>
        <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{contrato?.columns.filter(coluna => coluna !== 'row_version').slice(0, 6).map(coluna => <th key={coluna} className="px-3 py-2 font-medium capitalize">{coluna.replace(/_/g, ' ')}</th>)}<th className="px-3 py-2">Detalhes</th></tr></thead><tbody>{linhas.map((linha, indice) => <tr key={`${identificadorSeguro(linha[contrato!.id])}-${indice}`} className="border-t border-border">{contrato?.columns.filter(coluna => coluna !== 'row_version').slice(0, 6).map(coluna => <td key={coluna} className="max-w-[15rem] truncate px-3 py-2">{texto(linha[coluna])}</td>)}<td className="px-3 py-2"><button type="button" className="text-primary underline" onClick={() => abrir(linha)}>Abrir</button></td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{total == null ? `Página ${pagina + 1}` : `${total} registros · Página ${pagina + 1}`}</span><div className="flex gap-2"><button type="button" disabled={!pagina} onClick={() => setPagina(value => value - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button><button type="button" disabled={linhas.length < TAMANHO || total !== null && (pagina + 1) * TAMANHO >= total} onClick={() => setPagina(value => value + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Próxima</button></div></div>
      </>}
    </>}
    <ExecutiveDrawer open={Boolean(detalhe) || criando} onOpenChange={open => { if (!open) { setDetalhe(null); setEditando(false); setCriando(false); } }} title={criando ? `Novo registro · ${modulo.titulo}` : modulo.titulo} subtitle={detalhe && contrato ? identificadorSeguro(detalhe[contrato.id]) : ''} footer={isFounder && detalhe && contrato?.edit && TABELAS_PROTEGIDAS.has(tabela) && !editando ? <button type="button" onClick={editar} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">Editar</button> : undefined}>
      {contrato && (detalhe || criando) && (editando || criando ? <form id="form-modulo" onSubmit={salvar} className="space-y-4">{contrato.edit?.map(campo => <label key={campo} className="block text-sm capitalize">{campo.replace(/_/g, ' ')}<input value={rascunho[campo] ?? ''} onChange={event => setRascunho(value => ({ ...value, [campo]: event.target.value }))} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" /></label>)}{erroEscrita && <p role="alert" className="text-sm text-destructive">{erroEscrita}</p>}<div className="flex gap-2"><button type="submit" disabled={salvando} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Salvar</button><button type="button" onClick={() => { setEditando(false); setCriando(false); }} className="rounded border px-4 py-2 text-sm">Cancelar</button></div></form> : <dl className="space-y-3">{contrato.columns.filter(coluna => coluna !== 'row_version').map(coluna => <div key={coluna}><dt className="text-xs font-medium uppercase text-muted-foreground">{coluna.replace(/_/g, ' ')}</dt><dd className="break-words text-sm">{texto(detalhe?.[coluna])}</dd></div>)}</dl>)}
    </ExecutiveDrawer>
  </main>;
}
