// Catálogo único de rótulos em português para os códigos de estado e motivo dos cards v2.
// O código cru (ESPERANDO_CONFIRMACAO) é o valor do banco e continua nos contratos; só a tela usa o rótulo.
// Código desconhecido nunca é escondido: vira texto legível (sem sublinhado) em vez de enum cru.

export const ROTULOS_ESTADO_CARD: Readonly<Record<string, string>> = {
  RASCUNHO: 'Rascunho', VALIDANDO_PLANO: 'Validando plano', ESPERANDO_CONFIRMACAO: 'Esperando confirmação',
  ESPERANDO_FUNDADOR: 'Esperando fundador', EM_ANDAMENTO: 'Em andamento', PRONTO: 'Pronto',
  CANCELADO: 'Cancelado', ENCERRADO_COM_FALHA: 'Encerrado com falha',
};

const ROTULOS_ESTADO_ETAPA_E_ACAO: Readonly<Record<string, string>> = {
  PRONTA: 'Pronta', APROVADA: 'Aprovada', PROPOSTA: 'Proposta', INCERTA: 'Incerta',
};

const ROTULOS_MOTIVO: Readonly<Record<string, string>> = {
  NENHUM: 'Nenhum', DEPENDENCIA: 'Dependência', NAO_PODE: 'Não pode', PERGUNTA: 'Pergunta', REVISAO: 'Revisão',
  HELENA_FALHOU: 'Helena falhou', VALIDADOR_FALHOU: 'Validador falhou', PLANO_INVALIDO: 'Plano inválido',
};

function legivel(codigo: string): string {
  const texto = codigo.replace(/_/g, ' ').trim().toLowerCase();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : codigo;
}

export function rotuloEstado(codigo: string): string {
  return ROTULOS_ESTADO_CARD[codigo] ?? ROTULOS_ESTADO_ETAPA_E_ACAO[codigo] ?? legivel(codigo);
}

export function rotuloMotivo(codigo: string): string {
  return ROTULOS_MOTIVO[codigo] ?? legivel(codigo);
}
