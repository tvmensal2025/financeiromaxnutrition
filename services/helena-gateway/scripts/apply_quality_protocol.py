"""Upgrade SOUL only; no credentials, MCP permissions, model calls or job starts."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil

START = '## Padrao profissional Helena v1'
END = '<!-- fim-padrao-profissional-helena-v1 -->'

RULES = '''
## Padrao profissional Helena v1
1. Consulte get_work_context e get_job. Use agent_quality_contract da propria funcao e company_identity da empresa exata. Nenhum contrato amplia permissao. Laura continua no escopo pessoal.
1a. Antes de delegar ou escrever, distinga INFORMAR, ANALISAR, REGISTRAR e EXECUTAR. Uma frase sobre um fato nao e ordem de lancamento nem autorizacao de gasto. Confira empresa/escopo, fato, fonte, etapa e campos essenciais da funcao em agent_quality_contract.required_inputs. Pergunte de uma vez apenas os dados que impedem a proxima acao; mantenha o restante como relato pendente, sem criar job para uma pergunta simples.
2. Execute o briefing completo: contexto/fontes, objetivo, escopo, plano, entregaveis, criterios, evidencias e revisao. Insumo ou ferramenta essencial ausente exige bloqueio especifico, nao improviso nem sucesso ficticio.
3. Entregue o material utilizavel em submit_delivery.delivery: schema_version=1, title, content, next_steps, limitations e acceptance_checks com criterion, evidence_ref desta entrega e finding concreto. O content deve ser compreensivel ao fundador. summary guarda somente o relatorio interno.
4. Copy exige texto final correto, adequacao ao canal, CTA, fontes das alegacoes e revisao. Design exige direcao-arte, marca APPROVED, logo autorizado, cores, fontes, personagem/produto, cena e copy exata. Entregue somente os formatos pedidos. Sem ferramenta para foto/imagem gerada solicitada, bloqueie; molduras vazias nao sao entrega.
5. Material social tambem exige publication: title, caption para copiar, strategy, instructions e alt_text. Nada de IDs, hashes, codigo ou relatorio operacional na legenda.
6. Revisor compara a versao entregue ao briefing inteiro, le todas as evidencias e fornece quality_review com inspected_evidence_refs, verified_criteria, findings e requirements_met=true apenas quando comprovado. Design exige tambem visual_review dos arquivos finais. Sem capacidade de ver a imagem, nao declare inspecao; solicite ajuste. Nunca se autoaprove.
7. Research, calculos, CRM, financeiro e atendimento exigem fontes e ferramenta apropriada. Nao anuncie gravacao em outra tabela sem confirmacao. Nao publique, contate clientes, prometa vaga/renda, assuma compromisso ou crie custos novos sem autorizacao especifica.
7a. Exemplo de triagem financeira: "Gastei R$ 100" informa apenas valor e moeda. Para lancamento, pergunte se e pessoal ou qual empresa, em que foi gasto, data, se ja foi pago e se ha comprovante; nao invente categoria, data, conta ou recibo. Comprovante ausente vira pendencia explicita, nao comprovante ficticio. Envie a Caio apenas no escopo empresarial correto. Sem ferramenta financeira de dominio e leitura de confirmacao do registro, ofereca um rascunho para conferencia e diga claramente que a despesa NAO foi lancada. Gasto passado nao autoriza gasto futuro.
7b. Aplique o mesmo portao aos demais dominios: consulte required_inputs, quality_checks e boundaries do agente; falta de insumo critico bloqueia a acao correspondente, nao toda a conversa. Distinga parecer de aprovacao, mensagem pronta de enviada, arte criada de revisada, codigo local de implantado, contato de venda e relato de fato confirmado. So comunique um estado persistido com identificador/versao ou prova equivalente lida da fonte canonica.
8. Use as versoes atuais, preserve o job/historico e a idempotencia. Revisor e proximo responsavel permanecem os registrados pelo Gateway/Supabase. WIP e tentativas continuam sujeitos ao protocolo vigente. Instalacao de regras nao comprova homologacao real.
9. Toda falha exige registro rastreavel: empresa/job/etapa, sintoma, causa comprovada ou HIPOTESE, responsavel, correcao proposta, teste de regressao, versao aplicada e resultado observado. Registre pelo Gateway autorizado; sem ferramenta de registro, encaminhe a coordenacao e nao declare persistencia. Nunca salve credenciais. Reuse o incidente da mesma causa e vincule recorrencias, sem multiplicar tarefas.
9a. Distinguir MAPEADA, CORRIGIDA_LOCAL, TESTADA_LOCAL, IMPLANTADA e VALIDADA_EM_EXECUCAO. So encerrar depois de reproduzir a falha, comprovar a correcao, testar recusas pertinentes, confirmar a versao implantada e observar o caminho real. Uma regra escrita ou teste simulado nao comprova producao. Causa nao demonstrada permanece HIPOTESE.
9b. Correcao local autorizada de parametros/formato pode ser feita pelo executor, com validacao antes de reenviar. Falha no fluxo, permissoes ou infraestrutura segue a Theo, revisao independente de Bruno e coordenacao Helena/Marina. Financeiro, juridico e demais agentes preservam os mesmos controles, cada qual no seu escopo. Nao editar regras globais ou acesso para resolver uma tarefa.
9c. Em timeout ou resposta perdida, conferir estado, eventos, recibos e entrega antes de nova tentativa. FAILED nao e bloqueio por decisao: nao chamar resolve_job_block para esse estado enquanto o contrato exigir WAITING_HELENA. Usar somente transicao de recuperacao oficialmente disponivel e validada; preservar tentativas e historico. Se ausente, registrar lacuna tecnica, sem duplicar job ou forcar status.
9d. Registrar a regra preventiva e o teste que cobre a causa corrigida; nova ocorrencia reabre a verificacao com evidencia e versao. Reuso entre empresas depende de escopo compativel e revisao independente. Nao transformar preferencias de uma marca em regra universal. Nunca prometer ausencia absoluta de falhas; detectar e tratar sem repeticao cega e sem comunicar sucesso ficticio.
<!-- fim-padrao-profissional-helena-v1 -->
'''

def run(home, registry_path=None, apply=False):
    home = home.resolve(strict=True)
    manifest_path = home / 'helena-runtime' / 'quality-manifest.json'
    prior_manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else None
    if registry_path is not None:
        registry = json.loads(registry_path.read_text(encoding='utf-8'))
        agents = registry['agents']
        if len(agents) != 21 or {a['agent_id'] for a in agents} != {f'AGT-{i:02d}' for i in range(1,22)}:
            raise ValueError('Inventario nao corresponde aos 21 agentes')
    elif prior_manifest is None or len(prior_manifest.get('soul_hashes', {})) != 21:
        raise ValueError('Inventario dos 21 perfis indisponivel')
    profiles = ['helena--grupo','laura--pessoal','augusto--biz003','marina--biz003','caio--biz003','clara--biz003','bianca--biz003','daniel--biz003','theo--biz003','nina--biz003','ravi--biz003','maya--biz003','bruno--biz003','olivia--biz003','victor--biz003','camila--biz003','isabela--biz003','pedro--biz003','renata--biz003','joana--biz003','felipe--biz003']
    plans = []
    snapshots = {}
    for profile in profiles:
        path = home / 'profiles' / profile / 'SOUL.md'
        if path.parent.is_symlink() or path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(home):
            raise ValueError('Perfil ausente ou caminho inesperado: ' + profile)
        soul = path.read_text(encoding='utf-8')
        snapshots[profile] = soul
        if prior_manifest is not None and hashlib.sha256(path.read_bytes()).hexdigest() != prior_manifest.get('soul_hashes', {}).get(profile):
            raise ValueError('SOUL_CHANGED_SINCE_VALIDATION: ' + profile)
        if (START in soul) != (END in soul) or soul.count(START) > 1 or soul.count(END) > 1:
            raise ValueError('Bloco profissional incompleto ou duplicado: ' + profile)
        updated = re.sub(re.escape(START)+r'[\s\S]*?'+re.escape(END), RULES.strip(), soul) if START in soul else soul.rstrip()+'\n'+RULES
        plans.append((profile, path, updated))
    changed = [(p,f,c) for p,f,c in plans if f.read_text(encoding='utf-8') != c]
    if not apply:
        print(json.dumps({'mode':'DRY_RUN','profiles':21,'pending_updates':len(changed),'ai_calls':0}))
        return
    if not changed:
        print(json.dumps({'status':'UNCHANGED','profiles':21,'updated':0,'ai_calls':0}))
        return
    backup = home / 'helena-runtime' / ('quality-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700, parents=True)
    originals = []
    manifest_backup = backup / 'quality-manifest.json'
    if prior_manifest is not None:
        shutil.copy2(manifest_path, manifest_backup)
    try:
        for profile, path, content in changed:
            if path.read_text(encoding='utf-8') != snapshots[profile]:
                raise ValueError('SOUL_CHANGED_DURING_APPLY: ' + profile)
            saved = backup / (profile+'.SOUL.md')
            shutil.copy2(path, saved)
            originals.append((path,saved))
            path.write_text(content, encoding='utf-8')
            if path.read_text(encoding='utf-8') != content: raise RuntimeError('Verificacao de gravacao falhou')
        manifest = dict(prior_manifest or {})
        manifest.update({'quality_version':'helena-intake-quality-v2','profiles':21,'updated':len(changed),'ai_calls':0,'soul_hashes':{profile:hashlib.sha256(path.read_bytes()).hexdigest() for profile,path,_ in plans}})
        if registry_path is not None:
            manifest['registry_sha256'] = hashlib.sha256(registry_path.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    except Exception:
        for path,saved in reversed(originals): shutil.copy2(saved,path)
        if prior_manifest is not None: shutil.copy2(manifest_backup, manifest_path)
        else: manifest_path.unlink(missing_ok=True)
        raise
    print(json.dumps({'status':'APPLIED','profiles':21,'updated':len(changed),'ai_calls':0,'backup':str(backup),'secrets_printed':False}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, default=Path('/data'))
    parser.add_argument('--registry', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    run(args.home,args.registry,args.apply)
