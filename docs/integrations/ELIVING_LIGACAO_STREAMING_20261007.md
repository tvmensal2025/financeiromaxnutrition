# eLiving — correção isolada da ligação em streaming

Data: 07/10/2026. Escopo: código local, testes e preparação da entrega; sem publicação.

## Conferência antes da alteração

- Repositório canônico: `C:\Users\plata\financeiromaxnutrition`, branch `missao-cumprida-v4`, base `680da1f`.
- Cópia de trabalho: `C:\el-gwvoice`, branch `codex/ligacao-streaming`.
- Atualizadas as referências de `origin` e comparados os arquivos de voz em todas as refs locais/remotas disponíveis neste repositório. `voz-eliving-v4` já continha as vozes atuais; nenhuma voz foi recriada ou alterada.
- Os commits de voz `745c123` e `05e4efb` estavam em `voz-eliving-v4`, mas faltavam em `origin/main`. Esta entrega depende dessa base de voz. Conferir novamente na integração, pois outros agentes trabalham em paralelo.
- A comparação também abrangeu as cópias locais identificadas: `financeiromaxnutrition_para_chatgpt`, `work/gateway-deploy` e `work/voice-release`; não apareceu o adaptador de diálogo novo nas refs/cópias consultadas.
- Esta auditoria é dos arquivos relacionados à ligação; não é homologação de todas as pastas do computador.

## O que já estava correto

Uma configuração gerada da fonte única do app; voz e ajustes aprovados para Sirlene, Alex, Dr. Vital e Rafael; Google Chirp 3 HD fixo por personagem; limpeza das tags para tela, banco e Google; autenticação e persistência da conversa.

`node --experimental-strip-types scripts/sync-voice-config-gateway.mjs --gateway C:\el-gwvoice\services\helena-gateway --check`, executado no app, confirmou que `eliving-voice-config.mjs` é igual à fonte única. Não editar este arquivo manualmente.

## Diferenças corrigidas

1. Transporte ativo de fala ao vivo passa a usar o WebSocket Text to Dialogue para o modelo de tempo real já aprovado, com credencial apenas no cabeçalho do servidor, uma voz por conexão e os mesmos ajustes salvos.
2. Conexão reaproveitada entre segmentos PCM de um turno; `flush` evita esperar um bloco grande de texto. Resposta parcial é entregue antes do fim da síntese.
3. Abertura web também negocia NDJSON: GPT gera por partes e o TTS começa antes da resposta completa. Clientes antigos continuam com JSON.
4. Cota recusada no handshake ou em frame, falha temporária e timeout sem áudio acionam a reserva Google com a voz correta e sem tags. O circuito de cota evita tentativas repetidas na hora.
5. Interrupção/desligamento cancelam a síntese. Uma frase já parcialmente ouvida não é reiniciada inteira pelo Google; a falha fica explícita, evitando duplicação. Não prometer continuidade perfeita se o provedor cair no meio de um áudio.
6. Prévia MP3 usa o mesmo transporte e espera `is_final`, após `close_socket`, para receber os bytes finais do encoder. Áudio gravado mantém o fluxo existente.
7. `metrics.tts_providers` informa os provedores que entregaram áudio; `/health` da versão preparada identifica `20261007-eliving-dialogue-streaming`.

## Evidências locais

- 8 testes do protocolo de diálogo aprovados: conexão WS real em loopback, autenticação, frames, voz única, reuso, chunk antecipado, quota, timeout, cancelamento, fim sem áudio, finalização MP3 e recusa no handshake.
- 390 testes da suíte geral do gateway aprovados, zero falhas e zero skips; smoke do servidor concluído; 29 verificações das rotas de segurança aprovadas.
- Os testes de protocolo entram automaticamente em `npm test` pelo `pretest`.
- Checagem de sintaxe dos módulos alterados e `git diff --check` aprovados.
- APIs externas e contexto de cliente simulados; o WS real de loopback não usa ElevenLabs real. Não houve consumo de créditos ou envio de dados de clientes.

## Publicação e aceite ainda necessários

Consulta somente de leitura ao gateway publicado retornou HTTP 200, `ok=true`, mas `voice_revision=20261005-elevenlabs-v4-hybrid`. Isso identifica revisão anterior; não prova qual provedor atendeu uma chamada individual.

Para integração, conferir a `main` atual e incorporar somente a base de voz ausente e o commit desta entrega. Não fazer merge cego de `missao-cumprida-v4`, que tem alterações alheias ao eLiving. Reexecutar testes no resultado integrado.

Publicar gateway e app coordenadamente, somente com autorização do dono. Depois confirmar a nova revisão, disponibilidade/permissão do modelo na conta e uma chamada autenticada de cada personagem em aparelho físico: primeira fala, resposta, interrupção, troca de modo, desligamento e isolamento da conta. Conferir latências e `tts_providers`; testar reserva em homologação sem alterar a cota de produção.

Streaming reduz espera por áudio completo; latência zero não é garantida. Não houve medição de chamada real nesta execução. Não alterar `.env`, Lovable, banco, R2, vozes da conta ou 3D para esta integração.

Referências: [guia de diálogo em tempo real](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd), [frames e finalização do protocolo](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket).
