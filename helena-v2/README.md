# Helena v2 — especificações (Fase 1)

Fonte única de verdade dos agentes. O motor lê estes arquivos e deles derivam prompts, permissões, roteamento e testes.
Nunca copie uma regra para outro lugar: se mudou, muda aqui.

| Pasta | O que é | Quem lê |
|---|---|---|
| `agents/` | Ficha de cada agente: função, entregas que produz, ferramentas, orçamento, revisor | motor, gerador de prompt, simulador |
| `deliverables/` | Modelos tipados de entrega: seções, limites, critérios objetivos de aprovação | agente (formato), revisor (roteiro), motor (validação/divisão) |
| `playbooks/` | Metas conhecidas -> marcos -> etapas, com responsável por código | motor (roteamento) |
| `schemas/` | Formatos validados: ficha, entrega, playbook, plano-como-dado, card | motor (recusa o que não fecha) |

Regras de ouro:

1. **Processo.** O código decide o processo: estado, destino, liberação, divisão e orçamento. A IA decide o conteúdo e escolhe só entre opções válidas.
2. **Card.** Todo trabalho vive num card. Não existe tarefa fora de card.
3. **Passagem.** Cada passagem é um contrato: só avança se a entrega fecha o modelo e foi aprovada.
4. **Falha.** Nenhuma falha é silenciosa. Toda falha tem causa classificada e um próximo passo.
5. **Mudança.** Mudança passa pelo simulador e pelo banco de casos reais antes de ir para produção, e entra primeiro num agente só (canário).
