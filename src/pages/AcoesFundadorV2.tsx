import { useEffect, useRef, useState } from 'react';
import { ExecutiveConfirmDialog } from '@/components/executive/ExecutiveConfirmDialog';
import { ErroBancoCardsV2, type EventoFundadorV2, type RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import { impressaoDoToque, opcoesFundador, type AlvoFundadorV2 } from '@/integrations/cards-v2/acoes-fundador';
import { lerToquePendente, limparToquePendente, salvarToquePendente, type ToquePendente } from '@/integrations/cards-v2/toque-pendente';

type Props = { alvo: AlvoFundadorV2; identidade: string; cardId: string; repositorio: RepositorioCardsV2;
  onAtualizar: () => Promise<void>; opcoesPermitidas?: string[]; bloquearConfirmo?: boolean };

export function AcoesFundadorV2({ alvo, identidade, cardId, repositorio, onAtualizar, opcoesPermitidas, bloquearConfirmo = false }: Props) {
  const opcoes = opcoesFundador(alvo).filter(opcao => (!opcoesPermitidas || opcoesPermitidas.includes(opcao.parametros.opcao))
    && !(bloquearConfirmo && opcao.parametros.opcao === 'CONFIRMO'));
  const [indice, setIndice] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, setPendente] = useState<EventoFundadorV2 | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [pendenciaSalva, setPendenciaSalva] = useState<ToquePendente | 'INVALIDA' | null>(() => {
    try { return lerToquePendente(identidade, alvo.maquina, alvo.id, cardId); } catch { return 'INVALIDA'; }
  });
  const [consultaConcluida, setConsultaConcluida] = useState(!pendenciaSalva);
  const [tentativaConsulta, setTentativaConsulta] = useState(0);
  const recuperadaNoInicio = useRef(!!pendenciaSalva);
  const envioEmCurso = useRef(false);
  const escolhida = indice === '' ? null : opcoes[Number(indice)] ?? null;

  useEffect(() => {
    if (!recuperadaNoInicio.current || !pendenciaSalva || pendenciaSalva === 'INVALIDA') return;
    let ativo = true;
    setConsultaConcluida(false);
    repositorio.consultarToqueFundador(cardId, pendenciaSalva.toque).then(registro => {
      if (!ativo) return;
      if (registro) {
        limparToquePendente(identidade, alvo.maquina, alvo.id);
        recuperadaNoInicio.current = false;
        setPendenciaSalva(null);
        setEstado(`Toque anterior ${registro.resultado} registrado em ${registro.momento}. Estado consultado no banco.`);
        void onAtualizar().catch(() => setErro('O toque anterior consta no banco; atualize o card para ver o estado atual.'));
      } else {
        setErro('O toque anterior ainda não consta no histórico. Reescolha exatamente a mesma decisão para retomar com o mesmo toque.');
      }
      setConsultaConcluida(true);
    }).catch(() => { if (ativo) { setConsultaConcluida(false); setErro('Não foi possível consultar o toque anterior. Consulte novamente antes de outra decisão.'); } });
    return () => { ativo = false; };
  }, [repositorio, cardId, identidade, alvo.maquina, alvo.id, pendenciaSalva, tentativaConsulta]);

  if (!opcoes.length && !pendenciaSalva) return null;

  async function enviar() {
    if (envioEmCurso.current || pendenciaSalva === 'INVALIDA' || !consultaConcluida || (!pendente && !escolhida)) return;
    envioEmCurso.current = true;
    setConfirmando(false);
    setEnviando(true);
    setErro(null);
    setEstado(null);
    let evento: EventoFundadorV2;
    try {
      if (!identidade) throw new Error('Identidade autenticada indisponível. Entre novamente antes de decidir.');
      if (pendente) evento = pendente;
      else {
        const semToque = { maquina: alvo.maquina, alvo: alvo.id, evento: escolhida!.evento,
          parametros: escolhida!.parametros, versaoVista: escolhida!.evento === 'CANCELAR' ? null : alvo.versao };
        const impressao = await impressaoDoToque(semToque, identidade);
        if (pendenciaSalva && pendenciaSalva.impressao !== impressao) throw new Error('Esta escolha difere da decisão pendente. Selecione a mesma ação original.');
        const toque = pendenciaSalva?.toque ?? globalThis.crypto.randomUUID();
        evento = { ...semToque, toque };
        if (!pendenciaSalva) {
          const nova = { cardId, toque, impressao };
          salvarToquePendente(identidade, alvo.maquina, alvo.id, nova);
          setPendenciaSalva(nova);
        }
      }
    } catch (falha) {
      envioEmCurso.current = false;
      setEnviando(false);
      setErro(falha instanceof Error ? falha.message : 'Não foi possível guardar o toque desta decisão nesta sessão.');
      return;
    }
    setPendente(evento);
    try {
      const resposta = await repositorio.aplicarEventoFundador(evento);
      const repetido = resposta.resultado === 'REPETIDO'
        ? await repositorio.consultarToqueFundador(cardId, evento.toque) : null;
      if (resposta.resultado === 'REPETIDO' && !repetido) throw new Error('O banco relatou repetição, mas o histórico deste toque não pôde ser confirmado.');
      await onAtualizar();
      limparToquePendente(identidade, alvo.maquina, alvo.id);
      setPendenciaSalva(null);
      setPendente(null);
      setIndice('');
      setEstado(repetido ? `Este toque já constava no histórico: ${repetido.resultado}, em ${repetido.momento}. Estado relido do banco.`
        : resposta.resultado === 'APLICADO' ? 'Ação registrada. Estado relido do banco.'
          : resposta.resultado === 'REACAO' ? 'Reação registrada no histórico. Estado relido do banco.'
            : resposta.resultado === 'COMENTARIO_NO_CARD' ? 'A versão mudou antes da decisão: o toque ficou como comentário, sem aplicar a ação. Estado relido do banco.'
              : resposta.resultado === 'CARD_NOVO_LIGADO' ? 'O banco registrou a decisão e abriu um card ligado. Atualize a lista para acompanhar.'
            : `Resposta do banco: ${resposta.resultado}. Estado relido; confira antes de continuar.`);
    } catch (falha) {
      const definitiva = falha instanceof ErroBancoCardsV2 && /^[0-9A-Z]{5}$/.test(falha.codigo ?? '');
      if (definitiva) {
        try {
          await onAtualizar();
          limparToquePendente(identidade, alvo.maquina, alvo.id);
          setPendenciaSalva(null);
          setPendente(null);
          setIndice('');
        } catch { /* Mantém o toque até ser possível reler o estado. */ }
      }
      setErro(definitiva ? 'O banco recusou a ação ou a versão ficou antiga. O estado foi consultado quando possível; escolha novamente após atualizar.'
        : 'Não foi possível confirmar o resultado. Tente novamente com o mesmo toque; não escolha outra ação enquanto a situação estiver incerta.');
    } finally { envioEmCurso.current = false; setEnviando(false); }
  }

  return <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
    <label className="block font-semibold">Decisão do fundador
      <select value={indice} onChange={evento => { setIndice(evento.target.value); setErro(null); setEstado(null); }} disabled={enviando || !!pendente || pendenciaSalva === 'INVALIDA' || !consultaConcluida}
        className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal">
        <option value="">Escolha uma ação</option>
        {opcoes.map((opcao, i) => <option key={`${opcao.evento}-${JSON.stringify(opcao.parametros)}`} value={i}>{opcao.rotulo}</option>)}
      </select>
    </label>
    {escolhida?.cautela && <p className="mt-2 text-xs text-muted-foreground">{escolhida.cautela}</p>}
    {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
    {pendenciaSalva === 'INVALIDA' && <p role="alert" className="mt-3 text-sm text-destructive">Metadados do toque anterior inválidos. Confirme a situação no banco antes de outra decisão.</p>}
    {pendenciaSalva && pendenciaSalva !== 'INVALIDA' && !consultaConcluida && <button type="button" onClick={() => setTentativaConsulta(n => n + 1)}
      className="mt-3 min-h-11 font-semibold underline">Consultar toque anterior novamente</button>}
    {estado && <p role="status" className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">{estado}</p>}
    <button type="button" disabled={enviando || pendenciaSalva === 'INVALIDA' || !consultaConcluida || (!pendente && !escolhida)} onClick={() => pendente ? void enviar() : setConfirmando(true)}
      className="mt-3 min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">
      {enviando ? 'Consultando o banco…' : pendente ? 'Tentar novamente o mesmo toque' : pendenciaSalva ? 'Revisar retomada do mesmo toque' : 'Revisar decisão'}
    </button>
    <ExecutiveConfirmDialog open={confirmando} onOpenChange={setConfirmando}
      title="Confirmar decisão no card" description={`Você escolheu: ${escolhida?.rotulo ?? ''}. ${pendenciaSalva ? 'Esta retomada usa o toque anterior somente se a decisão for idêntica. ' : ''}O banco verifica permissão, estado e versão antes de aplicar.`}
      confirmLabel="Confirmar decisão" danger={escolhida?.evento === 'CANCELAR' || escolhida?.parametros.opcao === 'ENCERRAR'}
      onConfirm={() => void enviar()} />
  </div>;
}
