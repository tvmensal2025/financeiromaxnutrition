import { MODULOS } from '@/lib/modulos';
export type Destino = { to: string; label: string };
export type GrupoNavegacao = { titulo: string; itens: Destino[] };
const paginas: GrupoNavegacao[] = [
  { titulo: 'Central', itens: [
    { to: '/', label: 'Visão geral' }, { to: '/conversa', label: 'Conversa com Helena' },
    { to: '/comando', label: 'Sala de comando' }, { to: '/supervisao', label: 'Supervisão' },
  ] },
  { titulo: 'Negócios', itens: [
    { to: '/portfolio', label: 'Portfólio' }, { to: '/empresas', label: 'Operação por empresa' },
    { to: '/indicadores', label: 'Indicadores de negócio' }, { to: '/crm', label: 'CRM' },
    { to: '/financeiro', label: 'Financeiro' }, { to: '/identidade', label: 'Identidade da empresa' },
  ] },
  { titulo: 'Operação da Helena', itens: [
    { to: '/cards', label: 'Cards' }, { to: '/execucao', label: 'Central de execução' },
    { to: '/entregas', label: 'Entregas' }, { to: '/calendario', label: 'Calendário' },
    { to: '/consumo', label: 'Consumo' }, { to: '/cobertura', label: 'Cobertura dos serviços' },
    { to: '/equipe', label: 'Equipe Digital' },
  ] },
  { titulo: 'Configuração e conexões', itens: [
    { to: '/integracoes', label: 'Integrações e Telegram' },
    { to: '/configuracoes', label: 'Configuração' }, { to: '/sistema', label: 'Estado do sistema' },
  ] },
];
/** Toda entrada do catálogo tem destino, inclusive módulos fora do menu anterior. */
export function gruposNavegacao(fundador: boolean): GrupoNavegacao[] {
  if (!fundador) return [{ titulo: 'Central', itens: [{ to: '/', label: 'Visão geral' }, { to: '/cards', label: 'Cards' }] }];
  const grupos = paginas.map(grupo => ({ ...grupo, itens: [...grupo.itens] }));
  const usados = new Set(grupos.flatMap(grupo => grupo.itens.map(item => item.to)));
  for (const modulo of MODULOS) {
    const to = modulo.rota || `/modulo/${modulo.tabela}`;
    if (usados.has(to)) continue;
    usados.add(to);
    const titulo = `Módulos · ${modulo.grupo}`;
    let grupo = grupos.find(item => item.titulo === titulo);
    if (!grupo) { grupo = { titulo, itens: [] }; grupos.push(grupo); }
    grupo.itens.push({ to, label: modulo.titulo });
  }
  return grupos;
}
