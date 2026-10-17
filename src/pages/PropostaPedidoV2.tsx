import { useEffect, useRef, useState } from 'react';
import { ErroEntradaPedidos, LIMITE_TEXTO_PEDIDO, type DetalhePedidoEntrada, type EnvioPedido,
  type LeituraPropostaPedido, type PedidoEntrada, type RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';
import { apagarEsclarecimentoPendente, lerEsclarecimentoPendente, salvarEsclarecimentoPendente } from '@/integrations/pedidos-v2/pendente';

type Props = { identidade: string; requestId: string; repositorio: RepositorioPedidosV2;
  aoAtualizar: (pedido: PedidoEntrada) => void };

export function PropostaPedidoV2({ identidade, requestId, repositorio, aoAtualizar }: Props) {
  const [leitura, setLeitura] = useState<LeituraPropostaPedido | null>(null);
  const [detalhe, setDetalhe] = useState<DetalhePedidoEntrada | null>(null);
  const [pendente, setPendente] = useState<EnvioPedido | null>(null);
  const [resposta, setResposta] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const trava = useRef(false);
  const vivo = useRef(true);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    try {
      const envio = lerEsclarecimentoPendente(identidade, requestId, sessionStorage);
      setPendente(envio);
      if (envio) setResposta(envio.texto);
    } catch {
      setErroLocal('Não foi possível recuperar uma resposta pendente deste navegador. Consulte o histórico antes de responder novamente.');
    }
  }, [identidade, requestId]);
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([repositorio.lerProposta(requestId), repositorio.ler(requestId)]).then(([proposta, pedido]) => {
      if (ativo) {
        setLeitura(proposta);
        setDetalhe(pedido);
        if (!proposta || !pedido) setErro('Pedido não encontrado para esta conta.');
        else aoAtualizar(pedido);
      }
    }).catch(falha => {
      if (ativo) setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Não foi possível consultar a proposta deste pedido.');
    }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [repositorio, requestId, revisao, aoAtualizar]);

  function limparPendente() {
    try {
      apagarEsclarecimentoPendente(identidade, requestId, sessionStorage);
      setPendente(null);
      setResposta('');
    } catch { setErroLocal('A resposta chegou ao banco, mas este navegador não permitiu limpar o recibo local.'); }
  }
  async function enviarResposta() {
    if (trava.current || erroLocal || !leitura || leitura.estado !== 'RECEBIDO') return;
    if (!pendente && (!resposta.trim() || resposta.length > LIMITE_TEXTO_PEDIDO)) {
      setErro('Escreva uma resposta com até 10.000 caracteres.');
      return;
    }
    trava.current = true;
    setOcupado(true);
    setErro(null);
    let envio = pendente;
    if (!envio) {
      try {
        envio = { requestId, eventoId: `site:esclarecimento:${crypto.randomUUID()}`, texto: resposta.trim() };
        salvarEsclarecimentoPendente(identidade, envio, sessionStorage);
        setPendente(envio);
      } catch {
        setErroLocal('Este navegador não permitiu guardar um recibo seguro. A resposta não foi enviada.');
        trava.current = false;
        setOcupado(false);
        return;
      }
    }
    try {
      const recebido = await repositorio.receber(envio);
      if (vivo.current) {
        limparPendente();
        aoAtualizar(recebido);
        setLeitura(null);
        setRevisao(n => n + 1);
      }
    } catch (falha) {
      try {
        const pedido = await repositorio.ler(requestId);
        if (vivo.current && pedido?.eventos.some(evento => evento.origem === 'SITE'
            && evento.evento_id === envio.eventoId && evento.texto === envio.texto)) {
          limparPendente();
          aoAtualizar(pedido);
          setLeitura(null);
          setRevisao(n => n + 1);
        } else if (vivo.current) setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Ainda não foi possível confirmar esta resposta.');
      } catch {
        if (vivo.current) setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Ainda não foi possível confirmar esta resposta.');
      }
    } finally {
      if (vivo.current) { trava.current = false; setOcupado(false); }
    }
  }
  async function confirmar() {
    const proposta = leitura?.proposta_helena;
    if (trava.current || pendente || erroLocal || leitura?.estado !== 'RECEBIDO'
        || proposta?.tipo !== 'PROPOR' || !proposta.atual || proposta.validacao_metadados?.bloqueio) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      const confirmado = await repositorio.confirmarProposta(requestId, proposta.id);
      if (vivo.current) {
        aoAtualizar(confirmado);
        setRevisao(n => n + 1);
      }
    } catch (falha) {
      try {
        const pedido = await repositorio.ler(requestId);
        if (vivo.current && pedido && pedido.estado !== 'RECEBIDO') {
          aoAtualizar(pedido);
          setRevisao(n => n + 1);
        } else if (vivo.current) {
          setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Não foi possível confirmar esta proposta.');
          setRevisao(n => n + 1);
        }
      } catch {
        if (vivo.current) setErro(falha instanceof ErroEntradaPedidos ? falha.message : 'Não foi possível confirmar esta proposta.');
      }
    } finally {
      if (vivo.current) { trava.current = false; setOcupado(false); }
    }
  }

  const proposta = leitura?.proposta_helena;
  const podeResponder = leitura?.estado === 'RECEBIDO' && !erroLocal;
  return <section aria-label="Proposta do pedido" className="mt-4 rounded-lg border border-border p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Proposta e esclarecimentos</h3>
      <button type="button" disabled={carregando || ocupado} onClick={() => { setErro(null); setRevisao(n => n + 1); }}
        className="min-h-11 font-semibold underline disabled:opacity-50">Atualizar proposta</button>
    </div>
    {carregando && <p role="status" className="mt-2 text-muted-foreground">Consultando a proposta…</p>}
    {erro && <p role="alert" className="mt-2 text-destructive">{erro}</p>}
    {erroLocal && <p role="alert" className="mt-2 text-destructive">{erroLocal}</p>}
    {!carregando && leitura && !proposta && <p className="mt-2 text-muted-foreground">A Helena ainda não preparou uma proposta para este pedido.</p>}
    {proposta && <div className="mt-3 space-y-3">
      <p className="whitespace-pre-wrap break-words">{proposta.resumo}</p>
      {!proposta.atual && leitura?.estado === 'RECEBIDO' && <p role="status" className="font-semibold text-amber-800 dark:text-amber-300">Esta proposta ficou desatualizada. Aguarde uma nova leitura da Helena antes de confirmar.</p>}
      {proposta.tipo === 'PERGUNTAR' && <div>
        <p className="font-semibold">Pontos a esclarecer</p>
        <ul className="mt-1 list-inside list-disc space-y-1">{proposta.perguntas.map((pergunta, indice) => <li key={indice}>{pergunta}</li>)}</ul>
      </div>}
      {proposta.tipo === 'PROPOR' && proposta.plano && <div className="space-y-2">
        <p><strong>Empresa:</strong> {proposta.empresa_id}</p>
        <p><strong>Trabalho proposto:</strong> {proposta.titulo}</p>
        <p><strong>Prazo proposto:</strong> {proposta.prazo && new Date(proposta.prazo).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário de Brasília)</p>
        <p><strong>Revisão da configuração:</strong> <span className="break-all">{proposta.config_revision_id}</span></p>
        <div><p className="font-semibold">Serviços e etapas</p>
          <ol className="mt-1 list-inside list-decimal space-y-2">{proposta.plano.etapas.map(etapa => <li key={etapa.id}>
            <span className="font-medium">{etapa.servico}</span> · {etapa.objetivo}
            {etapa.depende_de.length > 0 && <span className="block pl-5 text-xs text-muted-foreground">Depende de: {etapa.depende_de.join(', ')}</span>}
          </li>)}</ol>
        </div>
        <p><strong>Ambiguidades pendentes:</strong> nenhuma apontada nesta proposta.</p>
      </div>}
      {detalhe && <div><p className="font-semibold">Fontes do pedido</p>
        <ol className="mt-1 list-inside list-decimal space-y-1">{detalhe.eventos.map(evento => <li key={`${evento.origem}:${evento.evento_id}`} className="whitespace-pre-wrap break-words">{evento.texto}</li>)}</ol>
      </div>}
    </div>}
    {proposta?.tipo === 'PROPOR' && leitura?.estado === 'RECEBIDO' && <div className="mt-4">
      <p className="text-muted-foreground">Sua confirmação autoriza este plano para a etapa de criação do card. A execução ainda depende do fluxo do Kanban.</p>
      {proposta.validacao_metadados?.bloqueio && <p role="status" className="mt-2 text-amber-800 dark:text-amber-300">
        {proposta.validacao_metadados.bloqueio === 'PEDIDO_FONTE_LEIS_AUSENTE'
          ? 'Falta uma fonte de leis disponível para este serviço. Peça uma alteração ou aguarde nova proposta.'
          : 'Esta proposta depende de ajustes antes de confirmar. Peça uma alteração ou aguarde nova proposta.'}
      </p>}
      <button type="button" disabled={!proposta.atual || !!proposta.validacao_metadados?.bloqueio || !!pendente || ocupado || !!erroLocal || carregando}
        onClick={() => void confirmar()} className="min-h-11 mt-2 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {ocupado ? 'Confirmando…' : 'Confirmar esta proposta'}
      </button>
    </div>}
    {podeResponder && <form className="mt-4 border-t border-border pt-3" onSubmit={evento => { evento.preventDefault(); void enviarResposta(); }}>
      <label htmlFor={`resposta-${requestId}`} className="font-semibold">Responder ou pedir alteração</label>
      <textarea id={`resposta-${requestId}`} rows={3} maxLength={LIMITE_TEXTO_PEDIDO} value={resposta}
        onChange={evento => { setResposta(evento.target.value); setErro(null); }} disabled={ocupado || !!pendente}
        placeholder="Explique o que falta ou qual parte deve mudar."
        className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 disabled:opacity-60" />
      {pendente && <p role="status" className="mt-2">Há uma resposta aguardando confirmação. Recuperar usa o mesmo identificador para evitar duplicidade.</p>}
      <button type="submit" disabled={ocupado || carregando || (!pendente && !resposta.trim())}
        className="min-h-11 mt-2 rounded-lg border border-border px-4 font-semibold disabled:opacity-50">
        {ocupado ? 'Confirmando resposta…' : pendente ? 'Recuperar resposta' : 'Enviar resposta ou alteração'}
      </button>
    </form>}
  </section>;
}
