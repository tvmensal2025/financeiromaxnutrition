import type { SolicitacaoCardReal } from './repository';

type Objeto = Record<string, unknown>;
const objeto = (valor: unknown): valor is Objeto => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim().length > 0;

export type PreparacaoCardReal = {
  tarefaId: string;
  businessId: string;
  pedidoOriginal: string;
  definicaoDePronto: string | null;
  prazoOriginal: string | null;
  pacoteConfirmado: boolean;
  versaoTarefa: number | null;
  decisoes: { id: string; versao: number }[];
  entradas: { rotulo: string; jobId: string }[];
  pendencias: { campo: string; motivo: string }[];
  fontesInternas: string[];
  proveniencia: Objeto;
  dadosReais: Objeto;
  plano: Objeto;
};

/** Aceita apenas o envelope privado do preparador; a RPC revalida todos os fatos sob lock. */
export function lerPreparacaoCardReal(json: string): PreparacaoCardReal {
  let bruto: unknown;
  try { bruto = JSON.parse(json); } catch { throw new Error('O arquivo não contém JSON válido.'); }
  if (!objeto(bruto) || bruto.estado !== 'AGUARDANDO_CONFIRMACAO' || !texto(bruto.tarefa_id) || !texto(bruto.business_id)) {
    throw new Error('Este não é um arquivo de preparação aguardando confirmação.');
  }
  const dados = bruto.dados_reais;
  if (!objeto(dados) || !objeto(dados.pedido) || !objeto(dados.captura) || !objeto(dados.proveniencia)
      || !Array.isArray(dados.decisoes) || !objeto(dados.entradas_externas) || !objeto(dados.fontes_importadas)) {
    throw new Error('A preparação não contém pedido, captura e proveniência completos.');
  }
  const pedido = dados.pedido;
  const captura = dados.captura;
  if (!objeto(pedido.ordem_de_servico) || !objeto(pedido.plano) || !objeto(pedido.pacote_da_empresa)
      || !objeto(captura.tarefa) || !objeto(captura.empresa) || !objeto(captura.proveniencia)
      || !objeto(captura.projeto)) {
    throw new Error('A preparação não contém os campos necessários para revisar o pedido.');
  }
  const ordem = pedido.ordem_de_servico;
  const proveniencia = dados.proveniencia;
  const decisoes = dados.decisoes.map(decisao => objeto(decisao) && texto(decisao.id) && Number.isInteger(decisao.versao)
    ? { id: decisao.id, versao: decisao.versao as number } : null);
  const entradas = Object.entries(dados.entradas_externas).map(([rotulo, entrada]) => objeto(entrada) && texto(entrada.job_id)
    ? { rotulo, jobId: entrada.job_id } : null);
  const pendencias = Array.isArray(bruto.pendencias) ? bruto.pendencias.map(item => objeto(item) && texto(item.campo) && texto(item.motivo)
    ? { campo: item.campo, motivo: item.motivo } : null) : null;
  if (captura.fonte !== 'management_read_only'
      || captura.tarefa.task_id !== bruto.tarefa_id
      || captura.tarefa.business_id !== bruto.business_id
      || captura.empresa.business_id !== bruto.business_id
      || captura.business_id !== bruto.business_id
      || pedido.empresa !== bruto.business_id
      || ordem.empresa !== bruto.business_id
      || ordem.pedido_original !== captura.tarefa.tarefa
      || proveniencia.tarefa_id !== bruto.tarefa_id
      || proveniencia.business_id !== bruto.business_id
      || proveniencia.project_ref !== captura.projeto.ref
      || !texto(proveniencia.hash_sha256)
      || !/^[a-f0-9]{64}$/.test(proveniencia.hash_sha256)
      || captura.proveniencia.hash_sha256 !== proveniencia.hash_sha256
      || !texto(ordem.pedido_original) || decisoes.includes(null) || entradas.includes(null) || !pendencias || pendencias.includes(null)) {
    throw new Error('A tarefa, empresa ou proveniência do arquivo não conferem. Gere uma nova preparação.');
  }
  return {
    tarefaId: bruto.tarefa_id,
    businessId: bruto.business_id,
    pedidoOriginal: ordem.pedido_original,
    definicaoDePronto: texto(ordem.definicao_de_pronto_na_fonte) ? ordem.definicao_de_pronto_na_fonte : null,
    prazoOriginal: texto(ordem.prazo) ? ordem.prazo : null,
    pacoteConfirmado: pedido.pacote_da_empresa.estado === 'CONFIRMADO',
    versaoTarefa: Number.isInteger(proveniencia.tarefa_row_version) ? proveniencia.tarefa_row_version as number : null,
    decisoes: decisoes as { id: string; versao: number }[],
    entradas: entradas as { rotulo: string; jobId: string }[],
    pendencias: pendencias as { campo: string; motivo: string }[],
    fontesInternas: Object.keys(dados.fontes_importadas),
    proveniencia,
    dadosReais: dados,
    plano: pedido.plano,
  };
}

export type CriterioConfirmado = { texto: string; quem_confere: 'IA' | ''; risco: 'ALTO' | 'BAIXO' | '' };
export type RevisaoPedidoReal = {
  prazo: string;
  criterios: CriterioConfirmado[];
  restricoes: string;
  semRestricoes: boolean;
  fontes: string;
  semFontes: boolean;
  conferido: boolean;
};

function linhas(textoLivre: string): string[] { return textoLivre.split(/\r?\n/).map(linha => linha.trim()).filter(Boolean); }

function maximoDezAnos(agora: number): number {
  const data = new Date(agora);
  const dia = data.getUTCDate();
  data.setUTCFullYear(data.getUTCFullYear() + 10);
  if (dia === 29 && data.getUTCMonth() === 2) data.setUTCDate(0);
  return data.getTime();
}

export function validarRevisaoPedidoReal(preparacao: PreparacaoCardReal, revisao: RevisaoPedidoReal, agora = Date.now()): string[] {
  const erros: string[] = [];
  if (!preparacao.pacoteConfirmado) erros.push('A identidade da empresa ainda não está confirmada. Atualize a origem e gere outra preparação.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?-03:00$/.test(revisao.prazo)
      || !Number.isFinite(Date.parse(revisao.prazo)) || Date.parse(revisao.prazo) <= agora
      || Date.parse(revisao.prazo) > maximoDezAnos(agora)) {
    erros.push('Informe prazo futuro em ISO 8601 no horário de Brasília (UTC−03:00), dentro de dez anos.');
  }
  if (revisao.criterios.length < 1 || revisao.criterios.length > 5
      || revisao.criterios.some(c => c.texto.trim().length < 3 || c.texto.trim().length > 200 || c.quem_confere !== 'IA' || !['ALTO', 'BAIXO'].includes(c.risco))) {
    erros.push('Confirme de um a cinco critérios de 3 a 200 caracteres, com conferência por IA e risco escolhido.');
  }
  if (new Set(revisao.criterios.map(c => c.texto.trim())).size !== revisao.criterios.length) {
    erros.push('Cada critério precisa ter um texto distinto.');
  }
  const restricoes = linhas(revisao.restricoes);
  if ((!revisao.semRestricoes && restricoes.length === 0) || (revisao.semRestricoes && restricoes.length > 0)
      || restricoes.length > 5 || restricoes.some(item => item.length < 3 || item.length > 200)
      || new Set(restricoes).size !== restricoes.length) {
    erros.push('Confirme até cinco restrições distintas de 3 a 200 caracteres ou marque que não há restrições adicionais.');
  }
  if (restricoes.some(item => revisao.criterios.filter(criterio => criterio.texto.trim() === item && criterio.risco === 'ALTO' && criterio.quem_confere === 'IA').length !== 1)) {
    erros.push('Cada restrição deve aparecer também como critério com o mesmo texto, conferência por IA e risco alto.');
  }
  const fontes = linhas(revisao.fontes);
  if ((!revisao.semFontes && fontes.length === 0) || (revisao.semFontes && fontes.length > 0)
      || fontes.length > 20 || new Set(fontes).size !== fontes.length || fontes.some(fonte => !fonteHttpsPublica(fonte))) {
    erros.push('Confirme até vinte URLs HTTPS públicas, sem credenciais, IP, consulta ou fragmento, ou marque que não há fontes externas.');
  }
  if (!revisao.conferido) erros.push('Confirme que conferiu o pedido original e os dados apresentados.');
  return erros;
}

export function fonteHttpsPublica(valor: string): boolean {
  if (valor.length > 500 || valor.includes('%') || /[\s\\]/.test(valor)) return false;
  try {
    const url = new URL(valor);
    const host = url.hostname.toLowerCase();
    const palavrasDeAcao = new Set('confirmar confirm verificar verify aceitar accept convite invite indicacao ref descadastrar unsubscribe token login signin signup cadastro register checkout pagar pay'.split(' '));
    const caminho = url.pathname.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (caminho.split(/[^a-z0-9]+/).some(palavra => palavrasDeAcao.has(palavra))) return false;
    return /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\/[A-Za-z0-9/._~:@!$&'()*+,;=-]*$/.test(valor)
      && url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && !url.port && url.href === valor && host.includes('.') && !host.endsWith('.')
      && !['localhost', 'local', 'internal', 'lan', 'home.arpa', 'intranet', 'corp', 'private', 'svc', 'localdomain', 'test', 'invalid', 'default'].some(sufixo => host === sufixo || host.endsWith(`.${sufixo}`))
      && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.includes(':');
  } catch { return false; }
}

export function montarSolicitacaoCardReal(preparacao: PreparacaoCardReal, revisao: RevisaoPedidoReal, chaveIdempotencia: string): SolicitacaoCardReal {
  const pedido = preparacao.dadosReais.pedido as Objeto;
  const ordem = pedido.ordem_de_servico as Objeto;
  return {
    tarefaId: preparacao.tarefaId,
    prazo: revisao.prazo,
    plano: preparacao.plano,
    dadosReais: { ...preparacao.dadosReais, pedido: { ...pedido, ordem_de_servico: {
      ...ordem, prazo: revisao.prazo,
      como_e_o_pronto: revisao.criterios.map((criterio, i) => ({ id: `CARD-${i + 1}`, texto: criterio.texto.trim(), quem_confere: 'IA', risco: criterio.risco })),
      nao_pode: linhas(revisao.restricoes), fontes_que_pode_ler: linhas(revisao.fontes),
    } } },
    configRevisionId: null,
    chaveIdempotencia,
  };
}
