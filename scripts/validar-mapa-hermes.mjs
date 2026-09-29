import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Valida cobertura e consistência do plano; não acessa rede nem executa a migração.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mapPath = path.join(root, 'docs/helena/hermes/mapeamento.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const unique = (values, label) => check(new Set(values).size === values.length, `Duplicidade: ${label}`);
const sameSet = (left, right, label) => {
  const a = new Set(left), b = new Set(right);
  const missing = [...a].filter(x => !b.has(x));
  const extra = [...b].filter(x => !a.has(x));
  check(!missing.length && !extra.length, `${label}: ausentes=${missing.join(',')} extras=${extra.join(',')}`);
};

check(map.status === 'MAPEAMENTO_APENAS', 'O arquivo precisa distinguir plano de implantação.');
check(Object.values(map.implementation).every(v => typeof v === 'boolean'), 'Flags de implantação precisam ser booleanas.');
check(map.implementation.agents_started === false && map.implementation.schedules_created === false, 'O mapa não pode declarar trabalho iniciado antes da homologação.');
const base = map.tables.filter(t => t.type === 'BASE TABLE');
const views = map.tables.filter(t => t.type === 'VIEW');
unique(map.tables.map(t => t.name), 'tabelas/visões');
unique(map.domains.map(d => d.id), 'domínios');
const assigned = map.domains.flatMap(d => d.tables);
unique(assigned, 'tabelas atribuídas a domínios');
sameSet(base.map(t => t.name), assigned, 'Cobertura de tabelas');
check(base.length === map.inventory_summary.base_tables, 'Contagem de tabelas divergente.');
check(views.length === map.inventory_summary.views, 'Contagem de visões divergente.');
check(map.tables.reduce((n,t) => n + t.columns.length, 0) === map.inventory_summary.columns, 'Contagem de colunas divergente.');
check(base.reduce((n,t) => n + t.columns.length, 0) === map.inventory_summary.base_table_columns, 'Contagem de colunas base divergente.');
for (const table of map.tables) {
  const domain = map.domains.find(d => d.id === table.domain);
  check(Boolean(domain), `Domínio ausente: ${table.name}`);
  if (table.type === 'BASE TABLE') check(domain?.tables.includes(table.name), `Domínio incoerente: ${table.name}`);
  unique(table.columns, `colunas de ${table.name}`);
  check(table.columns.length > 0 && Boolean(table.destination), `Fonte incompleta: ${table.name}`);
  check(table.canonical_store === 'Supabase', `Autoridade de dados mudou sem desenho aprovado: ${table.name}`);
}
const phases = new Set(map.phases.map(p => p.id));
const visited = new Set(), visiting = new Set();
function visit(id) {
  if (visited.has(id)) return;
  if (visiting.has(id)) { problems.push(`Ciclo nas etapas: ${id}`); return; }
  const phase = map.phases.find(p => p.id === id);
  if (!phase) { problems.push(`Etapa inexistente: ${id}`); return; }
  visiting.add(id);
  phase.depends.forEach(visit);
  visiting.delete(id);
  visited.add(id);
}
map.phases.forEach(p => visit(p.id));
for (const [key, id, countKey] of [['agents','agent_id','agents'],['businesses','id','businesses'],['integrations','id','integrations'],['automations','id','automations']]) {
  unique(map[key].map(x => x[id]), key);
  check(map[key].length === map.inventory_summary[countKey], `Contagem divergente: ${key}`);
}
for (const a of map.agents) {
  check(phases.has(a.implementation_phase), `Fase ausente no agente ${a.agent_id}`);
  check(Boolean(a.mission && a.expected_output && a.review_owner && a.tools_policy), `Papel incompleto: ${a.agent_id}`);
}
// Confere os 21 vínculos locais sem confundir configuração com ativação real.
const roleSource = JSON.parse(fs.readFileSync(path.join(root, 'docs/helena/hermes/papeis-fonte-2026-09-27.json'), 'utf8'));
const audited = JSON.parse(fs.readFileSync(path.join(root, 'docs/helena/hermes/auditoria-vinculos-2026-09-27-verificada.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260927113100_hermes_runtime_bindings_and_execution_guard.sql'), 'utf8');
const profileConfig = fs.readFileSync(path.join(root, 'services/helena-gateway/scripts/configurar_perfis.py'), 'utf8');
const profilesBlock = profileConfig.match(/PROFILES\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
const configuredProfiles = [...profilesBlock.matchAll(/'([^']+)'/g)].map(([, slug]) => slug);
const bindingRows = [...migration.matchAll(/^\s*\('(AGT-\d{2})','([^']+)','(GROUP|PERSONAL|BUSINESS)',(null|'[^']+'),'([^']+)','([^']+)'\)[,;]$/gm)]
  .map(([, agent_id, scope_key, scope_type, business, profile_slug, model_id]) => ({ agent_id, scope_key, scope_type, business_id: business === 'null' ? null : business.slice(1, -1), profile_slug, model_id }));
sameSet(map.agents.map(a => a.agent_id), roleSource.agents.map(a => a.id), 'Papéis-fonte');
sameSet(map.agents.map(a => a.agent_id), audited.agents.map(a => a.id), 'Auditoria dos agentes');
sameSet(map.agents.map(a => a.agent_id), bindingRows.map(a => a.agent_id), 'Bindings da migração');
sameSet(configuredProfiles, bindingRows.map(a => a.profile_slug), 'Perfis do instalador Hermes');
unique(bindingRows.map(a => a.profile_slug), 'slugs dos bindings');
for (const binding of bindingRows) {
  const agent = map.agents.find(a => a.agent_id === binding.agent_id);
  const source = roleSource.agents.find(a => a.id === binding.agent_id);
  const verified = audited.agents.find(a => a.id === binding.agent_id);
  check(Boolean(agent && source && verified && agent.name === source.name && agent.name === verified.name), `Identidade divergente: ${binding.agent_id}`);
  check(verified?.profile === binding.profile_slug, `Slug divergente: ${binding.agent_id}`);
  check(binding.scope_type === 'BUSINESS' ? binding.business_id === binding.scope_key : binding.business_id === null,
    `Escopo divergente: ${binding.agent_id}`);
  check(binding.agent_id === 'AGT-01' ? binding.scope_type === 'GROUP' && binding.model_id === 'gpt-6-sol'
    : binding.agent_id === 'AGT-02' ? binding.scope_type === 'PERSONAL' && binding.model_id === 'gpt-6-luna'
    : binding.scope_type === 'BUSINESS' && binding.business_id === 'BIZ-003' && binding.model_id === 'gpt-6-luna',
  `Modelo ou empresa divergente: ${binding.agent_id}`);
}
for (const i of map.integrations) check(phases.has(i.phase) && Boolean(i.destination && i.acceptance), `Integração incompleta: ${i.id}`);
for (const a of map.automations) check(a.enabled_in_plan === false && Boolean(a.mode && a.acceptance), `Automação sem controle: ${a.id}`);
for (const g of map.gaps) check(phases.has(g.phase) && Boolean(g.owner), `Pendência sem destino: ${g.id}`);
unique(map.database_functions.map(f => f.name + '(' + f.args + ')'), 'funções do banco');
unique(map.acceptance_tests.map(t => t.id), 'testes de aceite');
check(map.acceptance_tests.every(t => t.status === 'NAO_EXECUTADO'), 'Teste proposto não deve ser declarado executado.');

const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const routes = [...app.matchAll(/\bpath="([^"]+)"/g)].map(m => m[1]);
const mappedRoutes = map.routes.flatMap(r => r.routes);
unique(mappedRoutes, 'rotas');
sameSet(routes, mappedRoutes, 'Cobertura de rotas do painel');

const gateway = fs.readFileSync(path.join(root, 'services/helena-gateway/src/server.mjs'), 'utf8');
const config = gateway.split('const TOOLS_CONFIG = {')[1]?.split('\n};')[0];
check(Boolean(config), 'Não foi encontrada a definição de ferramentas do Gateway.');
const tools = [...(config || '').matchAll(/^  ([a-z_]+): \{/gm)].map(m => m[1]);
if (config?.includes('...workflowTools(')) {
  const workflow = fs.readFileSync(path.join(root, 'services/helena-gateway/src/workflow.mjs'), 'utf8');
  tools.push(...[...workflow.matchAll(/^  ([a-z_]+): \[/gm)].map(m => m[1]));
}
sameSet(tools, map.gateway_tools.map(t => t.name), 'Cobertura das ferramentas do Gateway');
unique(map.gateway_tools.map(t => t.name), 'ferramentas do Gateway');

if (problems.length) {
  console.error(JSON.stringify({ result: 'FALHOU', problems }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ result: 'MAPEAMENTO_CONSISTENTE', base_tables:base.length, views:views.length, columns:map.inventory_summary.columns, agents:map.agents.length, integrations:map.integrations.length, automations:map.automations.length, routes:routes.length, gateway_tools:tools.length, database_functions:map.database_functions.length, implementation:'CONSULTAR_RELATORIO_DE_INSTALACAO', limitations:'Validação local de cobertura; estado da implantação em docs/helena/hermes/instalacao-2026-09-27.json. Não testa serviços, permissões ou conteúdo de planilhas.' }, null, 2));
}
