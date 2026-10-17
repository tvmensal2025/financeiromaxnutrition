import { useEffect, useRef, useState } from 'react';
import { repositorioPedidosV2DoApp } from '@/integrations/pedidos-v2/runtime';
import { ErroEntradaPedidos, LIMITE_TEXTO_PEDIDO, uuidValido, type DetalhePedidoEntrada, type EnvioPedido, type ListaPedidos, type PedidoEntrada,
  type RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';
import { apagarPedidoPendente, guardarUltimoPedido, lerPedidoPendente, lerUltimoPedido, salvarPedidoPendente } from '@/integrations/pedidos-v2/pendente';

type Props = { identidade: string; repositorio?: RepositorioPedidosV2 };
export function EntradaPedidosV2(props: Props) { return <Entrada key={props.identidade} {...props} />; }

function Entrada({ identidade, repositorio }: Props) {
  const [repo, setRepo] = useState<RepositorioPedidosV2 | null>(repositorio ?? null);
  const [texto, setTexto] = useState('');
  const [pendente, setPendente] = useState<EnvioPedido | null>(null);
  const [recibo, setRecibo] = useState<PedidoEntrada | null>(null);
  const [lista, setLista] = useState<ListaPedidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [tentativaLista, setTentativaLista] = useState(0);
  const [consultaId, setConsultaId] = useState('');
  const [consultado, setConsultado] = useState<DetalhePedidoEntrada | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const trava = useRef(false);
  const travaConsulta = useRef(false);
  const vivo = useRef(true);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    try {
      const anterior = lerPedidoPendente(identidade, sessionStorage);
      setPendente(anterior);
      if (anterior) setTexto(anterior.texto);
      setConsultaId(lerUltimoPedido(identidade, sessionStorage));
    } catch {
      setErroLocal('Não foi possível recuperar o recibo deste navegador. Consulte os pedidos registrados antes de fazer outro envio.');
    }
  }, [identidade]);
  useEffect(() => {
    if (repositorio) { setRepo(repositorio); return; }
    let ativo = true;
    setErro(null);
    repositorioPedidosV2DoApp().then(valor => { if (ativo) setRepo(valor); }).catch(() => {
      if (ativo) setErro('Não foi possível conectar o recebimento de pedidos. Tente novamente.');
    });
    return () => { ativo = false; };
  }, [repositorio, tentativa]);
  useEffect(() => {
    if (!repo) { setCarregando(false); return; }
    let ativo = true;
    setCarregando(true);
    setErroLista(null);
    repo.listar().then(valor => { if (ativo) setLista(valor); }).catch(erroRecebido => {
      if (ativo) setErroLista(erroRecebido instanceof ErroEntradaPedidos ? erroRecebido.message : 'Não foi possível consultar os pedidos.');
    }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [repo, tentativaLista]);

  function confirmar(valor: PedidoEntrada) {
    setRecibo(valor);
    setErro(null);
    setConsultaId(valor.request_id);
    try { guardarUltimoPedido(identidade, valor.request_id, sessionStorage); } catch { /* O recibo confirmado continua visível. */ }
    try {
      apagarPedidoPendente(identidade, sessionStorage);
      setPendente(null);
    } catch { setErroLocal('O pedido foi confirmado, mas este navegador não permitiu limpar o recibo local.'); }
    setTentativaLista(n => n + 1);
  }
  async function enviar() {
    if (!repo || trava.current || erroLocal || recibo) return;
    if (!pendente && (!texto.trim() || texto.length > LIMITE_TEXTO_PEDIDO)) {
      setErro('Escreva o que você precisa antes de registrar o pedido.');
      return;
    }
    trava.current = true;
    setEnviando(true);
    setErro(null);
    let envio = pendente;
    if (!envio) {
      try {
        envio = { requestId: crypto.randomUUID(), eventoId: `site:${crypto.randomUUID()}`, texto: texto.trim() };
        salvarPedidoPendente(identidade, envio, sessionStorage);
        setPendente(envio);
      } catch {
        setErroLocal('Este navegador não permitiu guardar um recibo seguro. Nenhum pedido foi enviado.');
        trava.current = false;
        setEnviando(false);
        return;
      }
    }
    try {
      const valor = await repo.receber(envio);
      if (vivo.current) confirmar(valor);
    } catch (falha) {
      try {
        const valor = await repo.ler(envio.requestId);
        if (vivo.current) {
          if (valor?.eventos.some(evento => evento.origem === 'SITE' && evento.evento_id === envio.eventoId && evento.texto === envio.texto)) confirmar(valor);
          else setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Ainda não foi possível confirmar o recebimento desta mensagem.');
        }
      } catch {
        if (vivo.current) setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Ainda não foi possível confirmar o recebimento desta mensagem.');
      }
    } finally {
      if (vivo.current) { trava.current = false; setEnviando(false); }
    }
  }
  async function consultarPedido() {
    if (!repo || travaConsulta.current) return;
    const id = consultaId.trim().toLowerCase();
    setConsultado(null);
    setErroConsulta(null);
    if (!uuidValido(id)) { setErroConsulta('Informe o número completo de acompanhamento do pedido.'); return; }
    travaConsulta.current = true;
    setConsultando(true);
    try {
      const valor = await repo.ler(id);
      if (vivo.current) {
        setConsultado(valor);
        if (!valor) setErroConsulta('Pedido não encontrado para esta conta.');
      }
    } catch (falha) {
      if (vivo.current) setErroConsulta(falha instanceof ErroEntradaPedidos ? falha.message : 'Não foi possível consultar este acompanhamento.');
    } finally {
      if (vivo.current) { travaConsulta.current = false; setConsultando(false); }
    }
  }

  return <section aria-label="Entrada de pedidos" className="rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 className="text-xl font-semibold">O que você precisa fazer?</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Descreva o trabalho com suas palavras. O pedido ficará registrado para triagem; a execução começa depois que o plano estiver preparado e confirmado.</p>
    {erroLocal && <p role="alert" className="mt-3 text-sm text-destructive">{erroLocal}</p>}
    {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
    {!repo && <button type="button" onClick={() => setTentativa(n => n + 1)} className="min-h-11 mt-2 text-sm font-semibold underline">Tentar conectar pedidos</button>}
    {recibo ? <div role="status" className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
      <p className="font-semibold">Pedido registrado para triagem</p>
      <p className="mt-2 break-all">Acompanhamento: {recibo.request_id}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{recibo.texto_inicial}</p>
      <p className="mt-2 text-muted-foreground">Aguardando preparar o plano. Nenhum trabalho foi executado por este recebimento.</p>
      <button type="button" disabled={!!erroLocal} onClick={() => { setRecibo(null); setTexto(''); }} className="min-h-11 mt-2 font-semibold underline disabled:opacity-50">Escrever outro pedido</button>
    </div> : <form className="mt-4" onSubmit={evento => { evento.preventDefault(); void enviar(); }}>
      <label htmlFor="pedido-livre-helena" className="block text-sm font-medium">Seu pedido</label>
      <textarea id="pedido-livre-helena" rows={4} maxLength={LIMITE_TEXTO_PEDIDO} value={texto}
        disabled={enviando || !!pendente || !!erroLocal}
        onChange={evento => { setTexto(evento.target.value); setErro(null); }}
        placeholder="Ex.: preparar os textos de uma campanha para a empresa…"
        aria-describedby="pedido-livre-ajuda" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
      <p id="pedido-livre-ajuda" className="mt-1 text-xs text-muted-foreground">Até 10.000 caracteres. Inclua a empresa e o resultado esperado, se souber.</p>
      {pendente && <p role="status" className="mt-3 text-sm">Existe um envio aguardando confirmação. Recuperar reutiliza o mesmo identificador para evitar um pedido duplicado.</p>}
      <button type="submit" disabled={!repo || enviando || !!erroLocal || (!pendente && !texto.trim())}
        className="min-h-11 mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
        {enviando ? 'Confirmando recebimento…' : pendente ? 'Recuperar pedido' : 'Registrar pedido'}
      </button>
    </form>}
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Pedidos em triagem</h3>
        <button type="button" disabled={!repo || carregando} onClick={() => setTentativaLista(n => n + 1)} className="min-h-11 text-sm font-semibold underline disabled:opacity-50">Atualizar pedidos</button>
      </div>
      {carregando && <p className="mt-2 text-sm text-muted-foreground">Consultando pedidos…</p>}
      {erroLista && <p role="alert" className="mt-2 text-sm text-destructive">{erroLista}</p>}
      {!carregando && !erroLista && lista?.itens.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido em triagem.</p>}
      {!erroLista && !!lista?.itens.length && <>
        <p className="mt-1 text-xs text-muted-foreground">Até {lista.limite} pedidos mais recentes.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.itens.map(pedido => <li key={pedido.pedido_id} className="min-w-0 rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold">Recebido · aguardando plano</p>
          <p className="mt-2 whitespace-pre-wrap break-words">{pedido.texto_inicial}</p>
          <p className="mt-3 break-all text-xs text-muted-foreground">Acompanhamento: {pedido.request_id}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pedido.total_eventos} {pedido.total_eventos === 1 ? 'mensagem' : 'mensagens'} · Canal informado: {{ SITE: 'Site', CODEX: 'Codex', TELEGRAM: 'Telegram' }[pedido.origem_inicial]}</p>
        </li>)}</ul>
      </>}
    </div>
    <div className="mt-5 border-t border-border pt-4">
      <form onSubmit={evento => { evento.preventDefault(); void consultarPedido(); }}>
        <label htmlFor="consulta-pedido-helena" className="block text-sm font-semibold">Consultar acompanhamento</label>
        <p className="mt-1 text-xs text-muted-foreground">Use o número do recibo para encontrar um pedido, inclusive os mais antigos.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input id="consulta-pedido-helena" value={consultaId} maxLength={36} disabled={consultando}
            onChange={evento => { setConsultaId(evento.target.value); setErroConsulta(null); setConsultado(null); }}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            autoCapitalize="none" autoComplete="off" spellCheck={false} />
          <button type="submit" disabled={!repo || consultando} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-50">{consultando ? 'Consultando…' : 'Consultar pedido'}</button>
        </div>
      </form>
      {erroConsulta && <p role="alert" className="mt-2 text-sm text-destructive">{erroConsulta}</p>}
      {consultado && <article aria-label="Histórico do pedido" className="mt-3 rounded-lg border border-border p-4 text-sm">
        <p className="font-semibold">Recebido · aguardando plano</p>
        <p className="mt-2 break-all">Acompanhamento: {consultado.request_id}</p>
        <ol className="mt-3 space-y-3">{consultado.eventos.map((evento, indice) => <li key={`${evento.origem}:${evento.evento_id}`}>
          <p className="text-xs font-semibold text-muted-foreground">Mensagem {indice + 1} · Canal informado: {{ SITE: 'Site', CODEX: 'Codex', TELEGRAM: 'Telegram' }[evento.origem]}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{evento.texto}</p>
        </li>)}</ol>
      </article>}
    </div>
  </section>;
}
