import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const json = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const write = (p,v) => fs.writeFileSync(new URL(p,root), JSON.stringify(v,null,2)+'\n');
const stamp = new Date().toISOString();
const report = json('docs/helena/hermes/instalacao-2026-09-27.json');
report.checked_at = stamp;
report.phase = 'PERFIS_PROVISIONADOS_AUTENTICADOS_AGUARDANDO_PILOTO';
Object.assign(report.verified, {
 checkpoint:'CP-20260927-V019', individual_credentials_provisioned:21,
 gateway_commit:'f49c88b', supabase_objects_mapped:72, supabase_columns_mapped:1559,
 profile_authentication_passed:21, inactive_profile_denied:true,
 runtime_bindings_active:0, runtime_bindings_configured:21
});
Object.assign(report.verified.workflow, {checkpoint:'CP-20260927-V019', credentials_registered:21, authentication_passed:21, bindings_active:0, real_agent_flow_tested:false});
report.provisioning = {
 completed:true, operator_executed:true, manifest:'/data/helena-runtime/manifest-publico.json',
 backup:'/data/helena-runtime/backup-20260927T103719643399Z',
 verification:'/data/helena-runtime/verificacao-publica.json',
 registered_hashes:21, authenticated_profiles:21, secrets_exposed:false,
 business_jobs_started:false, inactive_profile_denied:true,
 note:'Autenticacao tools/list validada; get_work_context recusa perfil inativo. Ainda falta piloto pelo MCP e execucao real.'
};
report.pending = [
 'Incluir fail_job e waiting_helena no filtro MCP antes do piloto',
 'Ativar piloto autorizado e homologar tarefa real, revisao e handoff pelo MCP',
 'Conectar acionador Hermes: READY sozinho nao inicia modelo',
 'Implementar e testar escrita especifica das tabelas de dominio e memoria pessoal de Laura',
 'Revalidar 23 jobs legados individualmente; nao liberar em lote',
 'Definir teto de custo e agenda antes de recorrencias',
 'Integrar branch codex/hermes-runtime-preparation ao main antes de alterar origem no EasyPanel'
];
if (!report.changes.some(c=>c.action_id==='PROVISIONAMENTO_21_AUTENTICADOS')) report.changes.push({
 action_id:'PROVISIONAMENTO_21_AUTENTICADOS',checked_at:stamp,
 action:'Operador executou instalador; 21 hashes registrados. Autenticacao confirmada para 21 perfis; hash de Felipe corrigido apos HTTP401 e reteste aprovado.',
 business_jobs_started:false
});
write('docs/helena/hermes/instalacao-2026-09-27.json',report);
const map=json('docs/helena/hermes/mapeamento.json');
map.generated_at=stamp;
map.source_project.checkpoint='CP-20260927-V019';
Object.assign(map.implementation,{individual_credentials_provisioned:true,profile_authentication_passed:true,agents_started:false,schedules_created:false});
map.provisioning={profiles:21,registered_hashes:21,authentication_passed:21,bindings_active:0,real_agent_flow_tested:false};
write('docs/helena/hermes/mapeamento.json',map);
const planUrl=new URL('docs/helena/hermes/PLANO-DE-IMPLANTACAO.md',root);
let plan=fs.readFileSync(planUrl,'utf8').replace('Checkpoint atual CP-20260927-V018','Checkpoint atual CP-20260927-V019');
plan=plan.replace('Instalador preparado em /data/configurar_perfis.py no Hermes, aguardando o fundador iniciar credenciais.','Instalador executado pelo operador no Hermes, com backup; 21 hashes registrados no Supabase e 21 autenticacoes validadas, com bloqueio de perfil inativo confirmado. Nenhuma credencial exposta. Antes do piloto, incluir as ferramentas de falha no filtro MCP.');
fs.writeFileSync(planUrl,plan);
const flowUrl=new URL('services/helena-gateway/HERMES-WORKFLOW.md',root);
let flow=fs.readFileSync(flowUrl,'utf8').replace('## Provisionamento preparado, ainda não executado','## Provisionamento executado e autenticacao validada');
flow=flow.replace('Após execução autorizada pelo operador: registrar os hashes via canal administrativo no Supabase; homologar leitura/autenticação por perfil; ativar inicialmente apenas o piloto; validar registro real por um agente, revisão e handoff.','Operador executou o instalador em 27/09/2026. Backup: /data/helena-runtime/backup-20260927T103719643399Z. Foram registrados 21 hashes no Supabase; 21 autenticacoes tools/list passaram, e get_work_context recusou corretamente o perfil inativo. Relatorio: /data/helena-runtime/verificacao-publica.json. Todos continuam CONFIGURED. Proximo: incluir fail_job/waiting_helena no filtro MCP, ativar somente o piloto e validar tarefa real, revisao e handoff.');
fs.writeFileSync(flowUrl,flow);
console.log('Relatorios sincronizados: 21 provisionados/autenticados; zero ativados; piloto pendente.');
