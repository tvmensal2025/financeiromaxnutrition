# Naturalidade conversacional da Max

## Fluxo e problema encontrado

O gateway recebe a transcrição, carrega contexto e perfil, usa GPT Luna e envia texto ao Google Chirp 3 HD. WhatsApp usa GPT SSE, gRPC Google e PCM incremental para Meowcaller. O aplicativo web usa o mesmo gerador de texto, com síntese de áudio por turno.

A versão anterior também inseria `Hum.` de um cache após um temporizador, ou `Hum, só um instante.` no stream. Essas falas não eram decisões do Luna e podiam soar desconectadas. Ambos os mecanismos foram removidos. Não foram trocados modelo, Voice Names, região, autenticação, banco ou arquivos de áudio legados.

## Configuração e arquivos

Todos os caminhos seguintes são relativos a `services/helena-gateway`.

- **Novo:** `src/integrations/conversation-naturalness.mjs`: regras centrais, estilos por personagem, reconhecimento das aberturas recentes e limpeza de formatação. Vital é cuidadoso; Sirlene, acolhedora e prática; Alex, direto e respeitoso. Personagens futuros herdam o estilo padrão. Identidade, modo e script continuam nos perfis existentes em `call-engine.mjs`/`profile-store.mjs` e na configuração persistida.
- **Alterado:** `src/integrations/voice-agent.mjs`: injeta perfil e naturalidade na geração sem streaming; aplica a mesma camada ao caminho de streaming; preserva indicação de resposta interrompida no histórico recente.
- **Alterado:** `src/integrations/call-streaming.mjs`: injeta regras no prompt efetivamente enviado ao GPT; envia frases ou cláusulas naturais; mantém uma confirmação curta junto da ideia seguinte; não divide reticências; protege contra rubricas fragmentadas; não sintetiza uma resposta composta só de hesitação.
- **Alterado:** `src/integrations/voice-delivery.mjs`: remove regras duplicadas; preserva informação de interrupção para o próximo turno; corrige comentário antigo sobre Scribe.
- **Alterado:** `src/routes/integrations.mjs`: remove acionamento dos preenchimentos automáticos na entrada de áudio.
- **Alterado:** `src/integrations/audio-router.mjs`: corrige comentário antigo de fallback; CALL continua exclusivamente Google.
- **Removidos:** `src/integrations/call-wait-cue.mjs` e seu teste, usados somente pelo preenchimento introduzido nesta tarefa. Histórico Git preserva a implementação anterior.
- **Novos:** `test/conversation-naturalness.test.mjs` e `scripts/evaluate-call-naturalness.mjs`. Testes de streaming atualizados e comando de suíte em `package.json` atualizado.
- **Analisados, preservados:** `caller-context.mjs`, `google-chirp3-hd.mjs`, `call-engine.mjs`, `profile-store.mjs`; motor Go `engine.go`, `live_stt.go` e `pcm_stream.go`. Não foi necessário mudar Meowcaller nesta correção.

## Responsabilidades

Contexto real da Max + perfil salvo + histórico + regras centrais entram em uma única geração Luna. Marcadores são opcionais e contextuais, não sorteados nem adicionados depois da resposta. As últimas cinco aberturas do assistente são explicitadas no prompt para reduzir repetição; não se trata de garantia absoluta de comportamento do modelo.

O texto passa somente por limpeza de formatação, que não adiciona palavras. Números, unidades, porcentagens e pontuação útil são preservados. O Google recebe esse texto na voz já configurada. Frases completas e cláusulas com conteúdo mantêm streaming; confirmações como `Entendi.` ficam junto da próxima ideia quando há continuação. Não há segunda IA para reescrita.

Ao detectar nova fala, o motor mantém o mecanismo de epoch e interrompe áudio pendente/em reprodução. O gateway cancela geração antiga. Se houve resposta parcial, o histórico informa que ela pode não ter sido ouvida integralmente; a geração seguinte considera a nova informação. A regra de 720ms e a persistência em paralelo da atualização anterior permanecem.

## Dados e referências legadas

Naturalidade não autoriza inventar consultas ou resultados. Exame realizado sem laudo é explicitamente diferente de resultado disponível. Nenhum dado de paciente foi usado nas simulações; contexto sintético foi injetado apenas no processo local, sem gravar no backend da Max.

Referência Kokoro removida do comentário do sanitizador de fala; referência Scribe corrigida no limpador de transcrição; comentário sobre fallback corrigido no roteador. As referências ElevenLabs de áudios VARIABLE/FIXED e demais funções legadas foram preservadas, pois são externas ao fluxo CALL. A nova camada não depende delas.

## Validação e limites

O script opt-in executa vinte turnos sequenciais por personagem com o modelo e Voice Names lidos da produção. Passa pelo construtor real de prompt, Luna SSE e Google streaming, capturando PCM em WAV. Não disca nem envia mensagens. Testa continuidade, perguntas simples, novos fatos, exames sem resultados, pedido de pausa, mudança de assunto e fechamento. Também gera sete frases/variantes de pontuação em cada voz para comparação auditiva.

Os testes automatizados cobrem prompt, isolamento de identidade, contexto recente, ausência de preenchimento por timer, pontuação, rubricas, resposta vazia, cancelamento, início do áudio antes do fim da geração e preservação da persistência em paralelo. Uma regressão encontrada na implementação inicial foi corrigida: uma rubrica contendo ponto podia ser dividida e chegar ao TTS; a limpeza ocorre antes de detectar limites de frase.

Áudio gerado, conteúdo textual revisado e PCM não vazio não comprovam naturalidade auditiva. Esta sessão não dispõe de ferramenta para ouvir e avaliar os WAVs; as amostras são entregues para essa avaliação. A aprovação subjetiva e a chamada real no WhatsApp continuam pendentes. Não se declara 100% nem equivalência ao ChatGPT Voice. Latências do script começam na geração, não no último som falado pelo cliente.

## Referências oficiais

- https://developers.openai.com/api/docs/guides/voice-agents
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd

Resultados quantitativos e evidência de publicação são registrados no relatório local de validação entregue junto dos áudios. Reverter somente este commit restaura o comportamento anterior; não exige migração.
