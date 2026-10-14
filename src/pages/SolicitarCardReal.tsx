import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileJson2, Plus, Trash2 } from 'lucide-react';
import { ErroBancoCardsV2, type RepositorioCardsV2, type ResultadoSolicitacaoCardReal, type ResumoSolicitacaoCardReal } from '@/integrations/cards-v2/repository';
import { chaveDaSolicitacaoReal, lerPreparacaoCardReal, montarSolicitacaoCardReal, validarRevisaoPedidoReal,
  type PreparacaoCardReal, type RevisaoPedidoReal } from '@/integrations/cards-v2/preparacao-real';

type Props = { repositorio: RepositorioCardsV2 | null; identidade: string | null; onCardCriado: () => void };
const revisaoInicial = (): RevisaoPedidoReal => ({ prazo: '', criterios: [{ texto: '', quem_confere: '', risco: '' }],
  restricoes: '', semRestricoes: false, fontes: '', semFontes: false, conferido: false });
const TAMANHO_MAXIMO = 1_000_000;

export function SolicitarCardReal({ repositorio, identidade, onCardCriado }: Props) {
  const [preparacao, setPreparacao] = useState<PreparacaoCardReal | null>(null);
  const [revisao, setRevisao] = useState<RevisaoPedidoReal>(revisaoInicial);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [resultado, setResultado] = useState<ResultadoSolicitacaoCardReal | null>(null);
  const [incerto, setIncerto] = useState(false);
  const [chave, setChave] = useState<string | null>(null);
  const [historico, setHistorico] = useState<ResumoSolicitacaoCardReal[]>([]);
  const [consultandoTarefa, setConsultandoTarefa] = useState(false);
  const [consultaFalhou, setConsultaFalhou] = useState(false);
  const [solicitacaoExistente, setSolicitacaoExistente] = useState<ResumoSolicitacaoCardReal | null>(null);
  const leituraEmCurso = useRef(false);
  const envioEmCurso = useRef(false);
  const geracao = useRef(0);

  useEffect(() => {
    let ativo = true;
    geracao.current += 1;
    leituraEmCurso.current = false;
    envioEmCurso.current = false;
    setPreparacao(null);
    setRevisao(revisaoInicial());
    setLendo(false);
    setEnviando(false);
    setErros([]);
    setResultado(null);
    setIncerto(false);
    setChave(null);
    setConsultandoTarefa(false);
    setHistorico([]);
    setSolicitacaoExistente(null);
    setConsultaFalhou(false);
    if (repositorio && identidade) {
      void repositorio.listarSolicitacoesReais().then(lista => { if (ativo) setHistorico(lista); }).catch(() => {
        if (ativo) setErros(['Não foi possível consultar as solicitações anteriores. Confira o histórico no banco antes de enviar outro pedido.']);
      });
    }
    return () => { ativo = false; };
  }, [identidade, repositorio]);

  async function consultarTarefa(tarefaId: string, atual: number) {
    if (!repositorio) { setConsultaFalhou(true); return; }
    setConsultandoTarefa(true);
    setConsultaFalhou(false);
    try {
      const existente = await repositorio.consultarSolicitacaoPorTarefa(tarefaId);
      if (geracao.current === atual) setSolicitacaoExistente(existente);
    } catch {
      if (geracao.current === atual) {
        setConsultaFalhou(true);
        setErros(['Não foi possível conferir se esta tarefa já tem solicitação. Tente consultar novamente antes de enviar.']);
      }
    } finally {
      if (geracao.current === atual) setConsultandoTarefa(false);
    }
  }

  function editar(mutacao: (anterior: RevisaoPedidoReal) => RevisaoPedidoReal) {
    if (incerto) return;
    setRevisao(mutacao);
    setChave(null);
    setResultado(null);
    setErros([]);
  }

  async function importar(arquivo: File | undefined) {
    if (!arquivo || leituraEmCurso.current || envioEmCurso.current || incerto) return;
    leituraEmCurso.current = true;
    setLendo(true);
    setPreparacao(null);
    setRevisao(revisaoInicial());
    setResultado(null);
    setIncerto(false);
    setChave(null);
    setSolicitacaoExistente(null);
    setConsultaFalhou(false);
    setErros([]);
    const atual = ++geracao.current;
    try {
      if (!arquivo.name.toLowerCase().endsWith('.json') || (arquivo.type && !['application/json', 'text/json'].includes(arquivo.type))
          || arquivo.size > TAMANHO_MAXIMO || arquivo.size === 0) {
        throw new Error('Selecione o JSON privado da preparação, com até 1 MB.');
      }
      const nova = lerPreparacaoCardReal(await arquivo.text());
      if (geracao.current !== atual) return;
      setPreparacao(nova);
      setRevisao(revisaoInicial());
      await consultarTarefa(nova.tarefaId, atual);
    } catch (erro) {
      if (geracao.current === atual) setErros([erro instanceof Error ? erro.message : 'Não foi possível ler o arquivo.']);
    } finally {
      if (geracao.current === atual) { leituraEmCurso.current = false; setLendo(false); }
    }
  }

  async function confirmar() {
    if (!repositorio || !preparacao || envioEmCurso.current || resultado || consultandoTarefa || consultaFalhou || solicitacaoExistente) return;
    const falhas = validarRevisaoPedidoReal(preparacao, revisao);
    setErros(falhas);
    if (falhas.length) return;
    envioEmCurso.current = true;
    setEnviando(true);
    const atual = geracao.current;
    let chaveAtual: string;
    try {
      chaveAtual = chave ?? await chaveDaSolicitacaoReal(montarSolicitacaoCardReal(preparacao, revisao, ''));
    } catch (erro) {
      if (geracao.current === atual) {
        setErros([erro instanceof Error ? erro.message : 'Não foi possível gerar a chave segura do pedido.']);
        envioEmCurso.current = false;
        setEnviando(false);
      }
      return;
    }
    if (geracao.current !== atual) return;
    setChave(chaveAtual);
    try {
      if (!incerto) {
        const existente = await repositorio.consultarSolicitacaoPorTarefa(preparacao.tarefaId);
        if (geracao.current !== atual) return;
        if (existente) {
          setSolicitacaoExistente(existente);
          setErros(['Esta tarefa já tem uma solicitação registrada. Consulte o estado abaixo antes de enviar novamente.']);
          return;
        }
      }
      const resposta = await repositorio.solicitarCardReal(montarSolicitacaoCardReal(preparacao, revisao, chaveAtual));
      if (geracao.current !== atual) return;
      setResultado(resposta);
      setIncerto(false);
      void repositorio.listarSolicitacoesReais().then(lista => { if (geracao.current === atual) setHistorico(lista); }).catch(() => undefined);
      if (resposta.card_id) onCardCriado();
    } catch (erro) {
      if (geracao.current === atual) {
        try {
          const registrada = await repositorio.consultarSolicitacaoPorChave(chaveAtual);
          if (geracao.current !== atual) return;
          if (registrada) {
            setResultado(registrada);
            setIncerto(false);
            void repositorio.listarSolicitacoesReais().then(lista => { if (geracao.current === atual) setHistorico(lista); }).catch(() => undefined);
            if (registrada.card_id) onCardCriado();
          } else {
            const recusaDefinitiva = erro instanceof ErroBancoCardsV2 && /^[0-9A-Z]{5}$/.test(erro.codigo ?? '');
            setIncerto(!recusaDefinitiva);
            setErros([erro instanceof Error ? erro.message : 'Não foi possível registrar o pedido.',
              recusaDefinitiva ? 'O banco recusou o pedido; revise os campos ou gere outra preparação.'
                : 'Nenhuma confirmação foi encontrada nesta consulta. Mantenha a página aberta e tente novamente com a mesma preparação.']);
          }
        } catch {
          if (geracao.current === atual) {
            setIncerto(true);
            setErros(['Não foi possível confirmar se o pedido foi registrado. Mantenha a página aberta e tente novamente com a mesma preparação; a chave será preservada.']);
          }
        }
      }
    } finally {
      if (geracao.current === atual) { envioEmCurso.current = false; setEnviando(false); }
    }
  }

  return <section aria-label="Solicitar card real" className="he-v2-real-request rounded-xl border border-border bg-card p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <FileJson2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
      <div><h2 className="text-lg font-semibold">Solicitar card de uma tarefa real</h2>
        <p className="mt-1 text-sm text-muted-foreground">Selecione o JSON privado gerado pela preparação local. A leitura não cria card nem aciona agentes. Revise os dados antes de confirmar.</p></div>
    </div>
    <label className="mt-5 block text-sm font-semibold" htmlFor="preparacao-card-real">Arquivo de preparação privada</label>
    <input id="preparacao-card-real" type="file" accept=".json,application/json" disabled={lendo || enviando || incerto}
      className="mt-2 block w-full max-w-xl rounded-lg border border-border bg-background p-3 text-sm"
      onChange={evento => { const arquivo = evento.currentTarget.files?.[0]; evento.currentTarget.value = ''; void importar(arquivo); }} />
    {lendo && <p role="status" className="mt-3 text-sm text-muted-foreground">Lendo a preparação neste navegador…</p>}
    {incerto && <p role="status" className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200">A situação desta solicitação está incerta. A edição e a troca de arquivo ficam suspensas até a confirmação; tente novamente com os mesmos dados.</p>}
    {erros.length > 0 && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertCircle aria-hidden="true" className="mb-2 h-4 w-4" /><ul className="list-disc space-y-1 pl-5">{erros.map(erro => <li key={erro}>{erro}</li>)}</ul>
    </div>}
    {historico.length > 0 && <div className="mt-5 rounded-lg border border-border p-4 text-sm">
      <h3 className="font-semibold">Solicitações registradas desta conta</h3>
      <p className="mt-1 text-xs text-muted-foreground">Últimas vinte solicitações visíveis à sua conta. Consulte uma tarefa já registrada antes de enviar outro pedido.</p>
      <ul className="mt-3 space-y-2">{historico.map(item => <li key={item.id} className="break-words border-t border-border pt-2">
        Tarefa {item.chave_origem} · solicitação {item.id} · {item.criado_em} · {item.card_id ? `card ${item.card_id}` : 'aguardando processamento'}
      </li>)}</ul>
    </div>}
    {preparacao && <div className="mt-6 space-y-6 border-t border-border pt-6">
      {consultandoTarefa && <p role="status" className="text-sm text-muted-foreground">Consultando solicitações anteriores desta tarefa…</p>}
      {solicitacaoExistente && <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">Esta tarefa já tem a solicitação {solicitacaoExistente.id}, criada em {solicitacaoExistente.criado_em}. {solicitacaoExistente.card_id ? `Card vinculado: ${solicitacaoExistente.card_id}.` : 'Aguarda processamento.'} Consulte esse registro; o formulário não enviará uma segunda solicitação.</p>}
      {consultaFalhou && <button type="button" onClick={() => void consultarTarefa(preparacao.tarefaId, geracao.current)} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Consultar esta tarefa novamente</button>}
      <div className="grid gap-4 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
        <div><span className="block text-xs text-muted-foreground">Tarefa na origem</span><strong>{preparacao.tarefaId}</strong></div>
        <div><span className="block text-xs text-muted-foreground">Empresa na origem</span><strong>{preparacao.businessId}</strong></div>
        <div><span className="block text-xs text-muted-foreground">Versão da tarefa observada</span><p>{preparacao.versaoTarefa ?? 'Não informada'}</p></div>
        <div><span className="block text-xs text-muted-foreground">Fontes internas capturadas</span><p className="break-words">{preparacao.fontesInternas.join(', ') || 'Nenhuma'}</p></div>
        <div><span className="block text-xs text-muted-foreground">Decisões capturadas</span><p className="break-words">{preparacao.decisoes.map(decisao => `${decisao.id} · versão ${decisao.versao}`).join(', ') || 'Nenhuma'}</p></div>
        <div><span className="block text-xs text-muted-foreground">Entradas documentais capturadas</span><p className="break-words">{preparacao.entradas.map(entrada => `${entrada.rotulo}: ${entrada.jobId}`).join(', ') || 'Nenhuma'}</p></div>
        <div className="sm:col-span-2"><span className="block text-xs text-muted-foreground">Pedido original</span><p className="mt-1 whitespace-pre-wrap break-words">{preparacao.pedidoOriginal}</p></div>
        <div className="sm:col-span-2"><span className="block text-xs text-muted-foreground">Definição de pronto na tarefa</span><p className="mt-1 whitespace-pre-wrap break-words">{preparacao.definicaoDePronto ?? 'Não registrada na origem.'}</p></div>
        <div><span className="block text-xs text-muted-foreground">Prazo na tarefa</span><p>{preparacao.prazoOriginal ?? 'Não registrado na origem.'}</p></div>
        <div><span className="block text-xs text-muted-foreground">Identidade da empresa</span><p>{preparacao.pacoteConfirmado ? 'Confirmada na preparação' : 'Aguardando aprovação na origem'}</p></div>
      </div>
      {preparacao.pendencias.length > 0 && <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <h3 className="font-semibold">Pendências apontadas pela preparação</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">{preparacao.pendencias.map((pendencia, indice) => <li key={`${pendencia.campo}-${indice}`}>{pendencia.motivo}</li>)}</ul>
        <p className="mt-2">Esta confirmação registra o pedido. Ela não prova a suficiência dos documentos e não executa agentes; a validação e os portões do roteiro continuam no processamento.</p>
      </div>}
      {!preparacao.pacoteConfirmado && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">A identidade desta empresa ainda precisa ser aprovada na origem. Depois, gere uma nova preparação para solicitar o card.</p>}
      <div className="space-y-2"><label htmlFor="prazo-card-real" className="block text-sm font-semibold">Prazo confirmado com data, hora e fuso</label>
        <input id="prazo-card-real" type="text" value={revisao.prazo} disabled={enviando || !!resultado || incerto} onChange={evento => editar(r => ({ ...r, prazo: evento.target.value }))}
          className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        <p className="text-xs text-muted-foreground">Informe data e hora em ISO 8601 com fuso fixo de Brasília (UTC−03:00). O campo começa vazio para sua confirmação; o prazo da tarefa acima permanece como fato da origem.</p>
      </div>
      <fieldset className="space-y-4"><legend className="text-sm font-semibold">Critérios de pronto confirmados</legend>
        <p className="text-xs text-muted-foreground">Registre de 1 a 5 critérios. Escolha explicitamente a conferência por IA e o risco de cada um. Os portões de aprovação do fundador definidos no roteiro continuam separados.</p>
        {revisao.criterios.map((criterio, indice) => <div key={indice} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,1fr)_10rem_9rem_auto]">
          <label className="text-xs font-semibold">Critério {indice + 1}<input type="text" value={criterio.texto} disabled={enviando || !!resultado || incerto}
            onChange={evento => editar(r => ({ ...r, criterios: r.criterios.map((c, i) => i === indice ? { ...c, texto: evento.target.value } : c) }))}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-semibold">Quem confere<select value={criterio.quem_confere} disabled={enviando || !!resultado || incerto}
            onChange={evento => editar(r => ({ ...r, criterios: r.criterios.map((c, i) => i === indice ? { ...c, quem_confere: evento.target.value as 'IA' | '' } : c) }))}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal"><option value="">Selecione</option><option value="IA">IA</option></select></label>
          <label className="text-xs font-semibold">Risco<select value={criterio.risco} disabled={enviando || !!resultado || incerto}
            onChange={evento => editar(r => ({ ...r, criterios: r.criterios.map((c, i) => i === indice ? { ...c, risco: evento.target.value as 'ALTO' | 'BAIXO' | '' } : c) }))}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal"><option value="">Selecione</option><option value="ALTO">Alto</option><option value="BAIXO">Baixo</option></select></label>
          <button type="button" aria-label={`Remover critério ${indice + 1}`} disabled={enviando || !!resultado || incerto || revisao.criterios.length === 1}
            onClick={() => editar(r => ({ ...r, criterios: r.criterios.filter((_, i) => i !== indice) }))}
            className="self-end rounded-lg border border-border p-3 disabled:opacity-40"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
        </div>)}
        <button type="button" disabled={enviando || !!resultado || incerto || revisao.criterios.length >= 5}
          onClick={() => editar(r => ({ ...r, criterios: [...r.criterios, { texto: '', quem_confere: '', risco: '' }] }))}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-40"><Plus aria-hidden="true" className="h-4 w-4" />Adicionar critério</button>
      </fieldset>
      <div className="grid gap-6 lg:grid-cols-2">
        <div><label htmlFor="restricoes-card-real" className="block text-sm font-semibold">Restrições confirmadas</label>
          <p className="mt-1 text-xs text-muted-foreground">Uma restrição por linha, até cinco. Repita cada texto exatamente em um critério acima, escolhendo conferência por IA e risco alto. O total de critérios permanece limitado a cinco.</p>
          <textarea id="restricoes-card-real" value={revisao.restricoes} disabled={enviando || !!resultado || incerto || revisao.semRestricoes}
            onChange={evento => editar(r => ({ ...r, restricoes: evento.target.value }))} rows={4}
            className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
          <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={revisao.semRestricoes} disabled={enviando || !!resultado || incerto}
            onChange={evento => editar(r => ({ ...r, semRestricoes: evento.target.checked, restricoes: evento.target.checked ? '' : r.restricoes }))} />Não há restrições adicionais a registrar</label>
        </div>
        <div><label htmlFor="fontes-card-real" className="block text-sm font-semibold">Fontes externas autorizadas</label>
          <p className="mt-1 text-xs text-muted-foreground">Uma URL HTTPS pública por linha, até vinte. Documentos internos capturados não autorizam fontes externas por si.</p>
          <textarea id="fontes-card-real" value={revisao.fontes} disabled={enviando || !!resultado || incerto || revisao.semFontes}
            onChange={evento => editar(r => ({ ...r, fontes: evento.target.value }))} rows={4}
            className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
          <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={revisao.semFontes} disabled={enviando || !!resultado || incerto}
            onChange={evento => editar(r => ({ ...r, semFontes: evento.target.checked, fontes: evento.target.checked ? '' : r.fontes }))} />Não autorizo fontes externas adicionais</label>
        </div>
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-border p-4 text-sm"><input type="checkbox" checked={revisao.conferido} disabled={enviando || !!resultado || incerto}
        onChange={evento => editar(r => ({ ...r, conferido: evento.target.checked }))} />Conferi a tarefa, empresa, pedido original, prazo, critérios, restrições e fontes antes de solicitar.</label>
      {resultado ? <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <p>Solicitação {resultado.id} registrada no banco. {resultado.card_id ? `Card ${resultado.card_id} vinculado; atualize a lista para acompanhar.` : 'Aguarda processamento; acompanhe o estado no banco.'}</p>
      </div> : <button type="button" disabled={enviando || consultandoTarefa || consultaFalhou || !!solicitacaoExistente || !repositorio || !preparacao.pacoteConfirmado} onClick={() => void confirmar()}
        className="min-h-11 rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {enviando ? 'Registrando solicitação…' : incerto ? 'Tentar confirmar a mesma solicitação' : 'Confirmar e solicitar card real'}
      </button>}
    </div>}
  </section>;
}
