# Integração Hermes: evidências de 29/09/2026

## Continuação: briefing publicado às 11:04:13 UTC

- Commit `f3e85eec8823e7fa7c20bd9b88ee535465a0c279` enviado ao main. Inclui trava de briefing na criação e no handoff, rejeição de seções duplicadas, texto repetido e placeholders; inclui correções dos filtros e testes dos perfis.
- EasyPanel estava usando `codex/hermes-runtime-preparation`. Origem alterada e persistida para `main`, mantendo o build path `/services/helena-gateway`.
- Log da implantação do commit de agentes terminou com `Success` em 2026-09-29 11:04:13 UTC. Health posterior respondeu ok, Supabase e MCP true.
- Testes completos após o reforço: 169 aprovados, zero falhas, mais 29 verificações de segurança aprovadas.
- Ainda NÃO comprova o ciclo de produção de stories nem a revisão automática. A copy de Camila continua em DRAFT após pedido de ajustes, e Maya também em DRAFT na última leitura. Nenhum status foi forçado e nenhum modelo foi iniciado nesta continuação.

## Resultado confirmado nesta sessão

- Os 21 perfis autenticaram no Gateway com seus IDs AGT-01 a AGT-21 e estado ACTIVE.
- Descoberta real no Hermes: os 21 perfis passaram na verificação das ferramentas exigidas por função. Isso NÃO equivale à homologação das 21 execuções por modelo.
- Corrigido no servidor: o filtro de Marina não incluía `record_dispatch`. A ferramenta foi adicionada com backup do config.yaml, preservando credenciais, modelo e demais configurações. Nova descoberta confirmou a ferramenta.
- Maya já tinha `create_artifact_upload` e `verify_artifact_upload`; não foram recriadas.
- Laura tem apenas `get_work_context` por seu escopo pessoal. A auditoria anterior retornava zero por exigir pelo menos dez ferramentas; a descoberta específica confirmou uma ferramenta válida.
- Substituída a checagem por quantidade por checagem nominal das ferramentas obrigatórias. Instalado no Hermes em `/data/helena-runtime/hermes_mcp_preflight.py`, com backup.
- Relatório no Hermes: `/data/helena-runtime/integracao-20260929.json`, com data UTC, resultado por perfil, 21 aprovados, zero chamadas de modelos e zero jobs iniciados.
- Configurador local corrigido para preservar o despacho de Marina e os uploads de Maya nas próximas configurações.

## Testes locais

- Gateway: 167 testes aprovados; verificações HTTP concluídas; 29 verificações adicionais de segurança aprovadas; npm test terminou com código zero.
- Interface: 126 testes em 19 arquivos aprovados.
- Compilação de produção da interface: aprovada, com avisos de tamanho de bundle e cadastro Browserslist antigo.
- Configurador: quatro testes aprovados, incluindo preservação de configurações e credenciais.
- Executor + nova checagem de ferramentas: 31 testes aprovados (27 + 4).
- Testes locais não são prova de que o código inteiro do Gateway foi publicado. Não houve novo deploy do Gateway nesta sessão.

## Pendências que impedem chamar a operação de 100% funcional

1. Ciclo real completo com modelo: despacho, aceite, execução, evidência, revisão e entrega na página. Não foi iniciado nesta sessão, atendendo à prioridade de concluir primeiro a integração.
2. O executor usa somente o conjunto de ferramentas `helena_operacao` e proíbe Terminal/web. Upload assinado não gera nem envia os bytes da arte por si só: é necessário fechar a capacidade de produção/envio dos PNGs antes de consumir o piloto visual.
3. Revisão e próximo responsável ainda precisam de acionamento automático demonstrado. Ter `review_delivery` e `handoff_task` disponíveis não prova que um supervisor será iniciado automaticamente.
4. Recuperação de execuções abandonadas precisa de reconciliação com execução remota e idempotência; não reexecutar cegamente um job CLAIMED/RUNNING.
5. Ferramentas empresariais específicas ainda não estão no conjunto dos perfis: criar empresa e lançar despesa pessoal/empresarial são diferentes de gravar tarefa/memória. Não afirmar que houve lançamento financeiro por existir um registro narrativo.
6. Confirmar a versão servida em localhost:8082 e a publicação das alterações da interface.

## Continuidade sem duplicação

- Manter o piloto Maya existente: JOB-HR-49eff2ead7674d06b4b59bc796f08873 / TSK-HR-49eff2ead7674d06b4b59bc796f08873. Reconsultar estado e versão antes de qualquer mutação.
- Marina AGT-04 coordena a fila; Camila AGT-16 cuida de Marketing. Nina AGT-10 revisa Maya.
- WIP global 1, tentativas limitadas, sem publicação externa, sem reativar testes antigos do Pedro.
- Última consulta da fila: COMPLETED 8, DRAFT 3, FAILED 4, WAITING_HELENA 23. Não reclassificar o legado sem evidência.
- Exemplo de R$ 50 no posto é cenário de teste, não despesa real autorizada.
- Não alterados dados de tarefas, aprovações ou lançamentos nesta sessão. Não houve push ou commit. Alterações anteriores do usuário foram preservadas.
