# Helena: GPT-6.1 Sol com esforco maximo

Pedido do fundador em 01/10/2026: Helena usa GPT-6.1 Sol no maximo; correcoes devem usar o mesmo modelo para cruzar informacoes e delegar corretamente.

## Aplicado

- Perfil `/data/profiles/helena--grupo/config.yaml`: `model.default: gpt-6.1-sol`, `agent.reasoning_effort: max` e override do mesmo modelo em `max`.
- Provedor existente preservado: `openai-codex`, `api_mode: codex_responses`. Nenhuma chave ou permissao alterada.
- Os 21 perfis receberam somente o override de esforco para quando GPT-6.1 Sol for selecionado. Os outros modelos padrao foram preservados.
- Despachante: AGT-01 usa GPT-6.1 Sol; uma correcao com motivo registrado e ultimo parecer formal REQUEST_CHANGES da mesma empresa/job usa GPT-6.1 Sol. Texto livre, parecer de outra empresa e uma reprovacao anterior a uma aprovacao nao acionam essa regra.
- O fluxo de coordenacao/RESOLVE usa o perfil Helena. O pacote agora inclui a decisao necessaria, contexto, impacto, recomendacao e vinculo real do executor.
- Cadastro da Helena no Supabase sincronizado para `gpt-6.1-sol`; historico, estados, limites de tentativas e isolamento por empresa preservados.

## Onde empregar

Helena: compreender pedido, verificar fontes e identidade da empresa, planejar dependencias, resolver impedimentos e redirecionar tarefas. Executor: usar o modelo avancado na correcao formal solicitada pelo revisor. Theo: diagnosticar falha tecnica na tarefa especifica; uma falha tecnica ainda precisa de encaminhamento registrado, nao de retentativa cega. Nina: revisar de forma independente com acesso legitimamente atribuido; trocar o modelo nao concede acesso a um job nao submetido.

Uma tarefa simples e isolada continua elegivel para Luna; a classificacao habitual Jev para novas tarefas foi preservada. Geracao visual usa o gerador de imagens configurado, nao o modelo textual como substituto.

## Evidencia e limites

106 testes Python executados: 105 passaram e um teste de lock POSIX foi pulado no Windows. Instalacao remota compilada e configuracoes relidas. Uma unica chamada somente leitura foi iniciada para consultar o contexto e o bloqueio real da Marina, sem liberar tarefas nem gerar imagens. Registrar seu resultado antes de declarar o modelo validado em execucao.

Configuracao salva nao comprova ciclo completo. A inspeção anterior a submissao, a resolucao de jobs esgotados e a entrega visual revisada ainda exigem conclusao especifica; nao anunciar que todos os 21 agentes estao operacionalmente homologados por esta troca de modelo.

Fontes: https://developers.openai.com/api/docs/models/gpt-6.1-sol e https://hermes-agent.nousresearch.com/docs/user-guide/configuration . GPT-6.1 Sol usa Responses para ferramentas; Hermes documenta agent.reasoning_effort e reasoning_overrides por modelo.
