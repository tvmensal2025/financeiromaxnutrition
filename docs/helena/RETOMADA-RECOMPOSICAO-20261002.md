# Ciclo real: recomposição do logo sem nova geração

Estado final conferido em 2026-10-02, após revisão das 23:56 UTC. Estado deve ser reconferido no Gateway antes de agir.

**CICLO NÃO APROVADO:** Nina/AGT-10 devolveu novamente, agora por tamanho da frase menor do logo, embora contraste e posição tenham sido corrigidos. Job DRAFT, 2/2 tentativas. Não liberar, zerar tentativas, criar sucessora automaticamente ou marcar aprovado. Aguardando escolha do fundador sobre aplicação da marca: versão compacta (símbolo/nome sem frase pequena) ou logo completo com maior área na composição.

## Tarefa vigente

`JOB-HR-df9121ea1e74887866f5906b90001319`, BIZ-003, Maya executa e Nina revisa. Exatamente um post e um story, somente revisão interna. Não publicar nem enviar mensagens externas. A copy aprovada vem de `JOB-HR-f4968945ad0ab31bfccc6b611b86b0a8` / `MEM-HR-661cdb23eb360b55f48737ebb923e8de`.

O post foi reaproveitado com bytes idênticos e zero chamadas ao gerador. A primeira execução produziu o story e vinculou ambos os arquivos. Nina pediu ajustes: o logo no story ficou sobre roupa escura, sem contraste; post preservado. Helena revisou a mesma tarefa, mantendo DRAFT, 1/2 tentativas. O job antigo `JOB-HR-ee3060f449310194fda5b585c192332c` continua esgotado; não reiniciar.

## Correção instalada

PR 13 incorporou `reuse_design`. PR 14 registra `recompose_design`, com base original comprovada, logo oficial atual, nova versão, recibo idempotente e revisão independente. Fonte instalada: SHA-256 `d035a9299af018fc9c7958f45312f0d65730ad62ac06a8373c52b398a3581aa3`.

A imagem original foi encontrada no cache da Maya e sua recomposição anterior reproduziu exatamente o PNG verificado. Ela foi preservada como `original.png` ao lado de `story-1-v1/final.png`. Recibos remotos: `/data/helena-runtime/story-base-provenance-20261002.json`, `compose-installed-20261002.json`, `compose-brief-revision-20261002.json`. Backup anterior preservado em diretório `compose-backup-*`.

Validação local: 15 testes visuais, 13 aprovados e 2 dependentes de fcntl/Linux. Teste adicional no Hermes Linux comprovou base original real, idempotência, rejeição de posição insegura/base incorreta e zero chamadas ao gerador. Não equivale à aprovação visual.

## Retomada autorizada

`revise_task_brief` aceitou a revisão do mesmo job, tarefa versão 3810, chave `compose-proven-20261002-01`. `release_job` aceitou chave `compose-release-20261002-01`: READY, 1 tentativa utilizada. Maya deve executar `recompose_design` para story-1, origem v1, destino v2, left=250, top=895; preservar post-v1; inspecionar e submeter ambos com legenda aprovada à Nina. Nenhuma nova geração de imagem. Não zerar tentativas, duplicar sucessoras, alterar aprovação ou executar fora da tarefa ativa.

TypeSafe retornou DAILY_LIMIT em modo consultivo; a liberação normal passou, sem recomendação de roteamento. Não declarar roteamento inteligente validado.

## Pendências e limites

Confirmar execução pelo controlador, inspecionar story-v2, parecer independente da Nina e apresentação final em Entregas. O ciclo ainda não está concluído neste registro. Houve intervenção do operador; não declarar autonomia integral nem homologação dos 21 agentes.

Recomposição exige base original preservada e prova de reprodução da versão anterior. A recuperação deste arquivo antigo foi assistida pelo operador. A implementação atual reposiciona sobre a base da primeira composição, não constitui um editor geral de camadas ou correção arbitrária de imagens.

## Atualização após execução e preservação automática

Maya iniciou a segunda tentativa às 23:47:56 UTC. Produziu `story-1-v2.png` pelo recompose_design, recibo VERIFIED/RECOMPOSE/model_calls=0. Post-v1 ficou intacto. Submeteu a entrega às 23:53:03 UTC; estado WAITING_HELENA, aguardando revisão. Operador abriu a imagem no R2 e confirmou logo na área clara abaixo do texto, sem a aplicação anterior sobre roupa escura.

PR 14 passou no Helena Gateway Check e foi incorporado (merge 1585ab1930a6b4480f684aae5a316a50c70b43d9). PR 15 também passou e foi incorporado (merge 02cbdc05cc7c2e0aeb559a9b78e33b1cec5f424e). A geração passa a preservar automaticamente original.png e logo.png; instaladores versionados aceitam as ferramentas de reaproveitamento/recomposição. A cor de fundo passa a vir da marca aprovada. Runtime instalado e conferido: SHA-256 `ee9236b92c506cf2a2a8e1f900bd81cd7cfc07b17e871da23c6e3e15b8ea3f1a`, recibo `/data/helena-runtime/preserve-installed-20261002.json`. Teste Linux PRESERVE_TEST_OK confirmou bytes da base e logo, idempotência e somente uma geração simulada, zero chamadas reais.

Arquivo de conferência baixado da prévia autenticada do R2: `artifacts/ciclo-final-20261002/story-1-v2.png`. Não rotular como aprovado até conferir parecer independente.

## Parecer final desta rodada e causa remanescente

Nina abriu os arquivos às 23:55:30 UTC e registrou REQUEST_CHANGES às 23:56:09 UTC, chave `wf:7d758dff09177608e9596ebc8ef851fb:review`, tarefa versão 3815. Parecer: post preserva composição/copy; story-v2 tem logo sobre área clara, sem faixa/duplicação, mas a assinatura/tagline continua minúscula e ilegível em apresentação móvel. A entrega da Maya também reconheceu a legibilidade sem zoom como pendente.

Causa verificável no código: composição e recomposição limitam o logo inteiro a 260x96 em uma peça de 1080x1920. Reposicionamento resolve contraste, não a escala da frase menor. O contrato exigiu leitura móvel dessa frase sem conferir antes se a variante completa da marca permitia esse uso. Não corrigir este desencontro baixando o critério ou aprovando administrativamente a peça.

Próxima decisão solicitada ao fundador: variante compacta oficial ou composição que reserve área suficiente para a marca completa. Depois da escolha, preparar aplicação concreta e revisável da marca, verificar legibilidade em 360px e somente então autorizar uma retomada limitada pelo fluxo normal. Nenhuma nova geração paga foi feita para story-v2. O runtime de preservação original já está instalado, mas não resolve sozinho tipografia/escala inadequadas.

Arquivos locais de conferência: `artifacts/ciclo-final-20261002/post-v1.png` e `story-1-v2.png`. Não são pacote aprovado/publicável. A caixa final do painel permanece sem este conjunto aprovado, conforme esperado.
