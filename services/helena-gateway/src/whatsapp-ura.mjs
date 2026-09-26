/**
 * Identidade do canal WhatsApp, menu URA e auto-resposta.
 *
 * Fonte única: o texto enviado ao cliente e o agent_id do job nascem da
 * mesma tabela de opções. Identidade da empresa vem de variáveis de ambiente
 * (par completo); sem configuração, o canal é neutro e nunca afirma uma marca
 * que não corresponda ao business_id gravado.
 *
 * Os agentes do Sistema Helena só agem quando despachados (Marina / AGT-04).
 * Este módulo não dispara despacho automático — não há caminho sanctioned
 * para isso sem gravar em agent_job_events, o que o webhook não faz.
 */

export const NEUTRAL_BUSINESS_ID = 'UNASSIGNED';
export const NEUTRAL_BRAND_NAME = 'nossa equipe de atendimento';
export const DEFAULT_AUTOREPLY_DEBOUNCE_MS = 60_000;

/**
 * Tabela única de opções do menu URA.
 * Texto ao cliente e agent_id do job DEVEM ler daqui — nunca de literais
 * paralelos. Opção 4: Marina (AGT-04, PMO / triagem executiva), não Helena
 * (AGT-01 opera fora deste sistema e não recebe jobs).
 */
export const URA_MENU_OPTIONS = Object.freeze([
  Object.freeze({
    option: '1',
    area: 'VENDAS',
    title: 'Comercial & Vendas',
    menuHint: 'Planos, produtos e novas assinaturas',
    emoji: '🛒',
    agent_id: 'AGT-15',
    agent_name: 'Victor',
    role: 'Vendas',
    followUp: 'Qual produto ou plano você gostaria de conhecer ou adquirir?'
  }),
  Object.freeze({
    option: '2',
    area: 'ATENDIMENTO',
    title: 'Suporte ao Cliente',
    menuHint: 'Dúvidas, acessos e ajuda com pedidos',
    emoji: '🛠️',
    agent_id: 'AGT-20',
    agent_name: 'Joana',
    role: 'Atendimento',
    followUp: 'Por favor, detalhe sua dúvida ou o que está acontecendo com seu acesso/pedido para agilizarmos a solução.'
  }),
  Object.freeze({
    option: '3',
    area: 'FINANCEIRO',
    title: 'Financeiro & Boletos',
    menuHint: '2ª via, faturas e pagamentos',
    emoji: '💳',
    agent_id: 'AGT-05',
    agent_name: 'Caio',
    role: 'Finanças',
    followUp: 'Por favor, informe seu CPF/CNPJ ou o número da fatura para localizarmos seus lançamentos.'
  }),
  Object.freeze({
    option: '4',
    area: 'PMO',
    title: 'Atendimento Executivo & Outros assuntos',
    menuHint: 'Triagem executiva e demais temas',
    emoji: '⚖️',
    agent_id: 'AGT-04',
    agent_name: 'Marina',
    role: 'PMO / triagem executiva',
    followUp: 'Se quiser, descreva o assunto em uma mensagem para a triagem encaminhar ao responsável certo.'
  })
]);

export const URA_DEFAULT_ROUTE = Object.freeze({
  option: null,
  area: 'ATENDIMENTO',
  title: 'Atendimento',
  menuHint: '',
  emoji: '👋',
  agent_id: 'AGT-20',
  agent_name: 'Joana',
  role: 'Atendimento',
  followUp: 'Se precisar do menu principal, digite *menu*.'
});

const AREA_TO_OPTION = Object.freeze({
  VENDAS: '1',
  ATENDIMENTO: '2',
  FINANCEIRO: '3',
  PMO: '4',
  JURIDICO: '4'
});

const autoReplyLog = new Map();

function isConfiguredEnvValue(raw) {
  if (typeof raw !== 'string') return false;
  const value = raw.trim();
  if (!value) return false;
  if (/^CONFIGURAR/i.test(value)) return false;
  if (/^DADO A CONFIGURAR/i.test(value)) return false;
  return true;
}

/**
 * Identidade do canal: só afirma marca quando o par id+nome está configurado.
 * Sem o par, business_id = UNASSIGNED e o texto é genérico.
 */
export function getWhatsappChannelIdentity(env = process.env) {
  const configuredId = isConfiguredEnvValue(env.WHATSAPP_BUSINESS_ID)
    ? env.WHATSAPP_BUSINESS_ID.trim()
    : '';
  const configuredBrand = isConfiguredEnvValue(env.WHATSAPP_BRAND_NAME)
    ? env.WHATSAPP_BRAND_NAME.trim()
    : '';
  const fullyConfigured = Boolean(configuredId && configuredBrand);

  return {
    businessId: configuredId || NEUTRAL_BUSINESS_ID,
    brandName: fullyConfigured ? configuredBrand : NEUTRAL_BRAND_NAME,
    configured: fullyConfigured
  };
}

export function findUraOptionByKey(optionKey) {
  return URA_MENU_OPTIONS.find((item) => item.option === String(optionKey)) || null;
}

export function matchUraMenuOption(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  for (const option of URA_MENU_OPTIONS) {
    const n = option.option;
    if (
      trimmed === n ||
      lower.startsWith(`${n} `) ||
      lower.includes(`opcao ${n}`) ||
      lower.includes(`opção ${n}`)
    ) {
      return option;
    }
  }
  return null;
}

export function isUraGreeting(text) {
  const trimmed = String(text || '').trim();
  const lower = trimmed.toLowerCase();
  return (
    /^(oi|ol[aá]|bom dia|boa tarde|boa noite|menu|ajuda|in[ií]cio|come[cç]ar|op[cç][oõ]es|\?)$/i.test(trimmed) ||
    lower === 'alo' ||
    lower === 'alô' ||
    lower === 'ola helena' ||
    lower === 'oi helena'
  );
}

/**
 * Resolve a rota canônica (agente + área) a partir do texto e, se não houver
 * dígito de menu, da classificação. Sempre devolve um item da tabela (ou o
 * fallback Joana), nunca um agent_id solto.
 */
export function resolveUraRoute({ text = '', classification = null } = {}) {
  const menu = matchUraMenuOption(text);
  if (menu) return menu;

  if (classification) {
    if (Number(classification.urgency) >= 5 || classification.area === 'JURIDICO') {
      return findUraOptionByKey('4');
    }
    const byArea = AREA_TO_OPTION[classification.area];
    if (byArea) {
      return findUraOptionByKey(byArea);
    }
    const byAgent = URA_MENU_OPTIONS.find((item) => item.agent_id === classification.suggested_agent_id);
    if (byAgent) return byAgent;
  }

  return URA_DEFAULT_ROUTE;
}

export function getWhatsappAutoReplyDebounceMs(env = process.env) {
  const parsed = parseInt(env.WHATSAPP_AUTOREPLY_DEBOUNCE_MS || String(DEFAULT_AUTOREPLY_DEBOUNCE_MS), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_AUTOREPLY_DEBOUNCE_MS;
  return parsed;
}

function normalizeRemoteKey(remoteNumber) {
  const digits = String(remoteNumber || '').replace(/\D/g, '');
  return digits || String(remoteNumber || '');
}

function pruneAutoReplyLog(now, windowMs) {
  for (const [key, entry] of autoReplyLog) {
    if (!entry || now - entry.at >= windowMs) {
      autoReplyLog.delete(key);
    }
  }
}

export function resetWhatsappAutoReplyDebounce() {
  autoReplyLog.clear();
}

/**
 * True quando a mesma auto-resposta já foi enviada a este número na janela.
 */
export function shouldSkipDuplicateAutoReply(remoteNumber, replyText, now = Date.now(), env = process.env) {
  const windowMs = getWhatsappAutoReplyDebounceMs(env);
  if (windowMs === 0) return false;
  pruneAutoReplyLog(now, windowMs);
  const key = normalizeRemoteKey(remoteNumber);
  if (!key || !replyText) return false;
  const prev = autoReplyLog.get(key);
  return Boolean(prev && prev.text === replyText && now - prev.at < windowMs);
}

export function rememberAutoReplySent(remoteNumber, replyText, now = Date.now(), env = process.env) {
  const windowMs = getWhatsappAutoReplyDebounceMs(env);
  pruneAutoReplyLog(now, windowMs);
  const key = normalizeRemoteKey(remoteNumber);
  if (!key || !replyText) return;
  autoReplyLog.set(key, { text: replyText, at: now });
}

function formatAgentLabel(route) {
  if (!route?.agent_name) return 'nossa equipe de atendimento';
  if (route.agent_id) {
    return `*${route.agent_name} (${route.agent_id}, ${route.role})*`;
  }
  return `*${route.agent_name}*`;
}

const HONEST_WAIT =
  'A equipe responde por este canal quando o atendimento for assumido. Não há retorno automático imediato.';

export function buildAutoReplyMessage({
  text = '',
  classification = null,
  pushName = '',
  identity = null,
  route = null
} = {}) {
  const resolvedIdentity = identity || getWhatsappChannelIdentity();
  const trimmed = String(text || '').trim();
  const saudacaoNome = pushName ? `, *${pushName}*` : '';
  const resolvedRoute = route || resolveUraRoute({ text: trimmed, classification });

  if (isUraGreeting(trimmed)) {
    const welcome = resolvedIdentity.configured
      ? `Seja bem-vindo(a) à *${resolvedIdentity.brandName}*.`
      : 'Seja bem-vindo(a) ao nosso canal de atendimento.';
    const lines = URA_MENU_OPTIONS.map((item) => {
      const emojiNumber = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][Number(item.option) - 1] || `${item.option}.`;
      return `${emojiNumber} *${item.title}* (${item.menuHint})`;
    });
    return (
      `👋 Olá${saudacaoNome}! ${welcome}\n\n` +
      `Eu sou a *Helena*, assistente virtual. Como posso te ajudar hoje?\n\n` +
      `Digite o *número* da opção desejada:\n` +
      `${lines.join('\n')}\n\n` +
      `_Você pode digitar o número (1, 2, 3 ou 4) ou simplesmente escrever sua dúvida._`
    );
  }

  const menuMatch = matchUraMenuOption(trimmed);
  if (menuMatch) {
    return (
      `${menuMatch.emoji} *Opção ${menuMatch.option} selecionada — ${menuMatch.title}*\n\n` +
      `Sua mensagem foi registrada e encaminhada para ${formatAgentLabel(menuMatch)}.\n\n` +
      `${HONEST_WAIT}\n\n` +
      menuMatch.followUp
    );
  }

  if (classification && resolvedRoute && resolvedRoute.option) {
    const received = resolvedIdentity.configured
      ? `Recebemos sua mensagem na *${resolvedIdentity.brandName}*.`
      : 'Recebemos sua mensagem.';
    return (
      `${resolvedRoute.emoji} Olá${saudacaoNome}! ${received}\n\n` +
      `Sua solicitação foi registrada e encaminhada para ${formatAgentLabel(resolvedRoute)}.\n\n` +
      HONEST_WAIT
    );
  }

  const received = resolvedIdentity.configured
    ? `Sua mensagem foi recebida com sucesso pela *${resolvedIdentity.brandName}*.`
    : 'Sua mensagem foi recebida com sucesso.';

  return (
    `👋 Olá${saudacaoNome}! ${received}\n\n` +
    `Encaminhamos sua solicitação para ${formatAgentLabel(URA_DEFAULT_ROUTE)}.\n\n` +
    `${HONEST_WAIT}\n\n` +
    `_Se precisar voltar ao menu principal a qualquer momento, basta digitar *menu*._`
  );
}
