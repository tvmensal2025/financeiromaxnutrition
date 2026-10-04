import { runHermesCommand, runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  console.log('=== ALINHAMENTO DO HERMES FLEET (21 AGENTES + HELENA) ===\n');

  // 1. Ajuste do nome da Olivia no config
  console.log('1. Verificando e ajustando workflow-config.json...');
  const fixConfigScript = `
import json, shutil
path = '/data/helena-runtime/workflow-config.json'
with open(path, 'r', encoding='utf-8') as f:
    cfg = json.load(f)

# Backup seguro
shutil.copyfile(path, path + '.bak')

agt14 = cfg.get('profiles', {}).get('AGT-14', [])
changed = False
if agt14 == ['olívia--biz003']:
    cfg['profiles']['AGT-14'] = ['olivia--biz003']
    changed = True

if changed:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print('CONFIG_UPDATED: AGT-14 corrigido para olivia--biz003')
else:
    print('CONFIG_ALREADY_CORRECT:', agt14)
`;
  const res1 = await runHermesPython(fixConfigScript);
  console.log(res1);

  // 2. Diagnóstico da fila e dos jobs estagnados
  console.log('\n2. Diagnosticando jobs e estado do despachante...');
  const diagnoseScript = `
import json
try:
    with open('/data/helena-runtime/workflow-state.json', 'r') as f:
        state = json.load(f)
    print("TOTAL_RECEIPTS:", len(state.get('receipts', {})))
    print("PENDING_KEYS:", list(state.get('pending', {}).keys()))
    
    stalled = [k for k, v in state.get('receipts', {}).items() if v.get('status') == 'NEEDS_ATTENTION']
    print("STALLED_NEEDS_ATTENTION_COUNT:", len(stalled))
    for k in stalled[:4]:
        item = state['receipts'][k]
        print(f" - Job: {item.get('job_id')} | Phase: {item.get('phase')} | Agent: {item.get('profile')} | Diagnostic: {item.get('diagnostic')}")
except Exception as e:
    print("DIAGNOSE_ERROR:", e)
`;
  const res2 = await runHermesPython(diagnoseScript);
  console.log(res2);

  // 3. Teste do preflight dos 21 perfis
  console.log('\n3. Testando preflight dos 21 perfis...');
  const testProfilesScript = `
import json, subprocess, sys
profiles = ["helena--grupo","laura--pessoal","augusto--biz003","marina--biz003","caio--biz003","clara--biz003","bianca--biz003","daniel--biz003","theo--biz003","nina--biz003","ravi--biz003","maya--biz003","bruno--biz003","olivia--biz003","victor--biz003","camila--biz003","isabela--biz003","pedro--biz003","renata--biz003","joana--biz003","felipe--biz003"]
print(f"Total perfis a validar: {len(profiles)}")
valid = 0
for p in profiles:
    # Checa se o diretório do perfil existe
    import os
    if os.path.exists(f"/data/profiles/{p}/config.yaml"):
        valid += 1
print(f"Perfis no disco /data/profiles: {valid} de {len(profiles)} encontrados.")
`;
  const res3 = await runHermesPython(testProfilesScript);
  console.log(res3);

  console.log('\n=== ALINHAMENTO CONCLUÍDO COM SUCESSO ===');
}

main().catch(console.error);
