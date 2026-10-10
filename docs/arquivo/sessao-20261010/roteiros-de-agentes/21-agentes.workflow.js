export const meta = {
  name: 'helena-21-agentes-ponta-a-ponta',
  description: 'Constrói (só em arquivos) a especificação v3.1 dos 21 agentes de ponta a ponta: máquina de passagens com prova por código, contratos, catálogo, fichas, entregas, casos, jornadas e roteiros das 4 empresas, e ataca até não sobrar furo conhecido',
  phases: [
    { title: 'Máquina', detail: 'tabela de passagens + prova exaustiva limitada + testes' },
    { title: 'Contratos', detail: 'esquemas v3, organograma e catálogo de serviços dos 21' },
    { title: 'Agentes', detail: 'ficha, entregas, casos e jornada de cada um dos 21, atacada e corrigida' },
    { title: 'Integração', detail: 'validador ampliado, roteiros das 4 empresas, tudo verde' },
    { title: 'Ataque', detail: 'rodadas independentes até 2 rodadas sem furo novo' },
    { title: 'Relatório', detail: 'plano ponta a ponta para o fundador' },
  ],
}

const MAIN = '/home/user/financeiromaxnutrition'
const V2 = `${MAIN}/helena-v2`
const PAC = `${MAIN}/docs/planos/sistema-helena-pacote`
const AG = '/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag'

const CTX = `
CONTEXTO (Sistema Helena). Hoje: 10/10/2026. Responda e escreva SEMPRE em português do Brasil.
- Fundador solo, não programador, lê no celular. Quer 21 agentes de IA como funcionários treinados, coordenados pela Helena (AGT-01), atendendo 4 empresas (iGreen, Saúde, Humano Digital = BIZ-003, eLiving™ — grafia exata "eLiving™", nunca "E-living"). Pedido -> CARD -> especialistas -> revisão -> resultado no card. Ele exige: "não pode ter erro de forma alguma, a lógica tem que ser exata", "Helena tinha que ficar sem erro e estruturada", e agora "TODOS OS AGENTES TÊM QUE IR DE PONTA A PONTA" (não só os 5 da primeira meta).
- Fonte da verdade: ${PAC}/01-plano-v3.md (plano v3, motor DBOS). Registro de 171 furos: ${PAC}/02-registro-de-furos.md. Análise dos especialistas com 48 melhorias (MEL-01..48): ${PAC}/03-analise-especialistas.md. Crítica obrigatória (12 correções) dessa análise: ${PAC}/04-critica-da-analise.md. Melhorias verificadas em JSON: ${PAC}/pesquisa/rodada-5/melhorias-verificadas.json. Conferência v2 x plano v3 (22 pontos fora do lugar): ${MAIN}/docs/CONFERENCIA-HELENA-V2-X-PLANO-V3.md.
- Especificações atuais (fase 1 antiga, a reescrever): ${V2}/ (agents/, deliverables/entregas.yaml, playbooks/, schemas/, models.yaml, validar.py, test_validar.py).
- Os 21 agentes de hoje (contrato da v1): ${MAIN}/docs/AGENTES-SISTEMA-HELENA.md. Contratos de qualidade da v1: ${MAIN}/services/helena-gateway/src/agent-quality-contracts.json. Regras eLiving: ${MAIN}/docs/COMANDO-MASTER-ELIVING.md e ${MAIN}/docs/MANUAL-DE-COMPORTAMENTO-AGENTES-ELIVING.md (Sirlene, Doutor Vital, Alex e Rafael são personagens do produto, NÃO funcionários). Contexto das empresas: ${AG}/docs/CHECKPOINT-MESTRE-20261004.md e ${MAIN}/AGENTS.md.
- DECISÃO DO MOTOR EM ABERTO (DBOS no plano; a análise propôs motor próprio no Postgres, e a crítica diz que isso é reversão sem justificativa suficiente). Por isso TUDO que você escrever deve ser NEUTRO quanto ao motor: o estado do card vive em tabelas nossas e na tabela de passagens; nada pode depender de DBOS nem de motor próprio.
- Restrições DURAS: DEC-014 (sem API paga da OpenAI); agentes NUNCA cadastram, contatam pessoas de fora, gastam, assinam, publicam ou fazem commit — tudo que é externo vira "ação do fundador", executada pelo motor só depois do ok registrado dele, uma vez; nenhuma ferramenta de efeito externo dentro de agente; revisor nunca é o autor nem quem julga a mesma peça depois; prioridade e prazo só o fundador muda; nada de padrão automático que aprove entrega; toda espera tem dono e prazo; todo contador tem teto; nunca prometer "zero furo" (dizer "nenhum furo conhecido em aberto").
- REGRAS DE TRABALHO DESTA TAREFA: escreva SOMENTE dentro de ${V2}/ e de ${PAC}/ (e só nos arquivos que a sua etapa manda). NÃO rode git (nada de commit, checkout, reset, stash, add). NÃO acesse banco, servidor, Supabase, EasyPanel, VPS. NÃO copie valores de chaves. Python disponível com pyyaml, jsonschema e pytest. Arquivos YAML/JSON em UTF-8. Comentários e textos em português.
`

// ---------------------------------------------------------------- Máquina
phase('Máquina')
const MAQ_SCHEMA = {
  type: 'object',
  properties: {
    arquivos: { type: 'array', items: { type: 'string' } },
    estados_card: { type: 'array', items: { type: 'string' } },
    estados_etapa: { type: 'array', items: { type: 'string' } },
    acoes_por_papel: { type: 'string', description: 'resumo: papel -> lista de ações/respostas' },
    regras_provadas: { type: 'array', items: { type: 'string' }, description: 'quais das 13 regras a prova cobre e como' },
    regras_nao_cobertas: { type: 'array', items: { type: 'string' }, description: 'regras que não cabem na tabela e por quê, e quem cobre' },
    tamanho_da_prova: { type: 'string', description: 'estados/transições explorados e tempo' },
    comando_de_teste: { type: 'string' },
    resultado_testes: { type: 'string', description: 'saída real resumida dos testes' },
    pendencias: { type: 'array', items: { type: 'string' } },
  },
  required: ['arquivos', 'estados_card', 'estados_etapa', 'acoes_por_papel', 'regras_provadas', 'regras_nao_cobertas', 'tamanho_da_prova', 'comando_de_teste', 'resultado_testes', 'pendencias'],
}

const maquina = await agent(`${CTX}

ETAPA: MÁQUINA DE PASSAGENS (a lógica exata do card). Você é engenheiro de métodos formais. Leia por inteiro o plano v3 (seções "A jornada do card", "As 13 regras de ferro", "O agente: uma função com 5 ações", "O motor", "Falhas e esperas", "Qualidade em 3 portões", "O relatório do card"), as MEL-22, MEL-23, MEL-24, MEL-25, MEL-27, MEL-29, MEL-30 da análise (03) e os pontos 5, 6, 9, 11 e 12 da crítica (04).

Crie, do zero, em ${V2}/maquina/:
1. vocabulario.yaml — fonte única dos nomes: papéis (AUTOR, REVISOR, HELENA, FUNDADOR, MOTOR, RELOGIO, VIGIA), estados do card, estados da etapa, finais, ações de cada papel (autor: ENTREGAR, PERGUNTAR, DEVOLVER_A_QUEM_PEDIU, REGISTRAR_FALHA e PEDIR_SUBCARD marcado "desligado na v2.0" se você seguir a MEL-24; revisor: APROVAR, REPROVAR com critérios, NAO_CONSIGO_CONFERIR; fundador: botões do card — APROVAR, PEDIR_AJUSTE com motivo marcado, USAR_COMO_EXEMPLO, CANCELAR, RESPONDER com opção, PAUSAR_TUDO; motor/relógio/vigia: eventos técnicos como FALHA_INFRA por classe, TEMPO_ESGOTADO, PRAZO_80, PRAZO_VENCIDO, PRAZO_MAIS_1H, DECISAO_MUDOU, DEPENDENCIA_MUDOU, CANCELADO_PAI), classes de falha (as do plano: cota, login, provedor, queda, banco, ferramenta, tempo, site, grande demais, limite de chamadas, formato errado, reprovado, ação externa, desconhecida) e motivos do agente (NAO_CONSIGO, FALTAM_DADOS, FONTE_INSUFICIENTE).
2. passagens.yaml — a TABELA ÚNICA: para card e para etapa, cada linha = (estado, evento/ação, papel que pode disparar, guarda, efeito nos contadores, próximo estado, quem é o dono e qual o prazo do próximo estado). Todo estado não final tem dono e prazo. Finais sem saída. Tetos numéricos explícitos (6 execuções por etapa somando autor e revisor; 1 nova tentativa de formato; 2 rodadas de reprovação; 1 replanejamento se existir; teto para falhas de infraestrutura que não gastam tentativa — regra 12; perguntas por card; lembretes 24h/48h). Os pedidos de ajuste do fundador não gastam o teto de 6, mas têm teto próprio para a prova terminar (escreva qual e por quê). Inclua: espera por dependência, fila com motivo (cota/agente pausado), validação, revisão, esperando fundador (padrão que nunca aprova), em resolução, cancelamento em cascata (sub-etapas e dependentes perguntam ao fundador), card pronto não volta a andar (ajuste abre card novo ligado), informação velha (DECISAO_MUDOU/DEPENDENCIA_MUDOU invalida a aprovada e refaz quem dependia), "quem leu a internet só entrega ou registra falha", ação externa proposta vai para a lista do fundador e nunca é executada pelo agente.
3. provar.py — prova EXAUSTIVA LIMITADA (MEL-23: imprimir o tamanho): explora todos os estados alcançáveis de um card com configuração pequena mas representativa (ex.: 3 etapas com uma dependência em cadeia e uma paralela, uma etapa jurídica que julga outra, todos os papéis e todos os eventos, todos os contadores até o teto) e confere como INVARIANTES as regras de ferro que cabem na tabela: (1) todo estado aberto tem dono e prazo; (2) todo caminho termina num final (sem ciclo sem teto; ausência de estado sem saída que não seja final); (3) uma execução viva por etapa / chave por execução; (4) revisor ≠ autor e ≠ quem julga depois; (5) ajuste volta ao autor e teto 6; (6) sem ciclo de dependência, cascata em cancelamento/falha; (7) só o fundador muda prioridade/prazo; (8) nada externo sem ok registrado e no máximo 1 vez; (9) aprovada só com portões passados, nenhum padrão aprova; (10) nenhum PRONTO com informação velha; (11) toda mensagem acaba em card/resposta/lista (se couber); (12) falha de infra não gasta tentativa mas tem teto e chama o fundador; (13) histórico reconstrói o card (o estado final é função do log de eventos). Para cada regra que NÃO couber na tabela, diga por quê e quem cobre (vigia/relógio/banco). Imprima: número de estados, de transições e tempo. Deve rodar em menos de 60 s. Também uma função replay(jornada) que lê uma jornada (lista de eventos com papel) e devolve o estado final e as violações — será usada pelas jornadas de ponta a ponta de cada agente. Defina o formato da jornada num esquema ${V2}/maquina/jornada.schema.json.
4. test_maquina.py — pytest: a tabela real passa; e TESTES DE MUTAÇÃO que provam que a prova pega o defeito: remover o dono de um estado; criar uma saída de um final; permitir REVISOR aprovar a própria entrega; tirar o teto de reprovação (laço infinito); permitir padrão do relógio aprovar entrega; permitir PRONTO depois de DECISAO_MUDOU sem refazer; permitir o agente executar ação externa; permitir AUTOR que leu a internet PERGUNTAR. No mínimo 10 mutações.
Rode: cd ${V2} && python maquina/provar.py && python -m pytest -q maquina/test_maquina.py — e corrija até ficar verde. Não toque em outros arquivos de ${V2}. Devolva o resumo estruturado com a saída real dos testes.`, { label: 'maquina:desenhar-e-provar', phase: 'Máquina', schema: MAQ_SCHEMA })

const ATAQUE_SCHEMA = {
  type: 'object',
  properties: {
    furos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          cenario: { type: 'string', description: 'sequência concreta de eventos/arquivos que leva ao erro' },
          consequencia: { type: 'string' },
          onde: { type: 'string', description: 'arquivo e trecho' },
          conserto: { type: 'string' },
          teste: { type: 'string', description: 'teste que provaria o conserto' },
          gravidade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        },
        required: ['titulo', 'cenario', 'consequencia', 'onde', 'conserto', 'teste', 'gravidade'],
      },
    },
  },
  required: ['furos'],
}

const ataqueMaq = await parallel([
  'LENTE TÉRMINO E DONOS: procure um caminho na tabela que não termina, um estado aberto sem dono ou sem prazo, um final com saída, um contador sem teto, ou uma combinação que a prova não explora (configuração pequena demais, evento faltando, papel faltando). Rode provar.py e leia o código: a prova realmente explora tudo o que diz?',
  'LENTE AUTORIDADE E REGRAS: procure um caminho em que alguém faz o que não pode: revisor aprova a própria peça ou julga o que revisou; padrão/relógio aprova; agente executa ação externa; ação externa executa 2 vezes; agente muda prioridade; quem leu internet pergunta; card PRONTO com decisão velha; resposta atrasada de execução antiga grava. Compare a tabela com as 13 regras do plano v3 e com a crítica (04).',
].map((lente, i) => () => agent(`${CTX}

Você é atacante independente da MÁQUINA DE PASSAGENS recém-escrita em ${V2}/maquina/ (vocabulario.yaml, passagens.yaml, provar.py, test_maquina.py, jornada.schema.json). Somente leitura: NÃO edite arquivos.
${lente}
Traga só furos reais e concretos, com cenário reproduzível. Se não achar nada sério, devolva lista vazia.
Resumo do autor: ${JSON.stringify(maquina)}`, { label: `maquina:ataque-${i + 1}`, phase: 'Máquina', schema: ATAQUE_SCHEMA })))

const furosMaq = ataqueMaq.filter(Boolean).flatMap(r => r.furos)
log(`Máquina: ${furosMaq.length} furos apontados pelos atacantes.`)

const maquinaFinal = furosMaq.length ? await agent(`${CTX}

Você é o autor da MÁQUINA DE PASSAGENS em ${V2}/maquina/. Dois atacantes independentes apontaram os furos abaixo. Para cada um: confirme lendo o código/tabela (se for falso, explique por quê); se for real, CONSERTE na tabela/prova e acrescente um teste de mutação que pegaria o furo. Rode cd ${V2} && python maquina/provar.py && python -m pytest -q maquina/test_maquina.py até verde. Só edite ${V2}/maquina/.
FUROS:
${JSON.stringify(furosMaq, null, 1)}`, { label: 'maquina:consertar', phase: 'Máquina', schema: MAQ_SCHEMA }) : maquina

// ---------------------------------------------------------------- Contratos
phase('Contratos')
const CONTRATO_SCHEMA = {
  type: 'object',
  properties: {
    arquivos: { type: 'array', items: { type: 'string' } },
    agentes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, nome: { type: 'string' }, arquivo_ficha: { type: 'string', description: 'caminho que a ficha deve ter: agents/<nome>.yaml' },
          servicos: { type: 'array', items: { type: 'string' } },
          tipos_de_entrega_que_possui: { type: 'array', items: { type: 'string' } },
          revisor: { type: 'string' }, reserva: { type: 'string' },
          ferramentas: { type: 'array', items: { type: 'string' } },
          fase_de_ativacao: { type: 'string' },
          resumo_do_papel: { type: 'string' },
        },
        required: ['id', 'nome', 'arquivo_ficha', 'servicos', 'tipos_de_entrega_que_possui', 'revisor', 'reserva', 'ferramentas', 'fase_de_ativacao', 'resumo_do_papel'],
      },
    },
    sobreposicoes_resolvidas: { type: 'array', items: { type: 'string' } },
    decisoes_para_o_fundador: { type: 'array', items: { type: 'string' } },
    resultado_validacao: { type: 'string' },
  },
  required: ['arquivos', 'agentes', 'sobreposicoes_resolvidas', 'decisoes_para_o_fundador', 'resultado_validacao'],
}

const contratosPrompt = (extra) => `${CTX}

ETAPA: CONTRATOS E CATÁLOGO DOS 21 AGENTES. Você é o arquiteto da organização. A máquina de passagens já existe em ${V2}/maquina/ (use EXATAMENTE os nomes de ${V2}/maquina/vocabulario.yaml). Resumo dela: ${JSON.stringify(maquinaFinal)}

Leia: ${MAIN}/docs/AGENTES-SISTEMA-HELENA.md (21 agentes), ${MAIN}/services/helena-gateway/src/agent-quality-contracts.json, as MEL-26, MEL-27, MEL-28, MEL-29, MEL-30, MEL-31, MEL-34, MEL-35 e a seção 5 (Estrutura proposta) de ${PAC}/03-analise-especialistas.md, a crítica ${PAC}/04-critica-da-analise.md e a conferência ${MAIN}/docs/CONFERENCIA-HELENA-V2-X-PLANO-V3.md.

Escreva em ${V2}/:
1. schemas/agent.schema.json (v3.1, SUBSTITUI o antigo): id, nome, funcao, papel, empresas atendidas, servicos (ids do catálogo), acoes_permitidas por serviço (do vocabulário), ferramentas (só as NOSSAS: "ler_pagina" e "buscar", cada uma com efeito LER; nenhuma de efeito externo; lista sempre por extenso, vazia permitida e significando "servidor vazio"), orcamento por serviço em CHAMADAS e TEMPO (buscas, partes_de_pagina, chamadas_total, tempo_s — não "passos"), revisor e reserva (por serviço), modelo (apelido), regras, nunca, aprendizados (inativos até prova), fase_de_ativacao (v2.0 / fase 3 / fase 4) e estado (ATIVO, ESTAGIO, PAUSADO).
2. schemas/entrega.schema.json — formato de um tipo de entrega: descricao, dono (agente), secoes (com tipo de campo: texto, lista, tabela, numero, citacao), limite, checagens_codigo (cada uma com ID estável CHK-..., descrição e qual furo fecha), rubrica tipada (critérios com ID RUB-..., pergunta verificável, evidência exigida, veredito PASSOU/FALHOU/NAO_CONSIGO_CONFERIR), criterio_de_pronto em 3 camadas (código, rubrica, fundador quando externo), temas_obrigatorios (se houver), revisor_confere (o que o revisor olha), entrada_minima.
3. schemas/acao.schema.json — saída tipada das ações de cada papel (5 do autor + respostas do revisor, Helena e fundador), alinhada ao vocabulário.
4. schemas/card.schema.json (v3.1, SUBSTITUI): ordem de serviço (empresa, o_que_quer, como_e_o_pronto, prazo com hora de Brasília, prioridade, nao_pode, pedido_original), estado do vocabulário, card_anterior (ajuste depois de pronto), versao do card, id_mensagem_origem (número único da mensagem), decisoes_versao, sem 👍/👎 (botões do vocabulário).
5. schemas/playbook.schema.json (v3.1, SUBSTITUI): etapas com responsavel por SERVIÇO, entradas, depende_de, revisor e reserva derivados do catálogo, se_semaforo com max_ciclos coerente com a tabela, acoes_do_fundador, orçamento da meta em chamadas.
6. organograma.yaml — o fundador, a Helena e os 21 em grupos funcionais, com as 4 empresas como contexto do card (não 21 por empresa), Laura com escopo pessoal, personagens eLiving fora.
7. servicos.yaml — O CATÁLOGO: TODOS os serviços dos 21 agentes (cada agente com pelo menos 1 serviço SÓ dele; nenhum serviço com dois donos; cada tipo de entrega com exatamente 1 dono), e para cada serviço: id (SRV-...), dono, tipo_de_entrega, revisor, reserva, ações permitidas, ferramentas, usa_internet (se sim: só ENTREGAR ou REGISTRAR_FALHA), efeito (sempre interno; o que for externo vira acao_do_fundador), fase_de_ativacao, empresas. RESOLVA AS SOBREPOSIÇÕES apontadas na análise (Marina x motor: o motor coordena; Marina vira serviço de conteúdo, ex. plano de projeto/cronograma para o fundador; Bruno x revisor: Bruno testa produto/software, não é revisor universal; Olívia x Felipe; Augusto x Camila x Nina; Laura). MATRIZ DE REVISÃO SEM CONFLITO: revisor ≠ dono; quem revisa um tipo não pode julgá-lo depois num parecer; reserva ≠ dono e ≠ revisor; cada revisor tem o tipo em "revisa"; Helena não pode ser revisora de tudo (gargalo) — distribua; o relatório final tem regra explícita (crítica ponto 12: quem revisa o relatório só confere fidelidade às entregas aprovadas e linguagem, e isso fica escrito).
8. models.yaml (SUBSTITUI): apelidos SEM modelo reserva (plano v3: reserva configurado já fica ligado no Hermes), provedor openai-codex, e a política de cota do plano (orçamento diário da v2, ordem de prioridade).
NÃO escreva as fichas dos agentes nem os tipos de entrega (outra etapa, uma por agente) — mas o catálogo deve dizer, para cada agente, o caminho da ficha (agents/<nome-sem-acento-minusculo>.yaml) e os tipos de entrega que ele possui (deliverables/<tipo>.yaml).
Valide que os YAML/JSON carregam e que servicos.yaml respeita a matriz (escreva um script rápido em /tmp se quiser, mas não deixe arquivos extras em ${V2}). Não edite ${V2}/maquina/, agents/, deliverables/, validar.py nem playbooks/.
${extra}
Devolva o resumo estruturado com a lista dos 21 agentes como ficou no catálogo.`

const contratos0 = await agent(contratosPrompt(''), { label: 'contratos:desenhar', phase: 'Contratos', schema: CONTRATO_SCHEMA })

const ataqueContratos = await parallel([
  'LENTE ORGANIZAÇÃO E PONTA A PONTA: cada um dos 21 tem serviço próprio, útil para as 4 empresas, sem sobreposição? Algum serviço que as empresas precisam (vendas, atendimento, finanças, jurídico, marketing, produto, operação, dados, pessoas, administração) ficou sem dono ou com dois donos? Algum agente ficou sem caminho de ponta a ponta (sem revisor possível, sem reserva, sem fase)? Personagens eLiving entraram como funcionários?',
  'LENTE REGRA 4 E GARGALO: monte a matriz revisor x dono x reserva e procure conflitos: revisor = dono; reserva = dono ou = revisor; quem revisa julga depois; ciclo de revisão em que A revisa B e B revisa A no mesmo card de forma que um aprove o que vai julgar; um revisor com tipos demais (gargalo); revisor sem o tipo em "revisa"; serviço com internet que permite PERGUNTAR; ferramenta de efeito externo; modelo com reserva; orçamento em "passos".',
].map((lente, i) => () => agent(`${CTX}

Você é atacante independente dos CONTRATOS recém-escritos em ${V2}/ (schemas/*.json, organograma.yaml, servicos.yaml, models.yaml), contra a máquina em ${V2}/maquina/vocabulario.yaml. Somente leitura.
${lente}
Só furos reais e concretos. Resumo do autor: ${JSON.stringify(contratos0)}`, { label: `contratos:ataque-${i + 1}`, phase: 'Contratos', schema: ATAQUE_SCHEMA })))

const furosContratos = ataqueContratos.filter(Boolean).flatMap(r => r.furos)
log(`Contratos: ${furosContratos.length} furos apontados.`)
const contratos = furosContratos.length ? await agent(contratosPrompt(`\nREVISÃO: você já escreveu esses arquivos. Atacantes independentes apontaram os furos abaixo. Confirme cada um lendo os arquivos; conserte os reais (se falso, explique). FUROS:\n${JSON.stringify(furosContratos, null, 1)}`), { label: 'contratos:consertar', phase: 'Contratos', schema: CONTRATO_SCHEMA }) : contratos0

const agentesLista = (contratos && contratos.agentes) || []
log(`Catálogo com ${agentesLista.length} agentes.`)

// ---------------------------------------------------------------- Agentes (pipeline por agente)
phase('Agentes')
const AGENTE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    arquivos_escritos: { type: 'array', items: { type: 'string' } },
    servicos: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, criterio_de_pronto: { type: 'string' }, casos_bons: { type: 'integer' }, defeitos_plantados: { type: 'integer' } }, required: ['id', 'criterio_de_pronto', 'casos_bons', 'defeitos_plantados'] } },
    jornada: { type: 'string', description: 'arquivo da jornada de ponta a ponta e resultado do replay' },
    pedidos_ao_catalogo: { type: 'array', items: { type: 'string' }, description: 'mudanças necessárias em servicos.yaml/organograma/esquemas que só o integrador pode fazer' },
    resultado_checagem: { type: 'string', description: 'saída real das validações que você rodou' },
  },
  required: ['id', 'arquivos_escritos', 'servicos', 'jornada', 'pedidos_ao_catalogo', 'resultado_checagem'],
}

const agentePrompt = (a, extra) => `${CTX}

ETAPA: AGENTE ${a.id} — ${a.nome}. Você é o especialista que treina este funcionário de IA para trabalhar de ponta a ponta, sem erro de processo. O catálogo já está em ${V2}/servicos.yaml e ${V2}/organograma.yaml; os esquemas em ${V2}/schemas/ (agent, entrega, acao, card, playbook); a máquina em ${V2}/maquina/ (vocabulario.yaml, passagens.yaml, provar.py com replay(), jornada.schema.json). Leia-os antes. Linha do catálogo para este agente: ${JSON.stringify(a)}.
Leia também a descrição dele em ${MAIN}/docs/AGENTES-SISTEMA-HELENA.md, os contratos de qualidade da v1 (${MAIN}/services/helena-gateway/src/agent-quality-contracts.json) e, se existir, a ficha antiga em ${V2}/agents/ (as 5 antigas: helena, caio, clara, isabela, ravi — reescreva no formato novo, guardando o que estava certo e corrigindo os 22 pontos da conferência que o tocam).

ESCREVA (somente estes arquivos, deste agente):
1. ${V2}/${a.arquivo_ficha} — ficha v3.1 que passa no ${V2}/schemas/agent.schema.json, com: missão, serviços, ações permitidas por serviço, ferramentas (só as nossas, por extenso), orçamento por serviço em chamadas e tempo (calibrado: diga a conta), revisor e reserva iguais ao catálogo, regras (no máximo 12, verificáveis), nunca (incluindo nada externo), o que ele faz quando falta dado (REGISTRAR_FALHA com motivo, nunca inventar), fase de ativação e estado.
2. Para cada tipo de entrega que ele POSSUI no catálogo: ${V2}/deliverables/<tipo>.yaml que passa no ${V2}/schemas/entrega.schema.json — seções, limites, checagens por código com ID (o que dá para conferir por código: seções presentes, tamanho, português, sem HTML, citação contínua de página lida, contas refeitas, termos proibidos, temas obrigatórios, "o agente diz que agiu fora"), rubrica tipada com critérios verificáveis (com evidência exigida), critério de pronto em 3 camadas, o que o revisor confere. Para o jurídico (Clara): temas obrigatórios e a tabela de leis do plano (LGPD, Código Civil, Lei 9.610/98, Marco Civil, CDC, CLT, ECA Digital, Lei 15.123/2025) com a URL oficial e "texto a conferir" — não invente texto de lei. Para o Caio: modelo de cálculo com entradas (com origem: dado do fundador, fonte datada ou premissa) e fórmulas que o código refaz. Para o convite (Isabela): sem nenhum termo de ganho e sem receber números do Caio. Para a Helena: card, plano (só por roteiro na v2.0) e relatório final montado a partir das entregas aprovadas.
3. Casos de teste por serviço em ${V2}/casos/<id-do-servico>/: pedido.yaml (um pedido realista de UMA das 4 empresas, com o pacote da empresa: grafia, voz, proibições), pelo menos 3 boas/ (respostas corretas, curtas, no formato) e pelo menos 4 defeitos/ (respostas com um defeito plantado cada, com o campo "deve_falhar_em" apontando o ID da checagem ou da rubrica que pega), e fitas/ com respostas de ferramenta gravadas quando o serviço usa internet. Varie as empresas entre os serviços.
4. Jornada de ponta a ponta: ${V2}/casos/<id-do-servico-principal>/jornada.yaml no formato ${V2}/maquina/jornada.schema.json — o card desse agente andando pela tabela do começo ao fim: pedido do fundador, confirmação, etapa na fila, execução, validação, uma reprovação com critério, correção, aprovação, e o final; e uma segunda jornada curta (jornada-falha.yaml) com um caminho de falha (ex.: cota esgotada, falta de dado ou ação externa proposta) que termina com o fundador chamado. Rode o replay de ambas: cd ${V2} && python -c "import sys; sys.path.insert(0,'maquina'); import provar; ..." (descubra a função em provar.py) e confirme zero violações.
Valide a ficha e cada entrega contra os esquemas com jsonschema (script rápido; não deixe arquivos extras). NÃO edite servicos.yaml, organograma.yaml, schemas, maquina, validar.py, playbooks nem arquivos de outro agente — se precisar mudar algo neles, escreva em "pedidos_ao_catalogo".
${extra}
Devolva o resumo estruturado.`

const ataqueAgentePrompt = (a, r) => `${CTX}

Você é atacante independente do AGENTE ${a.id} — ${a.nome}. Somente leitura. Arquivos escritos pelo autor: ${JSON.stringify(r && r.arquivos_escritos)}. Catálogo: ${V2}/servicos.yaml. Esquemas: ${V2}/schemas/. Máquina: ${V2}/maquina/.
Tente QUEBRAR o ponta a ponta deste agente: (a) a ficha diverge do catálogo (revisor, reserva, ferramentas, serviços) ou do esquema; (b) uma regra da ficha manda o agente fazer algo externo, inventar dado, ou decidir processo (prioridade, fila, destino); (c) o orçamento não fecha (chamadas < buscas + partes + 1 resposta; tempo curto demais); (d) o critério de pronto não é verificável ou a rubrica tem critério subjetivo sem evidência; (e) um defeito plantado nos casos NÃO seria pego pela checagem/rubrica apontada, ou um caso "bom" falharia; (f) a jornada não exercita revisão, correção e final, ou o replay tem violação; (g) o agente usa internet e pode PERGUNTAR/DEVOLVER; (h) faltou tema obrigatório do domínio dele (ex.: jurídico, finanças, atendimento ao cliente com dados pessoais/LGPD, vendas sem promessa enganosa, saúde sem orientação médica individual, eLiving sem virar app de calorias); (i) a entrega pode vazar dado pessoal ou chave. Rode as validações e o replay você mesmo. Só furos reais, com o trecho.
Resumo do autor: ${JSON.stringify(r)}`

const porAgente = await pipeline(agentesLista,
  a => agent(agentePrompt(a, ''), { ...(['AGT-01','AGT-02','AGT-03','AGT-04','AGT-05'].includes(a.id) ? {} : { model: 'sonnet' }), label: `agente:${a.id}:${a.nome}`, phase: 'Agentes', schema: AGENTE_SCHEMA }),
  (r, a) => agent(ataqueAgentePrompt(a, r), { model: 'sonnet', label: `agente:${a.id}:ataque`, phase: 'Agentes', schema: ATAQUE_SCHEMA }).then(at => ({ r, at })),
  ({ r, at }, a) => {
    const furos = (at && at.furos) || []
    if (!furos.length) return { a, r, furos: [] }
    return agent(agentePrompt(a, `\nREVISÃO: você já escreveu os arquivos deste agente (${JSON.stringify(r && r.arquivos_escritos)}). Um atacante independente apontou os furos abaixo. Confirme cada um; conserte os reais nos SEUS arquivos (se o conserto exigir mudar catálogo/esquema/máquina, ponha em pedidos_ao_catalogo). FUROS:\n${JSON.stringify(furos, null, 1)}`), { model: 'sonnet', label: `agente:${a.id}:consertar`, phase: 'Agentes', schema: AGENTE_SCHEMA })
      .then(r2 => ({ a, r: r2 || r, furos }))
  })

const feitos = porAgente.filter(Boolean)
const pedidos = feitos.flatMap(x => ((x.r && x.r.pedidos_ao_catalogo) || []).map(p => `${x.a.id} ${x.a.nome}: ${p}`))
log(`Agentes: ${feitos.length}/${agentesLista.length} concluídos; ${feitos.reduce((s, x) => s + x.furos.length, 0)} furos achados e tratados; ${pedidos.length} pedidos ao catálogo.`)

// ---------------------------------------------------------------- Integração
phase('Integração')
const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    arquivos: { type: 'array', items: { type: 'string' } },
    regras_do_validador: { type: 'array', items: { type: 'string' }, description: 'cada checagem com o furo que fecha' },
    testes: { type: 'string', description: 'quantos testes e de mutação, e a saída real' },
    roteiros: { type: 'array', items: { type: 'string' } },
    pedidos_atendidos: { type: 'array', items: { type: 'string' } },
    pedidos_recusados: { type: 'array', items: { type: 'string' } },
    pendencias: { type: 'array', items: { type: 'string' } },
    verde: { type: 'boolean' },
  },
  required: ['arquivos', 'regras_do_validador', 'testes', 'roteiros', 'pedidos_atendidos', 'pedidos_recusados', 'pendencias', 'verde'],
}

const integPrompt = (extra) => `${CTX}

ETAPA: INTEGRAÇÃO. Você é o único escritor agora. Estado: máquina em ${V2}/maquina/, contratos em ${V2}/schemas/, ${V2}/servicos.yaml, ${V2}/organograma.yaml, ${V2}/models.yaml; fichas em ${V2}/agents/; entregas em ${V2}/deliverables/; casos e jornadas em ${V2}/casos/.
Faça:
1. Aplique os pedidos ao catálogo/esquemas/máquina vindos das etapas dos agentes (abaixo), quando forem corretos; recuse os que ferem as regras, explicando. Depois de mudar o catálogo, ajuste as fichas afetadas para continuarem iguais ao catálogo.
2. Remova o que ficou obsoleto: ${V2}/deliverables/entregas.yaml (substituído por um arquivo por tipo) e qualquer ficha antiga fora do catálogo. Atualize ${V2}/README.md (estrutura nova, como rodar, regras de ouro) e ${V2}/requirements.txt (pyyaml, jsonschema, pytest com versões fixas).
3. Roteiros de ponta a ponta em ${V2}/playbooks/ que passem no schemas/playbook.schema.json:
   - recrutar-10-pessoas.yaml (Humano Digital BIZ-003) corrigido pela conferência e pelo plano v3: E3 (convite) SEM depender de E1 e sem números; E4 Clara julga E2 e E3 com AJUSTE de até 2 voltas; E5 relatório com a regra de revisão do catálogo; ações do fundador; orçamento da meta em chamadas; Ravi fora.
   - um roteiro real para CADA uma das outras 3 empresas (iGreen, Saúde, eLiving™), cada um usando pelo menos 4 agentes diferentes de grupos diferentes, com pelo menos uma etapa jurídica ou de risco quando houver ato externo previsto, e ações do fundador para tudo que é externo. Use os códigos de empresa que existirem nos documentos (se não houver, deixe "BIZ-???" e registre como decisão do fundador). eLiving: respeite os 4 pilares e "nunca app de calorias".
   - para cada roteiro, uma jornada de ponta a ponta em ${V2}/playbooks/jornadas/<roteiro>.yaml que o replay da máquina percorra até o final sem violação.
4. Reescreva ${V2}/validar.py para a v3.1 (SUBSTITUI): valida contra os esquemas todas as fichas, entregas, catálogo, organograma, roteiros, casos e jornadas; cruza ficha x catálogo; matriz de revisão (revisor ≠ dono, reserva ≠ dono/revisor, quem revisa não julga depois, revisor tem o tipo em revisa); cada tipo com exatamente 1 dono e cada agente com ≥1 serviço próprio; ferramentas só as nossas e de efeito LER; serviço com internet só ENTREGAR/REGISTRAR_FALHA; orçamento em chamadas fecha; models.yaml sem reserva; nenhum termo de ganho no tipo do convite; convite sem entrada de cálculo; cada defeito plantado tem "deve_falhar_em" apontando checagem/rubrica que existe; cada serviço com ≥3 bons e ≥4 defeitos; toda jornada e roteiro passa no replay; roda a prova da máquina; IDs de checagem/rubrica únicos. Mensagens de erro em português.
5. Reescreva ${V2}/test_validar.py (SUBSTITUI): as especificações reais passam; e um TESTE DE MUTAÇÃO para CADA regra do validador (mude o dado real e prove que o validador recusa). Inclua os 8 antigos que ainda fizerem sentido.
6. Rode: cd ${V2} && python validar.py && python -m pytest -q — e corrija até tudo verde. Você pode corrigir qualquer arquivo de ${V2}/ para isso, mas sem afrouxar regra: se um dado está errado, conserte o dado, não a regra.
PEDIDOS AO CATÁLOGO:
${pedidos.join('\n') || '(nenhum)'}
${extra}
Devolva o resumo estruturado com a saída real dos testes.`

let integ = await agent(integPrompt(''), { model: 'sonnet', label: 'integracao', phase: 'Integração', schema: INTEG_SCHEMA })
let tentativas = 0
while (integ && !integ.verde && tentativas < 2) {
  tentativas++
  log(`Integração ainda não verde; nova rodada de conserto ${tentativas}/2.`)
  integ = await agent(integPrompt(`\nREVISÃO ${tentativas}: na rodada anterior ficou pendente: ${JSON.stringify(integ.pendencias)}. Termine até ficar verde.`), { model: 'sonnet', label: `integracao:conserto-${tentativas}`, phase: 'Integração', schema: INTEG_SCHEMA })
}

// ---------------------------------------------------------------- Ataque até secar
phase('Ataque')
const LENTES_ATAQUE = [
  { key: 'ciclo', texto: 'CICLO DO CARD E MÁQUINA: caminhos da tabela, replay das jornadas, roteiros, cancelamento em cascata, informação velha, tetos, donos e prazos, respostas atrasadas, ajustes do fundador sem fim, card pronto que volta a andar.' },
  { key: 'qualidade', texto: 'QUALIDADE DO CONTEÚDO: checagens por código que não pegam o defeito, rubricas subjetivas, casos bons que deveriam falhar e defeitos que passam, citação, contas do Caio, lei inventada, temas obrigatórios faltando, termos de ganho escondidos, relatório final infiel às entregas.' },
  { key: 'organizacao', texto: 'ORGANIZAÇÃO E PONTA A PONTA DOS 21: algum agente que não consegue ir do pedido ao final (sem revisor/reserva viável, serviço sem caso, jornada que não exercita revisão), sobreposição de serviços, gargalo de revisão, empresa sem roteiro, eLiving fora das regras da marca, Laura misturada com empresas, fichas que divergem do catálogo.' },
  { key: 'seguranca', texto: 'SEGURANÇA, AUTORIZAÇÃO E RESTRIÇÕES: qualquer caminho em que um agente age fora, gasta, publica ou contata; ferramenta com efeito externo; internet que leva a pergunta ou pedido; dado pessoal ou chave em caso de teste; algo que fere a DEC-014; regra que depende do motor (DBOS ou próprio) e quebra se a decisão do motor mudar; validador que afrouxa por exceção.' },
]

const VERD_SCHEMA = {
  type: 'object',
  properties: { real: { type: 'boolean' }, motivo: { type: 'string' }, evidencia: { type: 'string' } },
  required: ['real', 'motivo', 'evidencia'],
}

const visto = new Set()
const confirmadosTodos = []
let secas = 0
let rodada = 0
while (secas < 2 && rodada < 4) {
  rodada++
  const achados = (await parallel(LENTES_ATAQUE.map(l => () => agent(`${CTX}

ATAQUE RODADA ${rodada} — lente ${l.texto}
Você é atacante independente de TODA a especificação v3.1 em ${V2}/ (maquina/, schemas/, servicos.yaml, organograma.yaml, models.yaml, agents/, deliverables/, casos/, playbooks/, validar.py, test_validar.py). Somente leitura. Rode cd ${V2} && python validar.py && python -m pytest -q para ver o estado. Compare com o plano v3 (${PAC}/01-plano-v3.md) e a crítica (${PAC}/04-critica-da-analise.md).
Traga até 8 furos NOVOS, reais, com cenário concreto e trecho de arquivo. Não repita estes já tratados: ${JSON.stringify([...visto].slice(-80))}`, { model: 'sonnet', label: `ataque:r${rodada}:${l.key}`, phase: 'Ataque', schema: ATAQUE_SCHEMA })))).filter(Boolean).flatMap(r => r.furos)

  const chave = f => (f.onde + '|' + f.titulo).toLowerCase().replace(/\s+/g, ' ').slice(0, 160)
  const novos = achados.filter(f => !visto.has(chave(f)))
  novos.forEach(f => visto.add(chave(f)))
  if (!novos.length) { secas++; log(`Rodada ${rodada}: nenhum furo novo (${secas}/2 secas).`); continue }

  const julgados = await parallel(novos.map(f => () => parallel([0, 1].map(k => () => agent(`${CTX}

Você é verificador cético. Tente REFUTAR o furo abaixo lendo os arquivos citados em ${V2}/ e rodando o que precisar (somente leitura). Se o cenário não acontece de verdade com os arquivos atuais, ou já é coberto por outra regra/teste, real=false. Na dúvida, real=false.${k === 1 ? ' Foque em: o conserto proposto não piora outra regra?' : ''}
FURO: ${JSON.stringify(f)}`, { model: 'sonnet', label: `ataque:r${rodada}:verificar`, phase: 'Ataque', schema: VERD_SCHEMA })))
    .then(vs => ({ f, reais: vs.filter(Boolean).filter(v => v.real).length, vs }))))
  const confirmados = julgados.filter(Boolean).filter(j => j.reais >= 2).map(j => j.f)
  log(`Rodada ${rodada}: ${novos.length} novos, ${confirmados.length} confirmados pelos dois verificadores.`)
  if (!confirmados.length) { secas++; continue }
  secas = 0
  confirmadosTodos.push(...confirmados.map(f => ({ ...f, rodada })))

  integ = await agent(integPrompt(`\nCONSERTO DO ATAQUE RODADA ${rodada}: dois verificadores independentes confirmaram os furos abaixo. Conserte cada um (no dado ou na regra, nunca afrouxando), acrescente um teste de mutação que pegaria cada furo, e rode tudo até verde. Na saída, em pendencias, liste algum que você não conseguiu fechar, com o motivo. FUROS:\n${JSON.stringify(confirmados, null, 1)}`), { model: 'sonnet', label: `ataque:r${rodada}:consertar`, phase: 'Ataque', schema: INTEG_SCHEMA })
}
if (secas < 2) log(`Ataque parou no limite de ${rodada} rodadas sem 2 rodadas secas seguidas — ainda pode haver furo; registrado no relatório.`)

// ---------------------------------------------------------------- Relatório
phase('Relatório')
const relatorio = await agent(`${CTX}

Você é o redator final. Escreva ${PAC}/05-plano-ponta-a-ponta-21-agentes.md (crie o arquivo), em português simples para o fundador ler no celular (frases completas, sem jargão, termos técnicos explicados entre parênteses), sobre o que foi construído NESTA rodada, só em arquivos. Confira os fatos rodando cd ${V2} && python validar.py && python -m pytest -q e lendo os arquivos — não afirme nada que não conferiu.
Estrutura:
1. Resposta direta (até 8 linhas): o que ficou pronto, se todos os 21 vão de ponta a ponta no papel e na prova, o que ainda falta para ir ao ar (as fases 0, 2 e 3 do plano, que dependem de construir o motor e das frases dele), e a frase honesta sobre furos ("nenhum furo conhecido em aberto" só se for verdade; senão diga quantos e quais).
2. Como a lógica ficou exata: a tabela de passagens (estados, quem age, tetos), a prova (tamanho impresso: estados e transições), as regras de ferro cobertas pela prova e as que ficam com o vigia/relógio/banco, e o que isso garante e o que não garante.
3. A equipe: tabela dos 21 (nome, função, serviços, quem revisa, reserva, fase de ativação), como as sobreposições foram resolvidas, e o organograma.
4. Ponta a ponta: para cada agente, a jornada que ele percorre (1 linha) e os casos de teste (bons e defeitos plantados); para cada empresa, o roteiro e quem participa.
5. O validador e os testes: quantas regras, quantos testes de mutação, resultado real.
6. Furos: quantos os ataques acharam por rodada, quantos foram confirmados e consertados, quantos ficaram abertos (com o motivo), e como o próximo furo aparece.
7. O que depende dele (lista de marcar): decisão do motor, códigos das empresas que faltaram, decisões que o catálogo deixou para ele, a frase de aprovação proposta (sem inventar número de versão: diga "a versão que estiver no commit").
8. Onde está cada coisa (árvore de pastas de helena-v2/).
DADOS: máquina=${JSON.stringify(maquinaFinal)}
contratos=${JSON.stringify(contratos)}
agentes=${JSON.stringify(feitos.map(x => ({ id: x.a.id, nome: x.a.nome, servicos: x.r && x.r.servicos, jornada: x.r && x.r.jornada, furos_tratados: x.furos.length })))}
integracao=${JSON.stringify(integ)}
ataque: rodadas=${rodada}, secas_finais=${secas}, confirmados=${JSON.stringify(confirmadosTodos)}
Devolva como texto o conteúdo completo do arquivo que você escreveu.`, { model: 'sonnet', label: 'relatorio', phase: 'Relatório' })

return { maquina: maquinaFinal, contratos, agentes: feitos.map(x => ({ id: x.a.id, nome: x.a.nome, r: x.r, furos: x.furos })), integracao: integ, ataque: { rodadas: rodada, secas, confirmados: confirmadosTodos }, relatorio }
