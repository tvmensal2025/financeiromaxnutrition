# Auditoria mestra do Ecossistema dos Sonhos

Data da auditoria: 2026-09-29  
Fonte operacional: Gateway publicado, Hermes CLI e Supabase `ecosistemadossonhos`.  
Escopo: 21 agentes, Helena como orquestradora, despacho Hermes, rastreabilidade e testes.

## Resultado executivo

O Gateway está publicado e saudável. O Hermes possui o despachante atualizado para escolher o modelo por tarefa: GPT-6 Luna para tarefas simples, GPT-6 Sol para tarefas intermediárias e GPT-6 Astra para tarefas complexas. Helena permanece no Sol.

Os testes locais do Gateway passaram: 195 testes e 0 falhas. Os testes do despachante passaram: 30 testes e 0 falhas. O CLI do Hermes respondeu e consultou a fila real.

O estado operacional encontrado no Supabase foi:

- 38 jobs registrados;
- 23 em `WAITING_HELENA`;
- 8 `COMPLETED`;
- 4 `FAILED`;
- 3 `DRAFT`;
- 0 `READY` para despacho;
- registros ativos vinculados aos 21 agentes.

O sistema está preparado para operar, mas a homologação de ponta a ponta ainda está pendente porque nenhum job atual está liberado para despacho. Os arquivos de auditoria antigos mostram tarefas e vínculos históricos; eles não substituem a fila atual.

### Conferência posterior do contexto da Helena

O `get_work_context` do perfil `helena--grupo` retornou 30 tarefas atuais. A leitura mostrou tarefas `CONCLUÍDA`, `EM EXECUÇÃO`, `NÃO INICIADA` e `BLOQUEADA`, incluindo o piloto de captação do Humano Digital e tarefas de estratégia, parceiros, jurídico, tecnologia, produto, QA e conteúdo. Esse contexto comprova que as tarefas estão no núcleo operacional, mas não autoriza despacho automático: cada job precisa passar pela regra de liberação e pelo evento de despacho correspondente.

Também foi confirmado que o despachante remoto continua em modo seguro: consulta a fila sem `--execute` não inicia modelo e `--auto` retorna `NO_APPROVED_READY_JOB` quando não existe job liberado.

## O que foi implantado

1. Gateway do Hermes publicado no EasyPanel.
2. Supabase conectado ao Gateway.
3. Briefing estruturado com bloqueio para comandos rasos.
4. Liberação de tarefa vinculada à versão correta.
5. Concorrência otimista para evitar sobrescrita entre conversas.
6. Registro de handoff, progresso, revisão e entrega.
7. Despachante Hermes com modo seguro, dry-run e execução explícita.
8. Seleção de modelo por tarefa com vínculo ao job, empresa, agente, versão e hash do briefing.
9. Auditoria Jev em modo controlado no piloto BIZ-003.
10. Fallback para o modelo padrão quando a avaliação estiver ausente, incerta ou desatualizada.
11. Proteções contra execução sem empresa, tarefa, vínculo Hermes ou briefing completo.
12. Testes de segurança, integração, armazenamento de artefatos e fluxo de revisão.

## Critério operacional de conclusão

Uma tarefa só pode ser considerada concluída quando houver evidência dos passos abaixo:

`pedido da Helena → briefing → tarefa no Supabase → Marina despacha → agente assume → execução → handoff → revisão → entrega → Helena consolida`.

O despachante não inicia modelo quando a fila está vazia, quando falta `DISPATCH_REQUESTED` de Marina ou quando a recomendação Jev não corresponde à versão atual do job.

## Auditoria dos 21 agentes

Os nomes e IDs estão definidos. O Gateway possui vínculos e jobs para os 21 agentes. A configuração individual de Skills, tools, MCPs, memória, automações e testes reais de cada agente ainda não foi comprovada integralmente no Hermes.

| Agente | Função | Estado comprovado |
|---|---|---|
| AGT-01 Helena | Chief of Staff / Central de Comando | CONFIGURADO; supervisão operacional pendente de homologação |
| AGT-02 Laura | Comunicação e desenvolvimento do fundador | REGISTRADO; teste individual pendente |
| AGT-03 Augusto | Estratégia corporativa | REGISTRADO; teste individual pendente |
| AGT-04 Marina | Execução e PMO | REGISTRADO; despacho real pendente |
| AGT-05 Caio | Finanças / CFO | REGISTRADO; teste individual pendente |
| AGT-06 Clara | Risco, jurídico e compliance | REGISTRADO; teste individual pendente |
| AGT-07 Bianca | Pessoas e cultura | REGISTRADO; teste individual pendente |
| AGT-08 Daniel | Dados e BI | REGISTRADO; teste individual pendente |
| AGT-09 Theo | Tecnologia e IA | REGISTRADO; teste individual pendente |
| AGT-10 Nina | Produto | REGISTRADO; teste individual pendente |
| AGT-11 Ravi | Pesquisa e insights | REGISTRADO; teste individual pendente |
| AGT-12 Maya | Design / UX / UI | CONFIGURADO para arte; ciclo real pendente |
| AGT-13 Bruno | Qualidade / QA | REGISTRADO; revisão real pendente |
| AGT-14 Olívia | Operações | REGISTRADO; teste individual pendente |
| AGT-15 Victor | Vendas | REGISTRADO; teste individual pendente |
| AGT-16 Camila | Marketing e Growth | REGISTRADO; teste individual pendente |
| AGT-17 Isabela | Marca, conteúdo e copy | REGISTRADO; teste individual pendente |
| AGT-18 Pedro | Parcerias e negócios | REGISTRADO; teste individual pendente |
| AGT-19 Renata | Customer Success | REGISTRADO; teste individual pendente |
| AGT-20 Joana | Atendimento | REGISTRADO; teste individual pendente |
| AGT-21 Felipe | Administração | REGISTRADO; teste individual pendente |

## Pendências reais

1. Liberar um job atual de BIZ-003 para `READY` com despacho explícito de Marina.
2. Executar o primeiro piloto sem publicação, contato externo ou gasto comercial.
3. Confirmar no Supabase os eventos de claim, start, progresso, handoff, revisão e entrega.
4. Exibir a entrega na página Entregas.
5. Repetir o ciclo com um agente simples, um intermediário e um complexo para homologar Luna, Sol e Astra.
6. Revisar os 4 jobs `FAILED`.
7. Confirmar individualmente Skills, tools, MCPs, memória, permissões e automações de cada perfil Hermes.
8. Fazer red team integrado: duplicidade, loop, perfil sem acesso, falha de MCP, falha de modelo, retomada e falsa conclusão.
9. Medir custo e tempo de uma amostra antes de ampliar o piloto Jev para outras empresas.

## Rollback

Os commits publicados no `main` são `bb7561d`, `42c30ce` e `121fdcd`. O despachante remoto possui backup anterior à instalação. O modo padrão permanece dry-run; execução de modelo exige `--execute` e job elegível.

## Documentação oficial consultada

- Hermes: https://hermes-agent.nousresearch.com/docs/
- Perfis: https://hermes-agent.nousresearch.com/docs/user-guide/profiles
- MCP: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- Toolsets: https://hermes-agent.nousresearch.com/docs/reference/toolsets-reference
- Delegação: https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation
- Cron: https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/

## Status final desta auditoria

**Infraestrutura e código: aprovado nos testes executados.**  
**Operação real de ponta a ponta: pendente.**  
**Percentual geral honesto: não homologado como 100% enquanto não houver um job real executado e entregue.**

