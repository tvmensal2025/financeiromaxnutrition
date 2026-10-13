import { useEffect, useState } from 'react';
import type { CardV2, LeituraCardFundadorV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import { alvoCard } from '@/integrations/cards-v2/acoes-fundador';
import { AcoesFundadorV2 } from './AcoesFundadorV2';

type Props = { card: CardV2; identidade: string; pedidoOriginalDisponivel: boolean;
  repositorio: RepositorioCardsV2; onAtualizar: () => Promise<void> };

function leituraComprovada(dado: LeituraCardFundadorV2 | null, card: CardV2): dado is LeituraCardFundadorV2 {
  if (!dado || dado.card_id !== card.id || dado.versao !== card.versao || dado.motivo_atual !== card.motivo
      || !Number.isSafeInteger(dado.historico_id) || dado.historico_id < 1
      || !Number.isSafeInteger(dado.chave) || dado.chave < 1
      || typeof dado.momento !== 'string' || Number.isNaN(Date.parse(dado.momento))) return false;
  const leitura = dado.leitura_de_volta;
  if (typeof leitura === 'string') return !!leitura.trim();
  return !!leitura && typeof leitura === 'object' && !Array.isArray(leitura)
    && typeof leitura.o_que_quer === 'string' && !!leitura.o_que_quer.trim()
    && Array.isArray(leitura.como_e_o_pronto) && leitura.como_e_o_pronto.length >= 1
    && leitura.como_e_o_pronto.length <= 5 && leitura.como_e_o_pronto.every(texto => typeof texto === 'string' && !!texto.trim())
    && Array.isArray(leitura.nao_pode) && leitura.nao_pode.every(texto => typeof texto === 'string' && !!texto.trim());
}

export function LeituraCardFundadorV2({ card, identidade, pedidoOriginalDisponivel, repositorio, onAtualizar }: Props) {
  const [leitura, setLeitura] = useState<LeituraCardFundadorV2 | null>(null);
  const [carregando, setCarregando] = useState(card.motivo !== 'HELENA_FALHOU');
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const requerLeitura = card.estado === 'ESPERANDO_CONFIRMACAO'
    && (card.motivo === 'NENHUM' || card.motivo === 'VALIDADOR_FALHOU');

  useEffect(() => {
    if (!requerLeitura) { setCarregando(false); setLeitura(null); return; }
    let ativo = true;
    setLeitura(null);
    setErro(null);
    setCarregando(true);
    repositorio.lerLeituraCardFundador(card.id).then(dado => {
      if (!ativo) return;
      if (leituraComprovada(dado, card)) setLeitura(dado);
      else setErro('A leitura de volta da Helena não foi comprovada para a versão atual. Confirmação indisponível.');
    }).catch(() => { if (ativo) setErro('Não foi possível consultar a leitura de volta da Helena. Confirmação indisponível.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [repositorio, card.id, card.versao, card.motivo, requerLeitura, tentativa]);

  if (card.estado !== 'ESPERANDO_CONFIRMACAO' || (!requerLeitura && card.motivo !== 'HELENA_FALHOU')) return <AcoesFundadorV2 alvo={alvoCard(card)} identidade={identidade}
    cardId={card.id} repositorio={repositorio} onAtualizar={onAtualizar} />;

  return <section aria-label="Conferência do pedido" className="mt-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
    <h3 className="font-semibold">Antes de confirmar o pedido</h3>
    {!pedidoOriginalDisponivel && <p role="alert" className="mt-2 text-destructive">O pedido original não está disponível para conferência. Confirmação indisponível.</p>}
    {card.motivo === 'HELENA_FALHOU' && <p className="mt-2" role="status">Helena não concluiu a leitura de volta. Confira manualmente os campos disponíveis do pedido registrado acima, inclusive prazo, critérios, restrições e fontes quando constarem. Sua confirmação é uma nova ordem sua para validar o plano; não comprova análise da Helena.</p>}
    {card.motivo === 'VALIDADOR_FALHOU' && <p className="mt-2">A validação do plano falhou. A leitura abaixo é a interpretação original da Helena, registrada antes da confirmação anterior; não é uma nova análise.</p>}
    {carregando && <p className="mt-2" role="status">Consultando leitura de volta registrada…</p>}
    {erro && <div className="mt-2" role="alert"><p>{erro}</p><button type="button" onClick={() => setTentativa(n => n + 1)} className="mt-2 min-h-11 font-semibold underline">Consultar leitura novamente</button></div>}
    {leitura && <div className="mt-3 rounded-lg border border-border bg-background p-4">
      <h4 className="font-semibold">Leitura de volta registrada pela Helena</h4>
      {typeof leitura.leitura_de_volta === 'string'
        ? <p className="mt-2 whitespace-pre-wrap break-words">{leitura.leitura_de_volta}</p>
        : <>
          <p className="mt-2 whitespace-pre-wrap break-words">{leitura.leitura_de_volta.o_que_quer}</p>
          {leitura.leitura_de_volta.como_e_o_pronto.length > 0 && <div className="mt-3"><h5 className="font-medium">Como Helena entendeu o pronto</h5><ul className="list-disc pl-5">{leitura.leitura_de_volta.como_e_o_pronto.map((texto, i) => <li key={i}>{texto}</li>)}</ul></div>}
          {leitura.leitura_de_volta.nao_pode.length > 0 && <div className="mt-3"><h5 className="font-medium">Restrições entendidas</h5><ul className="list-disc pl-5">{leitura.leitura_de_volta.nao_pode.map((texto, i) => <li key={i}>{texto}</li>)}</ul></div>}
        </>}
      {leitura.escolha && <p className="mt-3">Escolha informada pela Helena: {leitura.escolha.tipo === 'SERVICO' ? 'serviço' : 'roteiro'} {leitura.escolha.id}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Registro {leitura.historico_id} · {new Date(leitura.momento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    </div>}
    <AcoesFundadorV2 key={requerLeitura && !leitura ? 'sem-leitura' : 'com-leitura'} alvo={alvoCard(card)} identidade={identidade} cardId={card.id} repositorio={repositorio}
      onAtualizar={onAtualizar} bloquearConfirmo={!pedidoOriginalDisponivel || (requerLeitura && !leitura)} />
  </section>;
}
