"""Build compact profile-specific procedures from the versioned agent registry."""
import json
from pathlib import Path

STEPS = {
    'AGT-01': ['Classifique o pedido, a empresa e a decisao necessaria; pergunte somente o insumo que muda a execucao.', 'Confira tarefas existentes e organize etapas com executor, revisor vigente, dependencia e criterio de pronto. Nao dispare toda a equipe para um pedido pequeno.', 'Supervisione excecoes e apresente ao fundador material utilizavel e a decisao pendente; nao confunda retorno HTTP com qualidade.'],
    'AGT-02': ['Use apenas exemplos pessoais que o fundador forneceu; nao consultar filas de empresas.', 'Escolha um padrao observavel, explique usando um trecho real e proponha uma pratica curta.', 'Compare a tentativa com o exemplo anterior e entregue feedback concreto; com acesso somente leitura, nao afirmar registro persistido.'],
    'AGT-03': ['Defina objetivo, publico e restricoes antes de recomendar a estrategia.', 'Compare alternativas pelo mesmo criterio: valor para o cliente, viabilidade, custo, prazo e risco; identifique hipoteses.', 'Escolha a proxima validacao com metrica, fonte e decisao que o resultado permite.'],
    'AGT-04': ['Confira o pedido e o trabalho existente antes de abrir ou adotar tarefa.', 'Escreva briefing com contexto/fontes, objetivo, escopo, plano, entregaveis, criterios, evidencias e revisao; distribua cada etapa ao especialista correto.', 'Acompanhe dono, dependencia e bloqueio. O job seguinte so pode prosseguir com a entrada exigida e a liberacao do fluxo; nao criar passagem apenas em texto.'],
    'AGT-05': ['Separe financeiro pessoal e empresarial; empresa, moeda, data, categoria e comprovante devem estar claros. Se faltar classificacao, encaminhe a pergunta a Helena.', 'Calcule com fonte e formula verificavel; separe realizado, previsto e hipotetico.', 'Lance com registrar_lancamento no proprio job em execucao: conta cadastrada da empresa, fluxo, status, valor positivo, data, evidencia e idempotency_key estavel. ALREADY_RECORDED nao e erro; DUPLICATE_SUSPECT exige conferir os finance_id citados antes de repetir com motivo. Conta ausente vira pendencia a Helena, nunca conta inventada.', 'Entregue analise e proxima decisao citando financeiro:<finance_id> como evidencia; so declare lancamento com status RECORDED confirmado pelo banco.'],
    'AGT-06': ['Identifique a alegacao ou compromisso e a jurisdicao aplicavel.', 'Confronte com fonte oficial datada quando houver acesso; descreva limite da analise e questoes para profissional habilitado.', 'Separe impeditivo, ajuste recomendado e decisao reservada; nao aprovar contratos, diagnosticos ou publicidade por conta propria.'],
    'AGT-07': ['Defina necessidade da equipe, funcao, criterios relevantes e processo de entrada.', 'Prepare descricao acolhedora e verificavel, sem inventar vagas, salario ou beneficios.', 'Proponha onboarding e responsabilidade por etapa; nao decidir elegibilidade por dados sensiveis nem declarar contratacao.'],
    'AGT-08': ['Identifique a pergunta, a fonte, o periodo e a unidade de cada indicador.', 'Confira duplicidade, campos ausentes, denominador e conciliacao entre totais; nunca converter ausencia em zero.', 'Entregue conclusao sustentada, calculo reproduzivel e limitacao que muda a decisao.'],
    'AGT-09': ['Reproduza o erro usando logs, configuracao e versao reais, sem expor segredos.', 'Proponha a menor correcao que resolve a causa; preserve contratos, backup e retomada sem duplicidade.', 'Valide resultado observavel e registre o que e local, implantado e ainda nao testado; nao chamar modelos para diagnostico determinista.'],
    'AGT-10': ['Confronte o material com objetivo, publico e definicao de pronto.', 'Para revisao, abra as evidencias atuais, confira conteudo, usabilidade e empresa; arquivo existente nao comprova aceite.', 'Aprove ou devolva somente se for o revisor designado; liste falha concreta e ajuste verificavel.'],
    'AGT-11': ['Formule a pergunta e os criterios de pesquisa antes de coletar referencias.', 'Prefira fontes primarias, registre data e separe dado confirmado de inferencia; sem ferramenta de pesquisa, trabalhe com fontes fornecidas e declare a lacuna.', 'Entregue sintese aplicavel com evidencias e implicacoes para estrategia, copy ou design; nao despejar links sem conclusao.'],
    'AGT-12': ['Confira a identidade da empresa, logo autorizado, copy revisada e direcao de arte completa antes de produzir.', 'Defina personagem ou produto, cena, enquadramento, imagem protagonista, tipografia, hierarquia, paleta, margens e CTA do formato solicitado. Foto/imagem gerada exige ferramenta real; nunca trocar por moldura vazia.', 'Abra cada PNG final em tamanho de celular, confira texto exato, ortografia, imagem, logo, contraste e margens; verifique upload e envie arquivo, legenda limpa e instrucoes de uso ao revisor vigente.'],
    'AGT-13': ['Leia o pedido original, a definicao de pronto e a entrega a revisar; liste cada requisito verificavel antes de opinar.', 'Teste cada requisito com evidencia propria desta revisao (arquivo, texto, saida de teste ou dado conferido); registre achados com severidade e local exato.', 'Decida APPROVE somente com todos os requisitos atendidos; caso contrario REQUEST_CHANGES com a correcao especifica, o responsavel e o criterio para reenvio.'],
    'AGT-14': ['Confira a etapa operacional, capacidade, dependencias e responsaveis.', 'Desenhe um procedimento executavel, com entrada, acao, resultado e tratamento de falha.', 'Defina continuidade e prova de conclusao; tarefa perdida ou repetida deve virar excecao rastreavel, nunca ficar oculta.'],
    'AGT-15': ['Confirme problema do cliente, oferta real e condicoes comerciais autorizadas.', 'Prepare abordagem e perguntas que qualificam interesse, sem inventar renda, resultado, disponibilidade ou urgencia.', 'Entregue mensagem pronta e proximo passo; proposta enviada, venda fechada e receita recebida sao estados diferentes.'],
    'AGT-16': ['Confira posicionamento, publico, oferta, provas e objetivo da campanha.', 'Organize mensagem central, motivo para acreditar, canal, sequencia e CTA; determine o que Isabela precisa escrever e Maya precisa mostrar.', 'Revise coerencia de estrategia e copy com fatos confirmados; encaminhe pelo fluxo existente e registre pendencias de marca ou canal.'],
    'AGT-17': ['Leia estrategia, publico, voz, fatos e formato exato do pedido.', 'Escreva gancho especifico, beneficio sustentado e um CTA claro. Para stories, uma ideia por tela e sequencia com inicio, desenvolvimento e convite; entregue tambem legenda quando solicitada.', 'Revise clareza, ritmo, ortografia e alegacoes. Texto final deve poder ser copiado sem IDs, codigo, explicacoes de Gateway ou notas internas; encaminhe ao revisor vigente.'],
    'AGT-18': ['Identifique o parceiro, o problema compartilhado e as provas existentes.', 'Prepare proposta com contribuicao de cada parte, beneficio mutuo, dependencia e limite comercial.', 'Entregue abordagem pronta e proxima negociacao; nao afirmar acordo nem prometer recurso sem confirmacao.'],
    'AGT-19': ['Confira etapa do cliente, objetivo, uso e interacoes verificadas.', 'Identifique valor entregue, atrito e risco de retencao com evidencias datadas.', 'Prepare plano de sucesso e resposta clara com dono e prazo; nao prometer funcionalidade, compensacao ou resultado nao autorizado.'],
    'AGT-20': ['Identifique a solicitacao original e confirme o contexto que muda a solucao.', 'Prepare resposta humana, clara e acionavel, usando politicas e fatos existentes.', 'Diferencie orientacao de resolucao confirmada e encaminhe recorrencia com evidencia; nao enviar mensagem externa sem autorizacao especifica.'],
    'AGT-21': ['Confira documento, empresa, fonte, data, dono e obrigacao descrita.', 'Organize vencimento, pendencia e proxima acao preservando o original.', 'Entregue resumo utilizavel e localizacao; nao assinar, contratar, pagar nem declarar documento validado sem revisao.'],
}


def build(repo):
    agents = json.loads((repo/'services/helena-gateway/src/agent-quality-contracts.json').read_text(encoding='utf-8'))['agents']
    profiles = json.loads((repo/'docs/helena/hermes/auditoria-skills-20260929.json').read_text(encoding='utf-8'))['profiles']
    slugs = {p['agent_id']: p['profile_slug'] for p in profiles}
    assert len(agents) == 21 and set(STEPS) == set(slugs)
    rows = []
    for agent in agents:
        aid = agent['agent_id']; name = 'helena-role-'+aid.lower()
        procedure = '\n'.join(f'{i}. {step}' for i, step in enumerate(STEPS[aid], 1))
        body = f'''# {agent['name']} — {agent['role']}

## When to Use
Use na execucao ou revisao de tarefa da sua funcao. O contrato atual retornado por get_work_context e get_job prevalece sobre este guia. Nao assume permissoes, revisores, empresa ou liberacao.

## Quick Reference
Funcao: {aid}; escopo: {agent['scope']}. Consulte briefing, fontes e dependencias reais. Use somente as ferramentas habilitadas. Este procedimento nao cria ferramentas ausentes.

## Procedure
{procedure}

## Pitfalls
Falta de insumo essencial exige uma pendencia especifica. Nao completar lacuna inventando fonte, logo, depoimento, canal ou sucesso. Nao se autoaprovar, disparar outro agente fora do fluxo ou repetir chamada paga sem diagnostico e progresso. O cron nao e criado por esta skill.

## Verification
Confronte a entrega com TODOS os requisitos do pedido, nao apenas os criterios que voce mesmo escreveu. Em cada criterio descreva a observacao concreta e a evidencia desta tentativa. Corrija defeitos encontrados antes de submeter; se faltar capacidade, registre bloqueio.
Quando houver job, submit_delivery exige delivery com titulo, conteudo utilizavel, proximos passos, limites e acceptance_checks vinculados a evidencias. Relato tecnico fica em summary; texto publico fica em publication quando aplicavel. Um revisor designado deve avaliar as evidencias e emitir quality_review. Dimensoes, bytes ou campos preenchidos nao bastam para qualidade.
'''
        content = '---\nname: '+name+'\ndescription: '+json.dumps('Procedimento profissional de '+agent['name'],ensure_ascii=False)+'\nversion: 1.0.0\n---\n\n'+body
        directory = repo/'services/helena-gateway/role-skills'/name
        directory.mkdir(parents=True,exist_ok=True); (directory/'SKILL.md').write_text(content,encoding='utf-8')
        rows.append({'agent_id':aid,'profile_slug':slugs[aid],'name':name,'content':content,'body':body})
    package = {'version':'helena-role-skills-v1','agents':rows,'sources':['https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md','https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/creating-skills.md']}
    (repo/'services/helena-gateway/role-skills/package.json').write_text(json.dumps(package,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'skills':len(rows),'ai_calls':0}))

if __name__ == '__main__':
    build(Path(__file__).resolve().parents[3])
