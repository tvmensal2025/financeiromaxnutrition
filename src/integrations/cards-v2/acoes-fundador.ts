import type { AcaoExternaV2, CardV2, EtapaV2, EventoFundadorV2 } from './repository';

export type AlvoFundadorV2 = { maquina: EventoFundadorV2['maquina']; id: string; versao: number;
  estado: string; motivo?: string; temFerramenta?: boolean };
export type OpcaoFundadorV2 = { rotulo: string; evento: EventoFundadorV2['evento']; parametros: Record<string, string>;
  cautela?: string };
const opcao = (rotulo: string, evento: OpcaoFundadorV2['evento'], parametros: Record<string, string> = {}, cautela?: string): OpcaoFundadorV2 =>
  ({ rotulo, evento, parametros, cautela });
const motivos = [
  ['ERRO_DE_FATO', 'Erro de fato'], ['FALTOU_TEMA', 'Faltou tema'], ['TOM', 'Tom'], ['FORMATO', 'Formato'],
] as const;
const ajustes = () => motivos.map(([valor, rotulo]) => opcao(`Pedir ajuste: ${rotulo}`, 'PEDIR_AJUSTE', { motivo_ajuste: valor },
  'O ajuste pode reabrir etapas ou criar um card ligado, conforme o estado e os limites do roteiro.'));
const resposta = (rotulo: string, valor: string, cautela?: string) => opcao(rotulo, 'RESPONDER', { opcao: valor }, cautela);

/** A tela só oferece alternativas descritas pelas passagens; o banco ainda decide sob lock. */
export function opcoesFundador(alvo: AlvoFundadorV2): OpcaoFundadorV2[] {
  if (!Number.isSafeInteger(alvo.versao) || alvo.versao < 1) return [];
  if (alvo.maquina === 'card') {
    const opcoes: OpcaoFundadorV2[] = [];
    if (alvo.estado === 'ESPERANDO_CONFIRMACAO' && ['NENHUM', 'HELENA_FALHOU', 'VALIDADOR_FALHOU'].includes(alvo.motivo ?? ''))
      opcoes.push(resposta('Confirmo o pedido', 'CONFIRMO', 'O card seguirá para a validação do plano. Esta confirmação não aprova entregas.'));
    if (['EM_ANDAMENTO', 'ESPERANDO_FUNDADOR', 'PRONTO'].includes(alvo.estado)) opcoes.push(...ajustes());
    if (alvo.estado === 'ESPERANDO_FUNDADOR') {
      if (alvo.motivo === 'DEPENDENCIA') opcoes.push(resposta('Pular falhas, se permitido pelo roteiro', 'PULAR'), resposta('Refazer falhas', 'REFAZER'));
      if (alvo.motivo === 'NAO_PODE') opcoes.push(resposta('Refazer peças julgadas', 'REFAZER'));
      if (['DEPENDENCIA', 'NAO_PODE'].includes(alvo.motivo ?? '')) opcoes.push(resposta('Encerrar com falha', 'ENCERRAR'));
    }
    if (alvo.estado === 'PRONTO') opcoes.push(opcao('Registrar minha aprovação', 'APROVAR', {}, 'O banco conferirá as fontes atuais antes de registrar a aprovação.'));
    if (['RASCUNHO', 'ESPERANDO_CONFIRMACAO', 'VALIDANDO_PLANO', 'EM_ANDAMENTO', 'ESPERANDO_FUNDADOR'].includes(alvo.estado))
      opcoes.push(opcao('Cancelar card', 'CANCELAR', {}, 'Esta decisão encerra o card e cancela suas etapas.'));
    return opcoes;
  }
  if (alvo.maquina === 'etapa') {
    if (alvo.estado === 'APROVADA') return ajustes();
    if (alvo.estado !== 'ESPERANDO_FUNDADOR') return [];
    switch (alvo.motivo) {
      case 'REVISAO': return [opcao('Aprovar etapa', 'APROVAR', {}, 'O banco relerá as fontes atuais; uma aprovação pode devolver uma peça jurídica para ajuste.'), ...ajustes()];
      case 'PERGUNTA': return ['A', 'B', 'C'].map(letra => resposta(`Responder ${letra}`, `RESPOSTA_${letra}`));
      case 'RESOLUCAO': return [resposta('Refazer etapa', 'REFAZER'), resposta('Seguir sem etapa, se permitido', 'SEGUIR_SEM'), resposta('Encerrar com falha', 'ENCERRAR')];
      case 'INFRA': return [resposta('Esperar e tentar novamente', 'ESPERAR'), resposta('Usar modelo menor', 'MODELO_MENOR'), resposta('Encerrar com falha', 'ENCERRAR')];
      default: return [];
    }
  }
  if (alvo.estado === 'PROPOSTA') return [
    ...(alvo.temFerramenta ? [opcao('Autorizar ação externa', 'APROVAR', {}, 'Este toque só registra a autorização; não executa a ação agora. O banco relerá as fontes atuais.')] : []),
    resposta('Registrar que fiz pessoalmente', 'FEITO_POR_MIM'), opcao('Recusar ação externa', 'CANCELAR'),
  ];
  if (alvo.estado === 'AUTORIZADA') return [opcao('Cancelar ação autorizada', 'CANCELAR')];
  if (alvo.estado === 'INCERTA') return [resposta('Confirmar que aconteceu', 'ACONTECEU'), resposta('Confirmar que não aconteceu', 'NAO_ACONTECEU')];
  return [];
}

export const alvoCard = (card: CardV2): AlvoFundadorV2 => ({ maquina: 'card', id: card.id, versao: card.versao ?? 0,
  estado: card.estado, motivo: card.motivo });
export const alvoEtapa = (etapa: EtapaV2): AlvoFundadorV2 => ({ maquina: 'etapa', id: etapa.id, versao: etapa.versao,
  estado: etapa.estado, motivo: etapa.motivo });
export const alvoAcao = (acao: AcaoExternaV2): AlvoFundadorV2 => ({ maquina: 'acao_externa', id: acao.id, versao: acao.versao,
  estado: acao.estado, temFerramenta: acao.tem_ferramenta });

/** Só o resumo criptográfico do toque é guardado para conferir uma retomada. */
export async function impressaoDoToque(evento: Omit<EventoFundadorV2, 'toque'>, identidade: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador não oferece criptografia segura para registrar decisões. Use HTTPS.');
  const parametros = Object.fromEntries(Object.entries(evento.parametros).sort(([a], [b]) => a.localeCompare(b)));
  const bytes = new TextEncoder().encode(JSON.stringify({ identidade, ...evento, parametros }));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), parte => parte.toString(16).padStart(2, '0')).join('');
}
