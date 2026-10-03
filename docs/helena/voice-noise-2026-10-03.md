# Voz: ruído, recuperação e calibração — 03/10/2026

## Escopo e estado da primeira rodada

Alterações locais desta conversa lateral, restritas à voz. Backend: `C:\Users\plata\financeiromaxnutrition`. Frontend: `C:\Users\plata\Documents\Codex\2026-09-27\preciso-que-voc-fa-a-o\integration-max-20261003`. Preservadas as alterações de streaming que já existiam de outra frente. Não houve push, implantação, reinício ou alteração de Supabase por esta conversa. Não equivale à integração dos lotes do aplicativo.

## Preparação da publicação autorizada

Em continuação, o usuário autorizou colocar as correções no serviço e testar novamente. Candidata preparada em `codex/voice-noise-release-20261003`, baseada em `02cbdc05cc7c2e0aeb559a9b78e33b1cec5f424e`, em checkout separado. A pasta anterior `work/gateway-deploy` e o checkout principal, ambos com trabalho local, foram preservados. O conflito do comando de testes foi conciliado mantendo os testes novos do GitHub e acrescentando o teste de streaming desta rodada.

Escopo de publicação: somente os serviços existentes `helena-automation/helena-gateway` e `helena-automation/meowcaller-service`. Os dois endpoints de saúde passam a informar `voice_revision=20261003-noise-r1`, para distinguir esta versão no runtime. Nenhuma alteração no Supabase, no frontend MAX ou nas sessões WhatsApp. A pausa permanece em 720 ms por padrão; os limites de 5 s/8 s de STT são tetos de falha, não esperas inseridas na conversa. A evidência final de implantação deve ser conferida após o build e não é inferida deste documento de preparação.

Validação da candidata sobre a base remota: `npm ci`, `npm test` com **335 testes Node, zero falhas/ignorados/cancelados**, servidor e **29 verificações de segurança**; `npm run check` e sintaxe dos módulos alterados aprovados. Meowcaller: `go test -mod=mod ./...` aprovado (voz e integração) e `go build -mod=mod ./cmd/server` aprovado. Os 31 testes adicionais do gateway em relação à rodada local anterior vieram da base remota preservada. O preparo Go usou o patch de relay existente, normalizado para LF somente no checkout Windows; a substituição temporária de dependência em `go.mod` foi excluída da entrega. Estes testes continuam sem representar ligação real.

## Implementação local

- Meowcaller (`internal/voice/speech_gate.go`, `engine.go` e testes): o volume deixa de ser suficiente para confirmar/manter fala. O filtro rejeita energia constante, valores inválidos, impulsos isolados e extremos acústicos. Conserva a confirmação temporal e as épocas de cancelamento. Durante reprodução, o pré-áudio preserva os frames do início confirmado sem acrescentar a cauda anterior do assistente.
- `CALL_SPEECH_END_SILENCE_MS`: pausa configurável no Meowcaller, entre 360 e 1500 ms, arredondada para cima em frames de 60 ms. Valor ausente/inválido mantém 720 ms. Não foi configurada na VPS. Só tem efeito com o novo binário.
- Gateway: transcrição usa o cliente servidor `ws` com autenticação por cabeçalho; timeout e cancelamento também interrompem espera por áudio que não chega. Desconexão do cliente cancela captura. Falhas de transcrição são tratadas.
- Streaming: limite aplicado por evento em vez do pacote de rede inteiro; timeout/cancelamento durante contrapressão e persistência; resposta só concluída após confirmação do salvamento. Testes de `browser-call-stream` incluídos em `npm test`.
- Navegador: detecção respeita a frequência real de captura (16/44,1/48 kHz), exige confirmação maior durante reprodução e desconsidera votos separados por suspensão do temporizador. Gravador trata desconexão, erro, ausência do evento final e troca de conta. Transcrição vazia não é aceita como fala; palavras curtas continuam válidas.
- Reprodução no navegador: reconstituição de PCM dividido entre pacotes, validação do protocolo, cancelamento e prazo para dispositivo que não conclui a reprodução.

## Validação local

- Meowcaller: 17 testes de nível superior aprovados em `go test -json ./internal/voice`; nenhum evento de falha. `go build ./cmd/server` aprovado. Log: `services/meowcaller-service/voice-noise-validation.jsonl`.
- Gateway: `npm test` aprovado com 298 testes Node, verificação do servidor e 29 verificações de segurança. Log local: `services/helena-gateway/voice-gateway-validation.log`. Provedores externos e envio de mensagens usam simulações nesses testes.
- Frontend: 63 testes em 10 arquivos de voz; tipagem app e lint dos arquivos revisados aprovados. Logs locais na pasta de integração: `voice-all-validation.log`, `voice-types-validation.log`, `voice-lint-validation.log`.
- Estes resultados não comprovam fala real, versão implantada, eco em viva-voz ou latência audível no celular.

## Continuação: gargalos e telemetria

Rodada posterior ao roteiro acima, em 03/10/2026:

- Reproduzida a ausência de limites distintos para abertura da transcrição e resultado final: ambos dependiam do limite global de 40 s. Agora `transcribeLivePCM` limita a abertura a 5 s e a resposta final a 8 s contados somente após o fim do áudio. Mantido o teto global. Uma resposta pronta segue imediatamente; estes valores são limites de falha, não esperas obrigatórias. Erros identificam a fase e incluem apenas métricas técnicas, sem conteúdo transcrito.
- Reproduzidas quatro consultas legadas de configuração feitas em sequência. Agora começam em paralelo, mantendo o perfil canônico como primeira autoridade, a leitura atual de `is_active` e a propagação de falhas. Não adicionada configuração antiga em cache. O ganho depende de o caminho legado ser usado; não se atribui a ele toda a demora da produção.
- Métricas de streaming agora separam `context_wait_ms`, `llm_provider_first_token_ms`, `text_chunk_wait_ms` e `tts_first_audio_ms`; as métricas anteriores continuam disponíveis. Isso evita atribuir ao modelo o tempo gasto esperando cadastro ou montagem da frase. STT também informa `stt_session_ready_ms` e `stt_input_stream_ms`.
- Testes novos foram executados antes de corrigir: 4 falhas reproduzidas (dois prazos, telemetria ausente e leituras seriadas). Após correção e teste adicional de separação de fases, `npm test`: **304 testes Node e 29 verificações de segurança aprovados**, além da verificação do servidor; nenhuma falha. Sintaxe dos quatro módulos de produção alterados aprovada. Logs: `voice-latency-before.log`, `voice-latency-after.log`, `voice-gateway-latency-validation.log` em `services/helena-gateway`.
- Não houve nova alteração no detector Go nem redução da pausa normal de 720 ms nesta continuação. A calibração acústica permanece pendente da chamada real.

### Conferência remota desta continuação

O Easypanel passou a exibir os registros. Confirmada visualmente a geração recorrente de QR de ligações, coerente com `PAIRING_REQUIRED`. Confirmados na tela Source: repositório `tvmensal2025/financeiromaxnutrition`, branch `main`, Build Path `/services/meowcaller-service` e método Dockerfile. Nenhum campo foi salvo ou serviço reiniciado.

A última implantação exibida como concluída é `fix(voice): end short speech after 720ms silence`, finalizada em 29/09/2026 00:04:23 UTC (28/09/2026 21:04:23 em São Paulo). O histórico local associa esse título a `506b27b2da6a8118b2aeb0dc2b7841c1474d4834`; a tela não fornece um SHA de código, portanto essa associação não substitui uma identificação de versão em runtime. Não é a implantação das correções desta conversa.

Comparados diretamente, por leitura do GitHub no commit `02cbdc05cc7c2e0aeb559a9b78e33b1cec5f424e`, sete arquivos com a base local `3a525c3f6c21ff83282106815efc9fbc759c20af`: `engine.go`, `live_stt.go`, `live-transcription.mjs`, `call-streaming.mjs`, `voice-agent-store.mjs`, `voice-agent.mjs`, `routes/integrations.mjs`. Todos idênticos na base; o avanço remoto não trouxe conflito nesses sete arquivos. Isso não é conferência de todo o repositório nem autorização para substituir mudanças de outras áreas.

O endpoint de histórico do gateway, filtro de hoje, devolveu lista de chamadas vazia. Não há amostra desta rodada para calcular mediana, p95 ou tempo audível real. Próximo aceite: sessão Meowcaller conectada, publicação coordenada do lote de voz com versão verificável, chamada guiada e comparação dos tempos por etapa, sem confundir tempo enviado ao transporte com som ouvido no telefone.

## Constatação remota somente leitura

Em 03/10/2026 às 05:47 (São Paulo), `/health` do Meowcaller respondeu HTTP 200, versão genérica `2.0.0`, `whatsapp_status=PAIRING_REQUIRED`, QR disponível e zero chamadas ativas. O perfil ativo consultado no gateway era `sirlene_normal`. O estado pode mudar; consultar novamente antes do teste. A versão genérica não identifica o commit implantado. O painel abriu, mas a área central de informações do serviço não carregou, impedindo conferir logs e imagem implantada.

Configuração de fonte compatível com o Dockerfile local do Meowcaller: repositório `tvmensal2025/financeiromaxnutrition`, branch `main`, Build Path `/services/meowcaller-service`, Dockerfile `Dockerfile` dentro desse contexto. O gateway tem contexto próprio `/services/helena-gateway`. Confirmado por leitura do remoto que `main` existe. Na consulta, remoto em `02cbdc05cc7c2e0aeb559a9b78e33b1cec5f424e`, HEAD local em `3a525c3f6c21ff83282106815efc9fbc759c20af`: revisar o avanço remoto antes de qualquer publicação, sem substituir alterações concorrentes.

## Roteiro de ligação real pendente

Usuário confirmou chamada pelo WhatsApp, atendente Sirlene; origem identificada na conversa (não copiar telefone para este documento). Antes de medir: sessão Meowcaller conectada, perfil conferido, versão implantada identificada e registros da chamada acessíveis. Usuário inicia a ligação; não realizar chamada automática.

1. Aguardar a saudação terminar. Dizer: “Bom dia. Responda em uma frase: como você pode me ajudar hoje?”. Medir o fim da própria frase até o primeiro áudio audível.
2. Testar “sim” e “não”, cada um no turno apropriado, sem emendar outra frase.
3. Dizer “Hoje eu queria”, pausar aproximadamente meio segundo e completar “organizar minha alimentação”. Verificar se a pausa natural foi respeitada.
4. Durante a resposta, dizer “Espera um momento. Responda mais curto”. Conferir interrupção, primeira sílaba e ausência de áudio antigo.
5. Em outra resposta, produzir só um toque leve na mesa/teclado, sem falar. A resposta deve continuar. Não bater no microfone.
6. Permanecer cinco segundos em silêncio com o ruído ambiente normal. Não deve inventar fala nem manter escuta indefinida.
7. Repetir com fone e viva-voz. Registrar conexão, ruído, volume, latência percebida, cortes e identificador da chamada.

Calibração: manter 720 ms como referência, depois comparar 600 e 480 ms, se a primeira rodada passar. 420/360 ms são candidatos posteriores, não garantia nem valores aplicados. Separar pausa de encerramento, transcrição, primeiro token, primeiro PCM e transporte. Primeiro PCM enviado não comprova primeiro som audível no telefone. Não prometer atraso zero.

## Limites e pendências

Filtro conservador, não VAD neural, identificação de locutor ou cancelamento de eco. Ruído na faixa de voz, música, TV e fala de terceiros ainda podem passar. Uma falsa interrupção com transcrição vazia não comprova retomada automática da resposta anterior. Faltam ensaio acústico e ligação real, calibração, revisão/publicação coordenada e confirmação da versão efetiva na VPS. Não afirmar “100%” a partir de sinais sintéticos.

## Documentação consultada

- https://developers.openai.com/api/docs/guides/realtime-transcription
- https://developers.openai.com/api/docs/guides/voice-websockets
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- https://docs.cloud.google.com/text-to-speech/docs/create-audio-text-streaming
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/stop_event
- https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/echoCancellation
- https://github.com/snakers4/silero-vad (avaliado; não implantado)
