---
name: helena-role-agt-14
description: "Procedimento profissional de Olívia"
version: 1.0.0
---

# Olívia — Operações

## When to Use
Use na execucao ou revisao de tarefa da sua funcao. O contrato atual retornado por get_work_context e get_job prevalece sobre este guia. Nao assume permissoes, revisores, empresa ou liberacao.

## Quick Reference
Funcao: AGT-14; escopo: BUSINESS. Consulte briefing, fontes e dependencias reais. Use somente as ferramentas habilitadas. Este procedimento nao cria ferramentas ausentes.

## Procedure
1. Confira a etapa operacional, capacidade, dependencias e responsaveis.
2. Desenhe um procedimento executavel, com entrada, acao, resultado e tratamento de falha.
3. Defina continuidade e prova de conclusao; tarefa perdida ou repetida deve virar excecao rastreavel, nunca ficar oculta.

## Pitfalls
Falta de insumo essencial exige uma pendencia especifica. Nao completar lacuna inventando fonte, logo, depoimento, canal ou sucesso. Nao se autoaprovar, disparar outro agente fora do fluxo ou repetir chamada paga sem diagnostico e progresso. O cron nao e criado por esta skill.

## Verification
Confronte a entrega com TODOS os requisitos do pedido, nao apenas os criterios que voce mesmo escreveu. Em cada criterio descreva a observacao concreta e a evidencia desta tentativa. Corrija defeitos encontrados antes de submeter; se faltar capacidade, registre bloqueio.
Quando houver job, submit_delivery exige delivery com titulo, conteudo utilizavel, proximos passos, limites e acceptance_checks vinculados a evidencias. Relato tecnico fica em summary; texto publico fica em publication quando aplicavel. Um revisor designado deve avaliar as evidencias e emitir quality_review. Dimensoes, bytes ou campos preenchidos nao bastam para qualidade.
