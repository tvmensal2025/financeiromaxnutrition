# Continuidade completa do Sistema Helena — 13/10/2026

Este é o registro pedido pelo fundador para o próximo agente. **A v2 ainda não está concluída em produção.** Esta fotografia substitui o roteiro antigo deste arquivo, que dizia que motor e tela não existiam. O histórico anterior permanece no Git. Leia também `AGENTS.md`, `docs/manual/comando-mestre.txt`, `docs/plano/PLANO-HELENA-V3.md` e o bloco mais recente do `HANDOFF-CLAUDE-CODE.md`.

**Estado prioritário do checkout local `44c2b33` (13/10):** as migrations `0001`–`0015` e os fluxos de pedido, leitura de volta, decisões do fundador, coordenação durável e cancelamento têm implementação e testes locais. A suíte da interface passou com **283 testes em 48 arquivos** e a do motor com **220 testes**; TypeScript e build passaram. A rodada completa de SQL registrou **412 testes passados e um erro de cabeçalho**, corrigido depois; o conjunto combinado final passou em **126 testes (48,86 s)**, incluindo metadata 01 e os testes 13–20. Os escopos dessas duas rodadas SQL são diferentes. Nada disso constitui homologação de produção: não houve deploy da v2, Hermes real, navegador autenticado ou escrita remota.

Não há promessa de funcionamento 100%: cada item abaixo exige evidência. Dados de teste ficam apenas nos testes locais autorizados. Não criar registros fictícios no produto. A autorização do fundador para ajustes nesta sessão permanece válida; não transformar instruções históricas de confirmação em novos pedidos repetidos. Ações comerciais, mensagens a terceiros e gastos não são consequência automática da autorização técnica.

## 1. Estado confirmado e próxima ação

- Repositório: `tvmensal2025/financeiromaxnutrition`; integração em `/workspace/helena-v2`, branch `codex/helena-v2-integracao`; destino remoto `v2-primeiro-card`, [PR 16 em rascunho](https://github.com/tvmensal2025/financeiromaxnutrition/pull/16), base `organizacao-2026-10-10`. Não houve merge nem implantação.
- O projeto privado **ecosistemadossonhos / wxkgrykduqtsgmjkzlou** respondeu à API oficial de gerenciamento do Supabase. Identidade e estado `ACTIVE_HEALTHY` confirmados. O conector nativo não está disponível nesta sessão; a credencial gerenciada permitiu consultas autenticadas. **A falta de conexão ao Supabase deixou de ser bloqueio.**
- Toda a auditoria remota foi feita com `BEGIN READ ONLY` e `read_only=true`. Nenhuma migration, atualização de registro, job, rotação ou publicação foi executada.
- A consulta a `pg_namespace` confirmou **ausência do schema `helena_v2` em produção**. As migrations, telas e o motor descritos adiante existem localmente.
- Foco canônico: **FOC-004, homologação técnica, EM EXECUÇÃO**. WIP executivo = 1 respeitado; FOC-002 Caixa continua PLANEJADO. Saída: bateria reproduzível, tratamento das falhas críticas e parecer com escopo/evidências.
- Próxima ação: reconciliar a continuidade e preparar a implantação isolada da v2 com backup/retorno e revisão de segurança, sem confundir esta preparação com despacho das missões comerciais pendentes. O adaptador de dados reais agora existe localmente; a prova Hermes e a implantação permanecem pendentes.

## 2. Checkpoint e comparação com o banco atual

**CHECKPOINT CARREGADO: CP-20261007-V036 / V36**

**STATUS: CARREGADO COM DIVERGÊNCIAS — CHECKPOINT REQUER SINCRONIZAÇÃO.**

A view `public.checkpoint_mestre_atual` foi a entrada da consulta, sem fixar versão. Os 15 campos exigidos pelo comando mestre foram lidos, incluindo o snapshot integral. A cadeia contém 36 versões contínuas, uma ATIVA (V36, maior versão) e 35 SUPERADO; predecessores das linhas preservados e campos obrigatórios preenchidos. A linha V36 aponta corretamente para `CP-20261004-V035`.

| Item | Snapshot V36 | Consulta de 13/10 |
| --- | --- | --- |
| Negócios / agentes | 4 / 21 | 4 ativos / 21 ativos |
| Tarefas | 109 | 148; 46 não finais |
| Handoffs | 151 (agrupamento antigo soma 94) | 241; 58 ABERTO / 183 CONCLUÍDO |
| Jobs | contagem 87; agrupamento soma 97 | 125: 57 COMPLETED, 49 CANCELLED, 16 FAILED, 2 WAITING_APPROVAL, 1 DRAFT |
| Eventos de jobs | 936 | 1.678; último em 09/10 às 00:12, horário de Brasília |
| Memórias / Estado Mestre | 175 / 19 | 218 / 20 |
| Decisões | contagem 21; array tem 20 | 24 |
| Integrações / automações / recorrências | 11 / 6 / 6 | 11 / 6 / 6 |
| Contas financeiras | vazio | 0; não inventar conta, saldo ou instituição |

Divergências que o próximo agente deve reconciliar:

1. O predecessor **dentro do snapshot** ainda é V34; `prepared_at` e caminhos dos documentos de retomada apontam 01/10, e `resume_command` cita V033, apesar da linha V36 de 07/10. Não seguir esses caminhos/versionamentos como instrução atual.
2. `snapshot.decisions` omite os IDs DEC-022–025. A regra da DEC-022 e BIZ-004 já aparecem em outros blocos do snapshot; não recriar empresa nem alegar que surgiram depois.
3. `snapshot.current_job` e eventos antigos não representam a fila atual. A tarefa correspondente `TSK-HR-8f9a1640f1616a99c4cd54a3457f5d0c` está CANCELADA na consulta atual; não se inferiu o estado do job a partir dela. Os três jobs pendentes atuais estão abaixo.
4. Falta `snapshot.controle_concorrencia`. PAG-V9-020 foi localizado em `public.protocolo_agentes`, versão 9.3, ATIVA, row_version 2258. MEM-CONCORRENCIA-20260926 está presente. O snapshot também não reúne explicitamente todas as memórias relevantes e comandos/checklist de continuidade; reconciliar a estrutura exigida pelo comando mestre. `fontes` e `mudancas_desde_anterior` existem no nível superior (12 e 11 entradas); sua ausência como chaves internas não é falta desses campos obrigatórios.
5. DEC-016–022 estão vigentes; MEM-0025–0028 e os quatro registros de Continuidade estão presentes. DEC-019/MEM-0028 mantêm rotação adiada e risco aberto. DEC-027 existe na documentação local, mas não foi encontrada por DEC-027/DEC-0027 na tabela consultada; não apresentá-la como decisão já sincronizada no banco.
6. Estado Mestre ainda contém retratos antigos de jobs/modelos e grafia antiga de eLiving™. Reconciliar com as decisões atuais; não copiar silenciosamente o texto antigo.

Para sincronizar: reler a view atual, preparar retrato consistente e sem segredos, registrar primeiro as mudanças materiais nas fontes autorizadas, usar `helena_write_record` para UPDATE/DELETE das linhas protegidas com a `row_version` lida, INSERT para novos registros sem upsert que sobrescreva, e `helena_publish_checkpoint` com predecessor esperado. Em conflito, preservar intenção, reler e comparar; não renovar a versão e repetir automaticamente. Revalidar toda a cadeia após publicação. **Esta auditoria não publicou V37.**

### Fila atual que não pode ser reiniciada às cegas

| Job | Estado / tentativa | Continuidade necessária |
| --- | --- | --- |
| JOB-HR-d8bd767d75b0b04ad87a88e4683aabcc | WAITING_APPROVAL, 2/2 | Marina, comparação B1; limite de replanejamentos atingido. Conferir eventos e decisão de destino antes de sucessor/reset. |
| JOB-HR-218deee672505e0ca03bd68a847f67bc | WAITING_APPROVAL, 2/2 | Marina, consolidação da estratégia; timeout e ausência de nova entrega. Preservar linhagem/evidência. |
| JOB-HR-54d05d6e9fe145997abf038235d326d2 | DRAFT, 0/2, aprovação PENDING | Plano de sete dias/primeiras dez pessoas; revisar escopo, custo e aprovação na fonte antes de liberar. |

`approval_status=APPROVED` nos dois primeiros não elimina o estado WAITING_APPROVAL nem concede novas tentativas. Não há job QUEUED/CLAIMED/RUNNING no agrupamento auditado.

## 3. O que já existe localmente

| Parte | Implementação / limite |
| --- | --- |
| Skills | 11 módulos auditados de Superpowers, Taste, Supabase, Vercel e Trail of Bits; origens, recusas, conflitos e hashes em `docs/SKILLS-INSTALADAS.md` e `skills-lock.json`. TypeSafe preservada e restrita ao seu assunto. Skills nativas solicitadas não disponíveis: revisões equivalentes foram identificadas pelos nomes reais. |
| Ambiente | Python 3.13.5, Node 20.20.2, PostgreSQL 16.15 em `127.0.0.1:54329`, sete venvs. Restauração nesta sessão comprovada: `npm ci`, sete `pip check`, PG aceita conexão, Vite `/` HTTP 200 na porta 8080. HTTP 200 prova entrega do HTML, não os fluxos autenticados. |
| Hook | `/workspace/helena-env/session-start.sh`, fora do repo, conteúdo mostrado anteriormente; não é hook nativo. Setup do ambiente salvo e restaurado nesta sessão; não presumir disponibilidade em qualquer máquina futura. |
| Autenticação | `src/auth.tsx`: proteção contra sessão tardia, permissões do usuário ativo e logout com erro explícito; rotas protegidas em `src/App.tsx`. Falta prova com usuários reais no navegador/staging. |
| Banco v2 | `supabase/migrations-v2/0001`–`0015`: máquina gerada, função única, histórico, permissões, prazo finito, fundador por identidade, pedido diário de publicação, resposta durável, revisões imutáveis, leitura de volta comprovada e guarda dos cards ligados. Só aplicado nos bancos locais de teste. |
| Validador | Correções dos ataques de convite, treinamento, cálculo, relatório, parecer e dossiê, com regressões. Cobertura de código não prova que toda paráfrase semanticamente inválida será recusada. |
| Motor | `motor/orquestrador/`: DBOS 3.2.0, resposta/leituras persistidas no SQL, coordenação durável e cancelamento exercitados localmente, regras por `aplicar_evento`, revisão fixada no card e CLI de configuração. O adaptador Hermes existe; EVE/OpenClaw seriam adaptadores futuros ainda não implementados nem verificados. Produção exige fontes verificadas, pedido autenticado, preflight banco/TLS e prova com Hermes real, inclusive cancelamento em até 15 s. |
| Card | `src/pages/CardV2Page.tsx`: consulta de cards/etapas/entregas aprovadas, pedido real importado da preparação privada, leitura de volta comprovada antes de confirmar, decisões autenticadas do fundador e pedido de publicação. A publicação registra solicitação; não faz deploy. A recuperação de decisão incerta após apagar a sessão não é universal. |
| Personalização | `src/pages/ConfiguracoesV2Page.tsx`, `src/integrations/config-v2`, `motor/orquestrador/orquestrador/configuracao.py`: 31 documentos operacionais reais; clonar/editar/retirar em rascunho, CAS, fila de validação técnica, ativação pelo fundador e revisão antiga preservada nos cards existentes. Sem exemplos dos testes no bundle. |
| Prova Hermes | `motor/executor/verificacao_real/` existe; 19 casos coletáveis. `docs/manual/dia-de-prova.md` é roteiro preparado. Não foi executada a prova com Hermes real/ChatGPT. |

O playbook canônico tem **cinco etapas e quatro identidades** (Helena, Caio, Isabela, Clara). Ravi tem teste local separado e SRV-DOSSIE ainda RASCUNHO. Não chamar isso de um único card real de cinco agentes.

### Evidência de testes, sem misturar datas/escopos

Registro histórico da integração anterior `aa644a6`: especificação 296; ferramentas 588; validador 2.352 passados + 31 pulados de outros cards; executor 493; simulador 727; app 214; banco completo 314 e, após última guarda, 78 focados; helper 16. DBOS: 44 no worktree de implementação, 5 cenários principais na integração e 9 focados na separação da CLI. TypeScript/build passaram naquela etapa. Isso é evidência local histórica, não execução contra produção.

Em rodada anterior desta continuação, o editor foi alinhado ao padrão de nomes aceito pelo backend, com teste de regressão. A tela passou em 12 testes, incluindo maiúsculas e borda de 250/251 caracteres antes de `.yaml`; a integração daquele momento passou em **216 testes em 38 arquivos**, TypeScript e build. A prova mais recente deste checkout está no estado prioritário acima. O build mantém avisos de Browserslist antigo e chunks acima de 500 kB; avaliar atualização/divisão sem esconder avisos. O CI do commit final ainda precisa ser observado: commits `[skip ci]` não produzem essa prova.

## Atualização: motor com dados reais e revisão final de 13/10

- Adaptador Management somente leitura e contexto real implementados. Consulta real da tarefa TSK-HR-54d05d6e9fe145997abf038235d326d2: BIZ-003, checkpoint CP-20261007-V036, três fontes documentais e duas decisões. Captura privada fora do Git; zero agentes e zero escritas remotas.
- E05 passou a ter implementação local: pedido autenticado, pin de configuração, consumo idempotente e isolamento das fontes por etapa. Permanece pendente a prova integrada em produção. Prazo da tarefa é nulo; prazo, critérios, restrições e fontes adicionais precisam de confirmação explícita. US$0,50/h não foi confirmado.
- E06 possui coleta/persistência de evidências reais de autor e revisor, limpeza após gravação, coordenação durável e cancelamento testados localmente. Cancelamento com Hermes real em até 15 segundos e retomada operacional após deploy continuam sem prova.
- Migration 0007 adiciona pedidos reais e bloqueia promoção com fontes alteradas, inclusive fora do Motor. As migrations locais vão de 0001 a 0015; aplicar em ordem somente após preflight, backup e revisão de grants/RLS. Não reaplicar 0004 isoladamente. Conferir privilégios do dono SECURITY DEFINER para ler/travar fontes públicas e papéis/CA do worker antes da instalação.
- Bootstrap de configuração em produção ainda não tem procedimento inicial implementado e revisado: `validar-configuracoes` e `registrar-base-tecnica` aceitam somente bancos locais, enquanto o Motor real exige revisão ativa `VALIDADA`. Preparar e revisar esse procedimento no projeto canônico antes de iniciar o worker; a CLI atual não automatiza essa etapa.
- UI compartilhada cobre rotas autenticadas e OAuth. Inspeção visual com usuários reais, temas, modais, páginas e dispositivos continua pendente. Abas locais da Sala de Comando podem manter a área visual da rota inicial. Exemplos do manual de design não são dados do produto nem páginas implantadas.
- Uma rodada anterior reproduziu teste de idempotência que contava todos os cards do banco compartilhado (13 em vez de 1); a correção filtra a tarefa específica. Não usar esse erro antigo como resultado da rodada atual. No checkout `44c2b33`, app 283/48 e motor 220 passaram, assim como TypeScript/build. A rodada SQL completa teve 412 passados e um erro de cabeçalho corrigido depois; o conjunto final combinado passou em 126 testes (48,86 s), com escopo menor. Warnings existentes de Browserslist e chunks acima de 500 kB continuam visíveis.
- Dados comerciais ainda ausentes para E1: horas elegíveis/aprovadas e período, taxa efetiva aprovada, remuneração/divisão, pagador/destinatário e moeda/câmbio quando aplicável. D3 contém referências ilustrativas, não taxa efetiva confirmada de BIZ-003.
- E4 ainda exige tabela oficial FON-LEIS publicada com versão/data/textos, termos/privacidade integrais e peças E2/E3 aprovadas com IDs/versões. Uma allowlist HTTPS não fornece automaticamente esse pacote. D1/D3/B2 são entregas documentais intermediárias aprovadas, não autorização financeira ou parecer jurídico final. O guard atual bloqueia SRV-CALCULO e SRV-PARECER de forma explícita: ainda falta implementar o contrato tipado de insumos no adaptador real, além de obter os dados/fontes. Próximo agente: definir variáveis com fonte/versão, canal autenticado de publicação, pacote de leis/peças conforme os schemas existentes e regressões com documentação verdadeira; substituir o bloqueio somente quando esse contrato passar. Nunca usar leis de memória ou fixtures.
- A arquitetura usa um adaptador Hermes; EVE/OpenClaw são possibilidades futuras sem implementação nem verificação. Extensão e comandos estão no README do orquestrador. Não afirmar compatibilidade automática.
- O limite de **16 ancestrais de cards ligados** falha fechado. A execução externa **X10 não está implementada**; autorização de ação externa no card não executa o efeito. Recuperação de toque incerto após limpar a sessão do navegador não é universal.
- Limite de durabilidade: queda após retorno do provedor e antes de persistir sua resposta ainda pode repetir chamada externa; o contrato atual do executor não prova idempotência do provedor. O aceite de zero duplicação externa continua pendente.
- Não houve deploy, migration remota, login Hermes provado ou homologação de Auth/RLS no navegador. Os 24 itens e 11 aceites abaixo continuam sendo o checklist obrigatório; implementação local não os encerra automaticamente.

## 4. Pendências de engenharia: responsável, bloqueio e aceite

As especialidades abaixo são sugestões de divisão entre agentes. Elas não mudam agentes de negócio nem o WIP executivo. Cada implementação deve ter revisão independente antes do commit e revisão de segurança quando mudar banco/permissões.

| ID / responsável sugerido | O que fazer e onde | Bloqueio / critério para concluir |
| --- | --- | --- |
| E01 — continuidade | Reconciliar checkpoint, Estado Mestre e tarefas antigas; comando mestre e tabelas canônicas. | Snapshot inconsistente; concluir apenas após fontes reconciliadas, CAS e validação da nova versão, sem duplicar entidades. |
| E02 — segurança | Conferir RSK-0007, TSK-0012/13, PR13, gitleaks e secret store; seguir decisão atual de rotação. | Rotação adiada; não revogar credenciais de v1 por suposição. Provar revogação/ausência de segredo quando autorizada, sem divulgar valores. |
| E03 — banco | Separar o projeto canônico wxk do histórico `imvfmjgmacrulhztrqlh`; reconciliar TSK-0014, TSK-0028 e RSK-0008/9. | Riscos históricos tratam outro projeto. Não usar `supabase db push` indiscriminado; inventário aplicado/local, plano de migration e rollback revisados. |
| E04 — banco/deploy | Preparar instalação 0001–0015 da v2 em staging, grants/RLS/API/schema exposto, registro da base técnica e revisão ativa. | Schema ausente em produção e integração com Hermes real não provada. A CLI de bootstrap aceita apenas bancos locais; falta procedimento inicial revisado no projeto canônico para obter revisão ativa VALIDADA antes do worker. Aceite: sequência reproduzível, backup/restore, papéis mínimos, pin obrigatório e app operando no mesmo projeto. Reaplicar 0004 revoga grants das RPCs 0006: corrigir por migration própria, não rerodar CREATE TABLE de 0006. |
| E05 — motor | Substituir fonte/contexto `_caso` e criação de card fixa por adaptador de entrada real; `motor/orquestrador`. | Caminho real implementado localmente; falta homologação em produção. Aceite: dados reais por empresa, identidade autenticada e fontes/evidências; zero leitura de fixtures no caminho de produção. Não basta injetar ExecutorHermes. |
| E06 — executor | Ligar cancelamento/timeout/limpeza do Executor ao Motor; persistir conversa e páginas efetivamente lidas antes de limpar. | Persistência, limpeza, cancelamento e coordenação durável têm testes locais; prova com Hermes real e deploy segue pendente. Aceite: cancelamento ≤15 s, processo encerrado, resposta tardia recusada, sem resíduos/segredos e classificação de consumo. |
| E07 — motor/DBOS | Implementar fila, prioridade, slots, exclusão de segundo motor, versões de deploy, drenagem e rollback. | Prova atual é retomada local após SQL/antes do checkpoint DBOS. Aceite: teste 4 inteiro abaixo; duas instâncias não duplicam execução nem perdem tarefa. |
| E08 — agendamento | Relógio/prazos, vigia a cada cinco minutos, alarmes, tratamento de fila parada e ações externas por dispatcher. | SQL de estados não é agendador em funcionamento. Aceite: falhas injetadas, atraso detectado, retomada idempotente e canal independente. Primeiros agentes não ganham ações externas por esta instalação. |
| E09 — Hermes | Auditar versão real instalada, perfis, login oficial, modelo/instruções/ferramentas e limites; `motor/executor/verificacao_real/`. | Sem controle do navegador ou credencial Hermes/Gateway disponível nesta sessão. Painéis abertos pelo usuário não equivalem a ferramenta de acesso. Concluir testes 1–3 com logs sem segredos; isolar venv Hermes 0.19.0/DBOS e reconciliar versão real antes de atualizar. |
| E10 — catálogo | Completar as 13 fichas em `helena-v2/PENDENCIAS.yaml` e os playbooks necessários, a partir dos contratos reais aprovados. | Há 21 perfis/vínculos no legado; não confundir ficha local ausente com perfil inexistente no VPS. Aceite: catálogo, validação, rubricas e casos rastreáveis, sem inventar missões nem ativar serviços RASCUNHO. |
| E11 — revisores | Provar portão 2 com revisores reais e rubricas por modelo; pareamento de autor/revisor. | Respostas de aprovação atuais são roteirizadas nos testes. Aceite: teste 9; revisor sempre-aprova/sempre-recusa deve falhar. |
| E12 — frontend/Auth | Provar login/logout/refresh, membro/fundador/revogado, escopo por empresa, acesso direto à URL e flag desativada; `src/auth.tsx`, `src/App.tsx`. | Sem sessão de navegador automatizável/usuários de staging. Aceite: evidência de rede/RLS, zero dado entre empresas e falha de permissão tratada; conferir GPS público conforme TSK-0021. |
| E13 — configurações | Exercitar CRUD real das revisões/RPCs, concorrência, worker periódico, validação, ativação, aposentadoria e cards antigos. | Worker atual é comando local explícito; pedidos ficam pendentes sem executor. Bootstrap inicial em produção não é automatizado pelas CLIs locais. Aceite: procedimento inicial revisado e ida e volta UI→SQL→worker→UI, duas edições não sobrescrevem, versão antiga retida após restart. |
| E14 — extensibilidade | Adicionar/retirar agentes, serviços, entregas e playbooks mantendo dependências; `como-mudar.md`. | Identidades globais, schemas, permissões e máquina de estados exigem migration técnica. Aceite: teste de extensão e remoção sem referência quebrada, trilha de auditoria e rollback; não prometer edição irrestrita desses contratos pelo painel. |
| E15 — publicação | Implementar trabalhador de publicação e estado de execução do pedido. | RPC só registra pedido diário do fundador. Aceite: exatamente um pedido/dia Brasília, destino/versão verificáveis, erro e rollback visíveis; pedido aceito nunca mostrado como deploy concluído. |
| E16 — infraestrutura | Conferir VPS/EasyPanel, portas 9119/8642, acesso ao painel, TLS, 2FA, capacidade, volumes e estado dos containers. | Sem acesso administrativo atual. Estado de porta/backup no checkpoint é histórico. Aceite: exposição intencional comprovada, testes 6/11, sem remover volume nem alterar v1 às cegas. |
| E17 — backup | Backup do banco, configurações, evidências e volume Hermes; restauração descartável com tempo medido. | AUTO-0005 PLANEJADA; cron de volume relatado não prova backup completo. Aceite: teste 8, integridade e ponto de retorno demonstrados antes do deploy. |
| E18 — observabilidade | Logs sem segredos, métricas de custo/tempo/erros, alarmes fora do VPS e manutenção documentada. | Painel saudável não prova detecção de falha. Aceite: teste 7, rota independente inclusive quando notificador falha, responsável e procedimento de resposta. |
| E19 — CI/dependências | Observar GitHub Actions no commit integrado; revalidar TSK-0018/19/22/24/29 (Deno, npm runtime, Vitest, backends/lockfile, AI-worker). | Relatos antigos não provam falha atual nem correção atual. Aceite: reproduzir cada uma no checkout correto, corrigir ou justificar encerramento com saída; CI verde sem ocultar skips/warnings. |
| E20 — transição v1→v2 | Preparar corte por canal e rollback preservando trabalhos em andamento; voz e Gateway v1. | Fase 3 ainda não provada. Aceite: v1 termina o que assumiu, nenhuma mensagem duplicada, reversão ensaiada; não juntar mudanças de voz/main inadvertidamente. |
| E21 — rastreabilidade | Mapear auditorias antigas, furos do plano e aceites para regressões atuais. | 171 furos históricos: 104 da rodada 4 + 37 da 3 + 10 da 2 + 20 da 1; lista integral dos 37 da rodada 3 não está no repo (origem indicada: computador do fundador). Registrar fonte faltante e obter antes de alegar cobertura integral. “Nenhum aberto” em desenho não é prova de implementação. |
| E22 — operação real | Homologar um ciclo autorizado tarefa→job→entrega→revisão→painel e depois os escopos contratados. | TSK-0031 registra HTTP 429; 20 conexões ainda NOT_CONNECTED. Aceite: quota/custo conhecidos, fontes reais, revisão persistida e nova tentativa somente conforme limite/decisão. |
| E23 — integrações | Conferir INT-0001…0011, cron Gateway, REC-0004/5/6, Gmail/Drive/Calendar/Evolution/Meowcaller/Laya/Kokoro/ElevenLabs conforme escopo. | Todas as `ultima_sync` estão vazias; estados de cadastro não provam execução. Aceite: evento real rastreado por integração necessária, falha/retry/deduplicação e separação do que continua planejado/pausado. |
| E24 — negócio/finanças | Tratar itens canônicos no apêndice, contas financeiras e contratos de fontes Humano Digital/eLiving™. | Contas = 0; faltam dados reais e decisões de destino/prioridade. Não inventar dados nem enviar campanha/mensagem para concluir uma configuração técnica. Aceite de cada tarefa vem da própria linha canônica. |

## 5. Segurança observada: escopo e limites

No **projeto wxk**: 79 tabelas `public` com RLS habilitado, 109 policies (102 para authenticated, 7 service_role); 4 usuários confirmados, 3 acessos founder ativos e 1 member ativo; uma associação member a BIZ-002. Esses são metadados, não teste de isolamento com usuários reais.

As 46 funções públicas consultadas incluem 13 SECURITY DEFINER, nenhuma dessas 13 com EXECUTE efetivo para anon/authenticated. Seis funções invoker estão executáveis por anon, com nomes de funções de trigger; é necessário conferir assinatura/exposição antes de inferir vulnerabilidade. Não foram chamadas nesta auditoria.

A consulta de privilégios efetivos cobriu 83 tabelas/views. Anon possui SELECT/INSERT/UPDATE/DELETE efetivos em `agent_business_scopes` e nas três views `agent_job_triage_v`, `automation_readiness_v`, `recurrence_readiness_v`. A tabela tem RLS e policies somente authenticated; as três views têm `security_invoker=true`. Os grants isolados **não comprovam vazamento**; falta teste com o papel anônimo e permissões dos objetos subjacentes, sem executar mutações em produção. Authenticated tem SELECT em 76 objetos, INSERT/UPDATE em 71 e DELETE em 70; validar policies com identidades e escopos reais antes de concluir homologação. Owner/superuser é fronteira administrativa confiável e pode contornar proteção comum; nunca usar esse papel no app/motor.

RSK-0007 continua CRÍTICO; RSK-0008/9 continuam abertos e referenciam historicamente outro projeto. Não declarar esses riscos resolvidos pelos testes locais da v2. A DEC-019 canônica tem precedência sobre a formulação local “no fim dos testes”; o adiamento temporário não é aceite indefinido de chaves comprometidas. Não ler/copiar/executar `scripts/`, não pôr token no Git/log/chat e não fazer rotação silenciosa. Não ativar crons pausados para “testar”.

## 6. Testes de aceitação que ainda decidem a conclusão

Todos vêm do plano; nenhum pode ser substituído por “servidor respondeu 200” ou por testes unitários. Registrar por critério PASSOU / FALHOU / NÃO COMPROVADO, data/commit/ambiente e evidência sanitizada.

| Teste | Critério que falta demonstrar integralmente |
| --- | --- |
| 1 — cota | 20 tarefas reais em um dia com v1 ligada; mesmo pedido pelos dois canais; uso v1/v2 medido separadamente, até metade da cota, zero quebra de quota e nenhuma duplicação. |
| 2 — login | 48 horas, ao menos três tarefas paralelas e duas renovações observadas; nenhum login derrubado ou token em pasta de tarefa. |
| 3 — contrato Hermes | Captura por servidor falso de todos os serviços/perfis; laço de 200, ferramentas exatas, instruções/modelo/perfil intactos, segredo ausente e limite de orçamento. Rodar o Hermes real com destino falso controlado não equivale a provar serviço comercial real. |
| 4 — durabilidade | 20 quedas e cinco deploys no meio do passo, troca de versão/cancelamento/resposta simultâneos; segundo motor espera, prioridade alta primeiro com uma vaga, zero perda/duplicação/resíduo, fila antiga vazia e mesmas vagas. Versão anterior funciona sobre banco já migrado; cancelar ≤15 s, versão quebrada revertida automaticamente ≤10 min e aviso no celular. |
| 5 — validador | 60 defeitos (citação falsa/cortada/outra cláusula, conta errada/sem origem, lei inventada, artigo sem trecho, site parecido e código plantado), todos recusados; aceitar citações honestas. Depois 20 execuções reais, no máximo uma correção de formato e nenhuma aprovação inválida. |
| 6 — capacidade | Três tarefas + Gateway/WhatsApp/app, com deploy/kill/timeout; CPU <70%, RAM livre ≥2 GB, sem resíduos ou interrupção dos canais. |
| 7 — alarmes | Falhas de VPS, motor, relógio, Supabase e banco somente leitura, além do próprio canal; aviso ≤15 min por rota independente e repetição controlada. |
| 8 — restauração | Cópia semanal completa, linhas/13 regras/vigia/relógio restaurados em ambiente descartável, tempo medido antes de avançar. |
| 9 — revisão | 30 defeitos em sete tipos e dez entregas limpas; ≥27 encontrados, ≤2 falsos positivos, placar por tipo. Revisores sempre-aprova e sempre-recusa reprovam; escape vira regra/critério novo; repetir quando modelo/rubrica mudar. |
| 10 — banco | 72 horas de carga real e limpeza; crescimento estabiliza, projeção <350 MB por ao menos 60 dias. |
| 11 — segurança | Portas externas, funções anon/estranho, páginas plantadas, WhatsApp forjado/duplicado e sessão/publicação; só acessos pretendidos, recusa de intrusão/prompt injection, um card e publicação só fundador. |

Em cada mudança: conferir fichas, tabela completa de transições, simulador com IA falsa, sequências aleatórias de botões/orçamentos e recusa do motor a banco ausente/errado/admin. Fase 0 de segurança antes de produção; fase 2 de prova antes do motor em produção; v1 permanece até fase 3 comprovada; agente Codex da fase 4 precisa passar nos testes 3 e 5 com login próprio e as mesmas ferramentas. Revisão independente sem achados impeditivos é portão, não promessa baseada em prazo.

## 7. Retomada reproduzível e divisão entre agentes

1. Conferir branch, `git status` e alterações pré-existentes. A pasta original `/workspace/financeiromaxnutrition` tem trabalho anterior; não resetar nem incorporar por cópia cega. Não apagar worktrees ou dados.
2. Usar skills cloud de runtime/setup. Conferir proxy/CA e status da credencial; não imprimir valores. O sandbox padrão bloqueou rede/Docker/listen nesta sessão; execução autorizada com escalada funcionou. Isto não foi recusa de aprovação.
3. Preparar dependências conforme cada `requirements.txt` e `npm ci`; hook auxiliar fica em `/workspace/helena-env`. Para executor, TMPDIR precisa ficar fora de checkout Git (foi usado `/var/tmp/helena-runtime`). Venv Hermes separado do DBOS.
4. Reconsultar Supabase canônico pelo checkpoint atual; este arquivo não substitui a consulta. Usar somente leitura no carregamento. Dados sanitizados da auditoria desta sessão ficam em `/workspace/helena-env/auditoria-20261013/`, fora do Git; se não existirem na próxima máquina, repetir consultas, sem pedir tokens no chat.
5. Dividir trabalho independente: banco/segurança; motor/executor; frontend/Auth; testes de falha/infra; revisão independente. Cada agente escreve em seu worktree, informa commit, arquivos, comandos, resultados e pendências. Integrar sequencialmente e revalidar o conjunto.
6. Antes do push: revisão de código; se houver SQL/permissões, revisão de segurança. Preservar draft e histórico; não declarar GitHub Actions verde por teste local nem tirar PR de rascunho automaticamente.
7. Ao concluir cada E01–E24, anexar evidência ao item e atualizar o resumo curto. Se não puder executar, registrar motivo técnico/dado faltante, responsável sugerido, próxima ação exata e aceite. Nunca substituir uma pendência por “feito” só porque existe código.

### Acessos e informações ainda faltantes

- O token da API do Supabase está utilizável; não é token do Hermes, não autentica EasyPanel e não concede sessão no navegador.
- As ferramentas desta sessão não oferecem controle das abas abertas pelo fundador. Login Hermes/ChatGPT, administração do VPS e prova de UI real continuam sem acesso operacional comprovado.
- Faltam dados reais de contas, limites de custo/quotas, evidências das integrações e fonte integral de 37 achados históricos; não completar com exemplos.
- A restauração desta sessão prova ambiente local; backup de produção e restauração semanal continuam sem evidência.
- Testes de 48/72 horas e observação de produção demandam execução e tempo medidos; não antecipar resultado.

## 8. Índice completo de pendências canônicas

O apêndice seguinte preserva todos os IDs abertos encontrados, inclusive tarefas antigas que podem estar parcialmente resolvidas no código. Elas só devem ser encerradas depois de revalidar o aceite na fonte. Os 58 handoffs incluem vários encaminhamentos da mesma cadeia; não são 58 decisões independentes do fundador.

### Pendências canônicas — fotografia de leitura em 13/10/2026

Fonte: `estado.json`, extração sanitizada e somente leitura das tabelas operacionais de tarefas e handoffs. Este ledger é índice de consulta: os registros canônicos e as versões atuais no banco prevalecem. Revalidar status, bloqueio, autorização e versão na origem antes de qualquer ação. Nenhuma operação remota ou escrita no banco foi feita para gerar este arquivo.

Contagem da fotografia: **46 tarefas não finais** e **58 handoffs ABERTO**. IDs completos abaixo; títulos e bloqueios foram abreviados sem dados pessoais ou credenciais.

### Tarefas não finais

| ID | Estado | Prioridade | Assunto resumido | Bloqueio ou condição |
| --- | --- | --- | --- | --- |
| TSK-0012 | BLOQUEADA | CRÍTICA | Rotacionar credenciais de produção nos painéis | Rotação adiada; depende de ação do fundador nos painéis. |
| TSK-0013 | EM EXECUÇÃO | CRÍTICA | Remover segredos do git e mover chaves novas para secret store (gitleaks bloqueando) | Conclusão depende da rotação e da decisão sobre o PR de saneamento. |
| TSK-0017 | NÃO INICIADA | CRÍTICA | Habilitar e comprovar RLS em food_aliases e user_test_groups | Depende do projeto oficial e da conciliação das migrations. |
| TSK-0019 | NÃO INICIADA | CRÍTICA | Sanear npm audit de runtime (jspdf e transitivas críticas) | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0023 | NÃO INICIADA | CRÍTICA | Configurar credenciais E2E de staging e rodar smoke Playwright | Faltam usuários e segredos de staging. |
| TSK-0028 | NÃO INICIADA | CRÍTICA | Conciliar o histórico de migrations antes de qualquer db push | Depende do projeto oficial; db push permanece bloqueado. |
| TSK-ELIVING-IG-20261005-001 | ABERTO | ALTA | Preparar dois stories e dois posts da eLiving | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0014 | BLOQUEADA | ALTA | Definir o projeto Supabase oficial do aplicativo | Fundador precisa definir o projeto Supabase oficial. |
| TSK-0031 | BLOQUEADA | ALTA | Implantar revisão da Helena no Hermes com memória no Supabase | Piloto sofreu HTTP 429; preflight e limite de custo pendentes. |
| TSK-0008 | EM EXECUÇÃO | ALTA | Preparar funil de captação de trabalhadores para o Humano Digital | Preparação interna permitida; bot/validação externa não comprovados. |
| TSK-0001 | NÃO INICIADA | ALTA | Diagnosticar o processo comercial atual do iGreen | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0002 | NÃO INICIADA | ALTA | Consolidar o MVP do Ecossistema de Saúde | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0006 | NÃO INICIADA | ALTA | Completar o Cadastro Mestre de Empresas e Parceiros do Humano Digital | Há dependência registrada; revalidar na fonte antes de agir. |
| TSK-0009 | NÃO INICIADA | ALTA | Revisar jurídico, LGPD e comunicação de renda das oportunidades do Humano Digital | Preparação interna permitida; bot/validação externa não comprovados. |
| TSK-0010 | NÃO INICIADA | ALTA | Definir modelo comercial e rastreamento de comissão até o caixa | Preparação interna permitida; bot/validação externa não comprovados. |
| TSK-0015 | NÃO INICIADA | ALTA | Criar .env.example canônico sem valores reais | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0016 | NÃO INICIADA | ALTA | Decidir e resolver o trabalho local não commitado na pasta do fundador (9 arquivos, migration… | Depende de acesso/decisão do fundador sobre trabalho local. |
| TSK-0018 | NÃO INICIADA | ALTA | Corrigir deno check do CI (dr-vital-notifications TS2345) | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0020 | NÃO INICIADA | ALTA | Restringir CORS e revisar verify_jwt das edge functions | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0021 | NÃO INICIADA | ALTA | Aplicar AuthGuard no router e decidir GPS público (/especialista-tracking) | Decisão de produto sobre acesso à rota GPS. |
| TSK-0022 | NÃO INICIADA | ALTA | Zerar as 2 falhas do Vitest frontend e definir política de skips | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0024 | NÃO INICIADA | ALTA | Criar testes de vps-backend e media-api e versionar lockfile do media-api | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0025 | NÃO INICIADA | ALTA | Documentar runbook único de deploy (hospedagem de produção a confirmar) | Falta confirmar hospedagem de produção. |
| TSK-0029 | NÃO INICIADA | ALTA | Corrigir o job de CI "AI worker (testes)", que falha em toda execução (inclusive no main ef1d… | Há dependência registrada; revalidar na fonte antes de agir. |
| TSK-ELIVING-20261004-001 | NÃO INICIADA | ALTA | Estruturar blueprint estratégico, marca e operação da eLiving™ | Transição do foco executivo depende do fundador. |
| TSK-HD-20260927-01 | NÃO INICIADA | ALTA | Revisar entregas e conflitos; emitir parecer aprovado/pendente com evidência e próxima ação. | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-02 | NÃO INICIADA | ALTA | Preparar roteiro curto somente se participação do fundador for necessária; não criar dependên… | Há dependência registrada; revalidar na fonte antes de agir. |
| TSK-HD-20260927-04 | NÃO INICIADA | ALTA | Reaproveitar tarefas existentes, definir dependências, prazo ao assumir e revisor; validar um… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-05 | NÃO INICIADA | ALTA | Definir conciliação separando comissão prevista, aprovada e recebida e custos; não tratar pre… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-07 | NÃO INICIADA | ALTA | Revisar responsabilidades e capacidade, eliminar sobreposição e encaminhar conflitos à especi… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-08 | NÃO INICIADA | ALTA | Definir métricas e fontes de interessados, cadastros, ativações, atividades aprovadas e receb… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-09 | NÃO INICIADA | ALTA | Validar integração existente e acionamento real do bot no Gateway; documentar resultado e blo… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-10 | NÃO INICIADA | ALTA | Especificar fluxo mínimo de entrada, orientação e acompanhamento com critérios de aceite. | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-11 | NÃO INICIADA | ALTA | Levantar dúvidas e obstáculos com fontes disponíveis; distinguir hipótese de evidência, sem c… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-12 | NÃO INICIADA | ALTA | Projetar apresentação, formulário, confirmação e próximos passos para celular com base no flu… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-13 | NÃO INICIADA | ALTA | Testar percurso, duplicação, falha e retomada com dados de teste identificados; anexar evidên… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-14 | NÃO INICIADA | ALTA | Definir procedimento de contato até encerramento, passagem de responsável e tratamento de fal… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-19 | NÃO INICIADA | ALTA | Preparar acompanhamento de ativação e motivos de abandono, condicionado ao canal e autorizaçã… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-20 | NÃO INICIADA | ALTA | Preparar respostas e encaminhamentos para dúvidas; não inventar condições dos parceiros. | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HD-20260927-21 | NÃO INICIADA | ALTA | Organizar fontes e documentos por parceiro; distinguir relato do fundador de comprovante conf… | Aguarda aceite e dependências organizadas pela coordenação. |
| TSK-HR-218deee672505e0ca03bd68a847f67bc | BLOQUEADA | MEDIA | Humano Digital — especialista: consolidar comparação rastreável da estratégia anterior com D2… | Timeout sem entrega confirmada; destino depende do fundador. |
| TSK-HR-74db0df800d0efd3d6bcc006df9b1299 | BLOQUEADA | MEDIA | D1 Humano Digital — especialista: comparação factual Mimix x HubData com fontes públicas | Pesquisa web indisponível na sessão registrada. |
| TSK-HR-d8bd767d75b0b04ad87a88e4683aabcc | BLOQUEADA | MEDIA | Humano Digital — especialista: B1, comparar somente a proposta de valor anterior×D2, com reus… | Dois replanejamentos esgotados; destino depende do fundador. |
| TSK-0026 | NÃO INICIADA | MÉDIA | Reduzir dívida técnica: higiene da raiz/docs AppMax, strict TS/ESLint 9/chunk split e intro s… | Sem bloqueio explícito no registro; revalidar prioridade. |
| TSK-0027 | NÃO INICIADA | MÉDIA | Propor metas e faixas de alerta dos KPI-0005 a KPI-0010 do PRJ-0002 | Aprovação final depende da coordenação. |
| TSK-HR-54d05d6e9fe145997abf038235d326d2 | NÃO INICIADA | MEDIA | Meta do Fundador (7 dias): plano para recrutar as primeiras 10 pessoas na Mimix e no Hub, com… | Sem bloqueio explícito no registro; revalidar prioridade. |

### Handoffs abertos

| ID | Estado | Prioridade | Assunto resumido | Pendência resumida |
| --- | --- | --- | --- | --- |
| HND-0004 | ABERTO | CRÍTICA | Execução técnica do PRJ-0002 — iniciar a TSK-0013 (segredos fora do git) e a TSK-0014 (projet… | Dependências técnicas e decisões registradas; revalidar antes de executar. |
| HND-0001 | ABERTO | ALTA | Adoção do protocolo vivo | Pendência registrada; conferir detalhe canônico antes de agir. |
| HND-0003 | ABERTO | ALTA | DECISÃO NECESSÁRIA — HELENA: prazos propostos, foco/WIP e prioridade do PRJ-0002 (ids-max / M… | Dependências técnicas e decisões registradas; revalidar antes de executar. |
| HND-0012 | ABERTO | ALTA | Entrega da TSK-0029: corrigir o job de CI "AI worker (testes)" (PostCSS/tailwindcss) | Dependências técnicas e decisões registradas; revalidar antes de executar. |
| HND-0014 | ABERTO | ALTA | EXCEÇÃO DE IDENTIDADE NO HELENA GATEWAY: record_dispatch da especialista () gravado como (esp… | Pendência registrada; conferir detalhe canônico antes de agir. |
| HND-ELIVING-20261004-001 | ABERTO | ALTA | Estratégia e posicionamento da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-ELIVING-20261004-002 | ABERTO | ALTA | Arquitetura de produto da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-ELIVING-20261004-003 | ABERTO | ALTA | Arquitetura de tecnologia e IA da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-ELIVING-20261004-004 | ABERTO | ALTA | Saúde, IA, privacidade e compliance da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-ELIVING-20261004-005 | ABERTO | ALTA | Plataforma verbal e comunicação da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-ELIVING-20261004-007 | ABERTO | ALTA | PMO e plano integrado da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-HANDOFF-15b964d9c7ebe91fe1443156808496c1 | ABERTO | ALTA | Decisão necessária: Humano Digital — especialista: converter a ficha Clickworker aprovada de… | Pendência registrada; conferir detalhe canônico antes de agir. |
| HND-HD-20260927-CAMILA-01 | ABERTO | ALTA | TSK-0008: experimento de captação EXP-HD-01 preparado; conferência e dependências | Ato externo depende de autorização do fundador. |
| HND-HD-CAPTACAO-20260927-01 | ABERTO | ALTA | Humano Digital — Helena | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-02 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-03 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-04 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-05 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-06 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-07 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-08 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-09 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-10 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-11 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-12 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-13 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-14 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-15 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-17 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-18 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-19 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-20 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-HD-CAPTACAO-20260927-21 | ABERTO | ALTA | Humano Digital — especialista | Aguarda aceite real e organização de dependências; sem publicação ou gasto. |
| HND-REPLAN-01cac2e53c41a762adf5f0d447f38799 | ABERTO | ALTA | Decisão necessária: Humano Digital — especialista: consolidar comparação rastreável da estrat… | Decisão do fundador sobre destino da cadeia esgotada. |
| HND-REPLAN-e587c99e469f5c481e28062bda4002c2 | ABERTO | ALTA | Decisão necessária: Humano Digital — especialista: B1, comparar somente a proposta de valor a… | Decisão do fundador sobre destino da cadeia esgotada. |
| HND-ELIVING-20261004-006 | ABERTO | MÉDIA | Experiência e sistema visual da eLiving | Preparado; runtime pendente e despacho automático bloqueado. |
| HND-HR-06b6aa901eb304df94dbe04d548c4965 | ABERTO | MEDIA | Humano Digital — especialista: analisar operador e alcance Brasil dos termos públicos Clickwo… | Dependências técnicas e decisões registradas; revalidar antes de executar. |
| HND-HR-218deee672505e0ca03bd68a847f67bc | ABERTO | MEDIA | Humano Digital — especialista: consolidar comparação rastreável da estratégia anterior com D2… | Revisão independente ou correção ainda pendente. |
| HND-HR-25a2d7125866e0dd02a1aac9bced2ddf | ABERTO | MEDIA | D7.1 Humano Digital — especialista: reunir um dossiê oficial público de Clickworker sobre pro… | Corrigir rastreabilidade de trechos/cláusulas antes de aceite. |
| HND-HR-281ad1dc1bb51dca9c00a389141beab1 | ABERTO | MEDIA | Humano Digital — especialista: consolidar comparação rastreável da estratégia anterior com D2… | Correção da entrega no fluxo vigente; revisão independente pendente. |
| HND-HR-4cb721401372b5d572aeac6a6e8ad77a | ABERTO | MEDIA | D7 Humano Digital — especialista: reunir dossiês oficiais públicos de Clickworker, DataForce… | Aguarda liberação da coordenação. |
| HND-HR-54d05d6e9fe145997abf038235d326d2 | ABERTO | MEDIA | Meta do Fundador (7 dias): plano para recrutar as primeiras 10 pessoas na Mimix e no Hub, com… | Aguarda liberação da coordenação. |
| HND-HR-74db0df800d0efd3d6bcc006df9b1299 | ABERTO | MEDIA | D1 Humano Digital — especialista: comparação factual Mimix x HubData com fontes públicas | Aguarda liberação da coordenação. |
| HND-HR-8f9a1640f1616a99c4cd54a3457f5d0c | ABERTO | MEDIA | Humano Digital — especialista: organizar a comparação e o reuso da estratégia anterior com a… | Revisão independente ou correção ainda pendente. |
| HND-HR-d8bd767d75b0b04ad87a88e4683aabcc | ABERTO | MEDIA | Humano Digital — especialista: B1, comparar somente a proposta de valor anterior×D2, com reus… | Revisão independente ou correção ainda pendente. |
| HND-HR-e7af0feab8a956a247fd2d715bb9b5ea | ABERTO | MEDIA | Humano Digital — especialista: analisar A2 Clickworker, distinguindo elegibilidade geral, reg… | Corrigir rastreabilidade de trechos/cláusulas antes de aceite. |
| HND-HR-ec4e27cdf32683771b045c00567fe3ec | ABERTO | MEDIA | Plano operacional inicial de captacao do Humano Digital | Revisão independente ou correção ainda pendente. |
| HND-HR-fda2f360d4bbb43cc6194384121db8bb | ABERTO | MEDIA | Humano Digital — especialista: consolidar comparação anterior×D2, proteção integral e dependê… | Aguarda liberação da coordenação. |
| HND-REVIEW-01f7c4fd3d1a2d422b24f7406a7f4b2b | ABERTO | MEDIA | Revisar: D7.1 Humano Digital — especialista: reunir um dossiê oficial público de Clickworker… | Corrigir rastreabilidade de trechos/cláusulas antes de aceite. |
| HND-REVIEW-04adf62afbebd360d9272986065d2747 | ABERTO | MEDIA | Revisar: Humano Digital — especialista: analisar A2 Clickworker, distinguindo elegibilidade g… | Corrigir rastreabilidade de trechos/cláusulas antes de aceite. |
| HND-REVIEW-0be2f327dc5d047a9320bf36bd68b4b2 | ABERTO | MEDIA | Revisar: Humano Digital — especialista: organizar a comparação e o reuso da estratégia anteri… | Revisão independente ou correção ainda pendente. |
| HND-REVIEW-191a4ba52f245b63b141c35b9e658ff5 | ABERTO | MEDIA | Revisar: Plano operacional inicial de captacao do Humano Digital | Revisão independente ou correção ainda pendente. |
| HND-REVIEW-1a56d203e152fff1d75931917138ef5f | ABERTO | MEDIA | Revisar: Humano Digital — especialista: B1, comparar somente a proposta de valor anterior×D2… | Revisão independente ou correção ainda pendente. |
| HND-REVIEW-1c037d97922505da47d5f0934113ad0e | ABERTO | MEDIA | Revisar: Humano Digital — especialista: analisar operador e alcance Brasil dos termos público… | Dependências técnicas e decisões registradas; revalidar antes de executar. |
| HND-REVIEW-40cec691be3604509bceed58378b2ca7 | ABERTO | MEDIA | Revisar: Humano Digital — especialista: consolidar comparação rastreável da estratégia anteri… | Correção da entrega no fluxo vigente; revisão independente pendente. |
| HND-REVIEW-d455f3a69cf424fe7e5c8ffa6850a352 | ABERTO | MEDIA | Revisar: Humano Digital — especialista: consolidar comparação rastreável da estratégia anteri… | Revisão independente ou correção ainda pendente. |
| HND-REVIEW-fba7a81e3bcaca27c724f20e5b1183f5 | ABERTO | MEDIA | Revisar: Plano operacional inicial de captacao do Humano Digital | Revisão independente ou correção ainda pendente. |
| HND-0026 | ABERTO | BAIXA | Melhorias BAIXA da página Equipe (QA-PR6-03, 06, 07) em PR NOVO a partir da main, após a deci… | Pendência registrada; conferir detalhe canônico antes de agir. |

## Leitura de continuidade

A frente FOC-004 permanece em execução; FOC-002 está planejada. Os marcos MIL-0002 a MIL-0005 e o PRJ-0002 devem ser avaliados com seus critérios de aceite canônicos. Handoffs abertos podem representar revisões repetidas da mesma cadeia; não equivalem a 58 decisões independentes.

A fotografia não confirma implantação da v2 (`esquema_v2=false`), execução dos 20 especialistas sem conexão, publicação ou autorização para atos externos. A fonte canônica e o fundador determinam o próximo passo.
