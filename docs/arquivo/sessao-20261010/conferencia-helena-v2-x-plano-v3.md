# Conferência: especificações da v2 × plano v3

Data: 10/10/2026. Somente leitura: nada foi alterado em banco, servidor ou deploy.

## O que foi comparado

- **Especificações da v2** (`helena-v2/`, branch `missao-cumprida-v4`): fichas dos 5 agentes, modelos de entrega, roteiro das 10 pessoas, esquemas, catálogo de modelos e validador.
- **Plano v3 com motor DBOS** (`docs/planos/sistema-helena-pacote/01-plano-v3.md`, branch `antigravity-planos`) e o registro dos 171 furos (`02-registro-de-furos.md`).
- **Verificação rodada:** `python validar.py` → "OK: especificacoes coerentes"; `pytest test_validar.py` → 9 testes passando.

## Conclusão curta

O validador passa, mas ele confere as especificações contra o **plano anterior**, o de motor feito à mão e 37 furos. O plano v3 com DBOS mudou regras que as fichas e o roteiro ainda não acompanham.

Resultado:
- **4 pontos já existem** e batem com o plano.
- **6 pontos estão parciais.**
- **12 pontos divergem** do plano.
- **4 pontos estão ausentes.**

Seis divergências são de furos que o registro diz fechar **na fase 1**, que é justamente a fase dada como pronta.

Classificação usada (AGENTS.md): JÁ EXISTE · PARCIAL · AUSENTE · DIVERGENTE.

## 1. Divergências que contradizem a fase 1 "pronta"

| # | Ponto | Plano v3 diz | Especificação hoje | Situação |
|---|---|---|---|---|
| 1 | Convite (E3) recebe os números do Caio | "A etapa do convite nem recebe os números do Caio" (C-11, fase 1); na tabela, E3 depende de "Nada" | E3 tem `entradas: [E1, ...]` e `depende_de: [E1]` | DIVERGENTE |
| 2 | Termos de ganho no convite | O código recusa qualquer termo de ganho (reais, dólares, renda, "por hora") | `copy` não tem `checagens_codigo`. A aprovação pede "valores como estimativa variável", e a ficha da Isabela manda usar "valores sempre como estimativa variável". Ou seja, a especificação permite valor no convite | DIVERGENTE |
| 3 | Revisor do relatório final (E5) | Revisora é a Clara, com o Caio de reserva. "Nenhum padrão automático aprova" (regra 9, A-16) | `helena.yaml`: `revisor: CODIGO` + 👍/👎. A Clara não tem `relatorio_final` em `revisa` | DIVERGENTE |
| 4 | Tabela de leis e temas obrigatórios do jurídico | Tabela de leis (LGPD, Código Civil, Lei 9.610/98, Marco Civil, CDC, CLT, ECA Digital, Lei 15.123/2025). Temas obrigatórios: imagem, voz, dado sensível, transferência internacional, menores, vínculo e publicidade (C-10, fases 1 e 3) | O `parecer` só exige semáforo e citação; não lista temas nem tabela de leis | AUSENTE |
| 5 | Voltas de ajuste da Clara | Depois de **2 voltas**, a etapa vai para "em resolução". Teto de 6 execuções por etapa | `se_semaforo.AJUSTE.max_ciclos: 1` | DIVERGENTE |
| 6 | Revisor reserva por etapa | Cada etapa tem reserva: E1 Helena (Clara), E2/E3 Helena (Caio), E4 Helena (você), E5 Clara (Caio) | A ficha não tem campo de reserva. O Caio tem `revisa: []`, então não pode ser reserva de E2/E3. A Clara não revisa `calculo`, então não pode ser reserva de E1 | AUSENTE |

## 2. Divergências de desenho do agente e do motor (fecham na fase 2, mas mudam as fichas)

| # | Ponto | Plano v3 diz | Especificação hoje | Situação |
|---|---|---|---|---|
| 7 | Ferramentas | No máximo "buscar" e "ler página", **nossas**, que guardam cópia da página (K-1, K-19, B-6) | `web_search` e `web_extract` (do Hermes). O esquema ainda aceita `vision_analyze`, `registrar_lancamento`, `get_visual_asset` e `gerar_imagem` | DIVERGENTE |
| 8 | Unidade do orçamento | No modo `hermes -z` não existe limite de passos. O limite é de **chamadas** (buscas, partes de página, total) mais tempo. Clara: 10 buscas, 30 partes, 45 chamadas, 15 min (FC-1, M-3) | `passos` e `buscas`. Clara: 12 buscas, 30 passos. A regra do validador "passos ≥ buscas + extrações + 4" e o teste `test_orcamento_impossivel` medem uma coisa que não existe nesse modo | DIVERGENTE |
| 9 | Modelo reserva | "Nenhum perfil de produção tem provedor ou modelo reserva", porque no Hermes um reserva configurado já fica ligado (C-15, FC-9) | `models.yaml` tem `reserva` em todos os 4 apelidos | DIVERGENTE |
| 10 | Ações permitidas por serviço e efeito de cada ferramenta | A ficha diz quais das 5 ações cada serviço usa, e cada ferramenta diz seu efeito: ler, gravar dentro ou agir fora (B-17) | Não existe esse campo no esquema da ficha | AUSENTE |
| 11 | Cota | Orçamento diário fixo da v2, com ordem de prioridade: Helena recebendo, revisores, cards em andamento, cards novos | `reserva_prioritaria_pct: 30` | PARCIAL |
| 12 | Orçamento de pesquisa da meta | Cota de buscas somando todos os agentes (furo 9) | Meta = 10 buscas, mas a Clara sozinha tem 12. O validador só reclama acima de **3×** a meta (30) | DIVERGENTE |

## 3. Divergências no card e no relatório

| # | Ponto | Plano v3 diz | Especificação hoje | Situação |
|---|---|---|---|---|
| 13 | Avaliação do Fundador | Botões Aprovar, Pedir ajuste (com motivo marcado), Usar como exemplo e Cancelar. O 👍/👎 saiu (FC-13) | `card.schema`: `avaliacao_fundador: POSITIVA/NEGATIVA`. `relatorio_final.revisao_final: FUNDADOR (👍/👎)` | DIVERGENTE |
| 14 | Campos do card | Ordem de serviço: empresa, o que quer, **como é o pronto**, prazo, prioridade, o que não pode. Card pronto não volta a andar: o ajuste abre um card novo **ligado** ao anterior. Cada toque leva a versão vista | Sem `como_e_o_pronto`, sem `card_anterior`, sem versão do card | PARCIAL |
| 15 | Estados do card | 3 finais: pronto, cancelado e encerrado com falha reconhecida. Esperas são estados com dono e prazo | 14 estados do plano antigo (ENTREGUE, AGUARDANDO_ACOES_FUNDADOR, ARQUIVADO…) | DIVERGENTE |
| 16 | Mensagem repetida | Número único da mensagem (WhatsApp ou app) gravado antes da IA (A-8, B-16) | `dedupe_hash` = hash do objetivo e do prazo em 10 min | DIVERGENTE |
| 17 | Confirmação da Helena | Leitura de volta ("Entendi assim… Confirma?") **no pedido grande**. Card novo e ajuste valem na hora, com desfazer | A ficha da Helena exige confirmação em **todo** card novo | DIVERGENTE |

## 4. Qualidade (portão 1, o validador automático)

| # | Ponto | Plano v3 diz | Especificação hoje | Situação |
|---|---|---|---|---|
| 18 | Citação | Trecho contínuo de 12+ palavras de página lida **nesta execução**. Tradução em campo à parte. Fonte oficial = mesmo site do pedido (C-8, M-15) | [Fn] com "trecho literal" e checagem de que o [Fn] existe | PARCIAL |
| 19 | Cálculo do Caio | Modelo com entradas e fórmulas que o código refaz. Cada entrada tem origem (dado seu, fonte com data ou premissa). Câmbio só com fonte datada (K-8, M-16, C-9) | Seções em texto (`conta_por_extenso`), sem `checagens_codigo`. O código não consegue refazer a conta | PARCIAL |
| 20 | Texto que diz ter agido fora ("enviei", "cadastrei") | Recusado pelo código | Não existe essa checagem | AUSENTE |
| 21 | Português, sem HTML, tamanho | Recusado pelo código | Só o limite de tamanho existe | PARCIAL |

## 5. O que já bate

| Ponto | Situação |
|---|---|
| Revisor nunca julga depois o que revisou (M-4): validador + teste | JÁ EXISTE |
| Ravi fora da primeira meta (K-22) | JÁ EXISTE |
| Prioridade da meta como dado (`prioridade: 1`), nunca no texto | JÁ EXISTE |
| Ciclo de dependência, destino inexistente e apelido de modelo inexistente barrados, com teste | JÁ EXISTE |
| Decisões como dado (DEC-024, DEC-025), mas sem escopo nem "substitui" | PARCIAL |

## 6. Inconsistências dentro dos próprios documentos

1. **Dois planos v3 no repositório, com frases de aprovação diferentes.**
   - `docs/PLANO-HELENA-V3.md` (motor no Postgres, sem DBOS): "aprovo o plano v3 e o roteiro das 10 pessoas".
   - `01-plano-v3.md` (DBOS): "… com o motor DBOS".
   - É exatamente o furo M-2, que segue aberto até um dos dois virar histórico.
   - O `validar.py` aponta para o plano antigo (`docs/PLANO-HELENA-V3.md`, seção 4).
2. **O registro ficou atrás do plano em dois pontos.**
   - FC-5 diz que "o card ainda não mostra x de n partes lidas", mas o plano já mostra ("3 de 8 partes").
   - FC-3 diz que "só a compressão automática não é citada", mas o plano já desliga o "resumo automático da conversa".
3. **Mesmo teste, fases diferentes.** O teste 5 (citação) aparece como fase 3 em C-8 e como fase 2 em K-1, K-9 e M-15.
4. **Numeração M com buracos.** Faltam M-12 e M-17 a M-22. A soma (44) bate, mas o registro não diz onde foram parar. Provavelmente foram juntados com outros, mas não está escrito.
5. **"9 de 9 defeitos plantados"**: são 8 defeitos plantados + 1 teste de que as especificações reais passam.
6. **Ponto a observar no E5.** Quem revisa o relatório final (Clara, reserva Caio) é autor de uma entrada do próprio relatório (E4 e E1). Isso é inevitável com 5 agentes, mas a regra 4 deveria dizer isso por extenso. Sugestão: o revisor do relatório confere fidelidade às entregas e linguagem, e não reavalia a própria entrega.

## 7. O que proponho (sem tocar banco, servidor ou deploy)

1. **Unificar o plano.** O `01-plano-v3.md` (DBOS) vira o único. O `docs/PLANO-HELENA-V3.md` vai para histórico, com uma frase de aprovação só (fecha M-2).
2. **Alinhar as especificações ao plano v3**, só em arquivos de `helena-v2/`:
   - E3 sem E1;
   - checagem de termos de ganho em `copy`;
   - Clara revisa `relatorio_final`;
   - reservas por etapa;
   - `max_ciclos: 2`;
   - temas obrigatórios e tabela de leis no `parecer`;
   - ferramentas `buscar` e `ler_pagina`;
   - orçamento em chamadas e tempo;
   - `models.yaml` sem reserva;
   - campo de ações permitidas e efeito das ferramentas;
   - estados e campos do card do plano v3;
   - botões no lugar do 👍/👎.
3. **Um teste de mutação para cada regra nova no validador**, para provar que ele barra o defeito (ex.: convite com "renda" ou E3 dependendo de E1 tem que falhar).
4. **Rodar de novo a conferência** depois disso, antes de pedir a frase de aprovação.
