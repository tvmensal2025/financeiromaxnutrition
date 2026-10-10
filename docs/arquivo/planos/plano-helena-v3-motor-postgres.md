> **Arquivado em 10/10/2026.** Versão anterior do plano v3 (motor no Postgres, 37 furos). Substituída por `docs/plano/PLANO-HELENA-V3.md` (motor DBOS, decisão do fundador de 10/10/2026). Só consulta.

# Sistema Helena v3 — plano consolidado

Data: 09/10/2026. Substitui a v2/v2.1 (`PLANO-ARQUITETURA-V2.md` fica como histórico).
Status: proposta para aprovação do Fundador. A Fase 1 (especificações) já está escrita e validada em `helena-v2/`.

## 1. Como o plano foi construído

1. **Rodada 1.** Plano v2, a partir das lições da v1 e das referências (Anthropic, OpenAI, ICLR 2025, Vercel eve, Railway).
2. **Rodada 2.** Autorrevisão: 8 furos fechados (v2.1).
3. **Rodada 3.** Revisão adversarial independente, feita por outro agente sem acesso ao meu raciocínio. Achou mais 29 furos, vários repetindo erros da v1. Todos estão fechados abaixo.
4. **Fixação.** Cada correção virou regra **verificável por código**: validador das especificações e testes de mutação, que provam que o validador barra cada furo. Não é só texto.

## 2. A empresa em uma frase

O Fundador fala com a Helena → vira **card** → o **motor (código)** move o card pelas etapas → cada especialista entrega num **modelo tipado** → um revisor independente confere por **critérios objetivos** → o card volta com um **relatório legível** → o 👍/👎 do Fundador treina a equipe.

## 3. Os 13 invariantes (o banco recusa qualquer violação)

Ficam no Postgres, com tabela de transições, CHECK e trigger. Não dependem de o modelo "obedecer".

1. Toda tarefa pertence a um card, e toda transição vem da tabela de transições permitidas.
2. O responsável existe, está ativo, produz aquele tipo de entrega e é diferente de quem encaminhou.
3. Revisor ≠ autor. Quem revisou uma entrega não pode julgá-la depois num parecer.
4. Uma etapa só fica PRONTA com dependências APROVADAS e entradas congeladas em snapshot.
5. Despacho só com orçamento (tempo, passos, buscas, cota da meta e cota do provedor) e configuração efetiva igual à ficha.
6. No máximo um lease ativo por tarefa. Gravação só com o token de cerca da tentativa atual; entrega atrasada é recusada.
7. Entrega só avança se passou na checagem mecânica e tem veredito por critério (passou/falhou com evidência). Devolução sem critério citado é inválida.
8. Limites fixos: 2 falhas mecânicas, 1 correção por revisão, 3 tentativas técnicas por classe de falha, 2 replanejamentos por card. Passou do limite, o card vai para AGUARDANDO_FUNDADOR com opções.
9. Prioridade = a do card (definida pelo Fundador) + envelhecimento. Continuação nunca ganha prioridade extra, e meta nova de prioridade maior vence no próximo despacho. Isso acaba com a fila furada que deixou a meta parada em 08/10.
10. Aprovar exige a versão atual das decisões do escopo. Decisão mudou no meio: a entrega é invalidada e refeita.
11. Gasto, contrato, publicação e contato externo só com aprovação do Fundador registrada no card.
12. Todo estado não terminal tem prazo. Vencido o prazo, há transição automática e evento visível; nada fica parado em silêncio.
13. Toda falha tem classe (ou DESCONHECIDA, nunca chute), stderr anexado e próximo passo gravado.

## 4. Furos fechados

| # | Furo | Fechamento | Onde está |
|---|---|---|---|
| 1 | Clara revisava o texto e depois julgava o mesmo texto | Isabela é revisada pela Helena; Clara é a barreira jurídica única | ficha Isabela + validador (testado) |
| 2 | Parecer "com ajuste" não tinha volta | AJUSTE refaz E2/E3 com o parecer como entrada, a Clara reconfere (1 ciclo); NÃO_PODE vai ao Fundador | playbook `se_semaforo` + validador (testado) |
| 3 | Relatório final sem revisão | Checagens de código (sem códigos internos, decisões com 2+ opções, passos com dono e data, números rastreáveis) + 👍/👎 do Fundador | `entregas.yaml` |
| 4 | Helena revisa e consome | Veredito por critério obrigatório + taxa de aprovação dela no painel | invariante 7 |
| 5 | Campo `revisa` ambíguo | O revisor oficial é o campo `revisor` do autor; `revisa` só lista o que cada um pode revisar | validador |
| 6 | Fontes no summary × revisor lendo o conteúdo | Fatos citam [Fn] e a seção `fontes` fica no próprio conteúdo; o código confere se cada [Fn] existe | ficha Ravi + `entregas.yaml` |
| 7 | Orçamento impossível (passos < buscas) | Validador exige passos ≥ buscas + extrações + 4; revisão tem orçamento próprio e menor | fichas + validador (testado) |
| 8 | Decisões só em comentário; entradas da v1 sem mapa | `decisoes` como dado, `entradas` por etapa, entradas externas com ID real e snapshot | playbook + validador (testado) |
| 9 | Cota de pesquisa contava dossiês | `orcamento_meta.buscas` soma as buscas de todos os agentes | playbook + validador |
| 10 | Confirmação "às vezes" | Todo card novo exige confirmação (o código obriga), salvo tipos que o Fundador dispensar | ficha Helena + card |
| 11 | Prioridade como regra de prompt | Escalonador determinístico | invariante 9 |
| 12 | Esquemas faltando | Esquemas de card e playbook criados; `card_id` gerado pelo código | `schemas/` |
| 13 | Bugs do validador | ID duplicado, ID ausente, YAML inválido, apelido de modelo inexistente, playbook validado contra esquema | `validar.py` (testado) |
| 14 | Caio com ferramenta de escrita sem precisar | Removida; lançamento só em card próprio, aprovado pelo Fundador e com chave de idempotência | ficha Caio |
| 15 | Relatório maior que o limite | Entregas aprovadas entram como anexos; o limite vale para o texto principal | `entregas.yaml` |
| 16 | Corrida na renovação do login OAuth | Um único processo dono da renovação (com trava); os workers só leem; alerta antes de expirar | Fase 2 |
| 17 | Cota do ChatGPT compartilhada | Controlador de cota com 30% reservados à prioridade; testes noturnos só com sobra; modelo reserva | `models.yaml` + Fase 2 |
| 18 | Estado oculto do Hermes (memória, skills, terminal) | Sessão nova por tarefa; memória e auto-skills desligadas; ferramentas geradas da ficha; o motor compara a configuração efetiva com a ficha a cada despacho | Fase 2 |
| 19 | Dois workers na mesma tarefa / worker morto | `FOR UPDATE SKIP LOCKED` + lease + heartbeat + token de cerca | invariante 6 |
| 20 | Helena como gargalo | Dois processos: Helena-interface (chat, prioridade máxima) e Helena-revisora; revisor reserva após timeout | Fase 2 |
| 21 | Decisão nova no meio da tarefa | Versão das decisões gravada em cada despacho; mudou → invalida e refaz | invariante 10 |
| 22 | Fundador sem prazo para responder | Lembretes em 4h e 24h; opção padrão só para escolha reversível; alerta de meta em risco | estados |
| 23 | Diagnóstico de falha errado | Classificador determinístico (exit code, HTTP, padrão, limite estourado); DESCONHECIDA quando não encaixa | invariante 13 |
| 24 | Canário estatisticamente inútil | Mudança só entra se passar no banco de casos reais; volta automática ao vivo só por falha dura | Fase 2 |
| 25 | Quem vigia o motor | Heartbeat no Postgres + `pg_cron` independente a cada 2 min + push no app + healthcheck no EasyPanel | Fase 2 |
| 26 | v1 e v2 pegando os mesmos cards | Coluna `motor='v3'` e o despachante da v1 filtra; inventário de triggers antes da Fase 2; importação com snapshot | Fase 2 |
| 27 | Aprendizado criando regras contraditórias | Cada regra nova passa por checagem de conflito + banco de casos + aprovação; quando chega a 12, consolida | Fase 3 |
| 28 | Estados que faltavam (pausar, cancelar, duplicado, ações do Fundador) | Estados explícitos + dedupe por hash em 10 min | `card.schema.json` |
| 29 | Injeção de prompt vinda de páginas web | Web e ferramenta de escrita nunca no mesmo agente (o validador barra); segredos fora dos logs | validador (testado) |
| 30–37 | Os 8 furos da v2.1 (reescrita, contêiner por agente, roteiro rígido, promessa exagerada, Helena como ponto único, revisor viciado, teste só com IA falsa, segurança) | Mantidos fechados: evoluir sem reescrever, isolamento por processo, plano como dado, garantia honesta, motor orquestra, critérios objetivos, dois níveis de teste, Fase 0 de segurança | v2.1 |

## 5. Máquinas de estado

**Card:**
- RASCUNHO → AGUARDANDO_CONFIRMACAO (10 min) → PLANEJANDO → [AGUARDANDO_OK_PLANO] → EM_EXECUCAO → CONSOLIDANDO → ENTREGUE → CONCLUIDO ou AGUARDANDO_ACOES_FUNDADOR.
- Ramos: AGUARDANDO_FUNDADOR (lembretes em 4h e 24h), BLOQUEADO, PAUSADO, CANCELADO, ARQUIVADO (sem confirmação em 72h).
- 👎 reabre a etapa apontada.

**Etapa:**
- PENDENTE → PRONTA → EM_EXECUCAO (lease = tempo + 60 s, heartbeat a cada 30 s) → VALIDANDO (código) → EM_REVISAO → APROVADA.
- DEVOLVIDA → nova tentativa (a 2ª devolução vai ao Fundador).
- FALHA_TECNICA → política por classe.
- APROVADA → INVALIDADA, se uma decisão ou dependência mudou.

Prazo e escalada de cada estado: ver a revisão adversarial no histórico da sessão; serão codificados na tabela de transições.

## 6. Garantia, com honestidade

- **Processo:** nenhuma transição inválida, nenhum card perdido, nenhuma falha silenciosa. O banco recusa, o validador barra antes, os testes provam.
- **Conteúdo:** IA nenhuma garante dado 100% certo. Por isso há camadas: checagem mecânica, revisor independente com critérios, sua aprovação no que é irreversível, e todo erro visível no card.
- **Infraestrutura:** provedor fora do ar ou cota esgotada acontecem. Viram estado visível, com recuperação automática ou opção para você, nunca parada silenciosa.
- **Furos futuros:** cada fase termina com nova revisão adversarial independente antes de seguir. Um furo novo vira regra do validador e teste.

## 7. Fases

| Fase | Entrega | Critério para seguir |
|---|---|---|
| 0 | Segurança: fechar 9119/8642, trocar chaves | Portas fechadas conferidas de fora |
| 1 | Especificações (**feito**): 5 fichas, 7 modelos, playbook, esquemas, validador + 9 testes | Fundador aprova o roteiro |
| 2 | Motor no Postgres (transições, invariantes, lease, escalonador, cota), workers por processo, OAuth único, classificador de falhas, simulador + banco de casos, vigia | 100% dos caminhos no simulador + revisão adversarial sem furo alto |
| 3 | Card no app (relatório, anexos, 👍/👎, "por que travou?") + meta das 10 pessoas de ponta a ponta sem intervenção | Meta entregue sem eu tocar |
| 4 | Demais agentes, um por vez, com placar | ≥ 80% de aprovação na 1ª tentativa |
