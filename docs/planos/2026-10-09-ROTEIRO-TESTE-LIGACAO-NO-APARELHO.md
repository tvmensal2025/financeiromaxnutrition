# Roteiro de teste da ligação no aparelho (09/10/2026)

A ligação pelo agente de ligação da ElevenLabs foi testada por código e por testes automáticos, mas **ninguém
ligou de verdade em um aparelho**: a máquina que fez o trabalho não tem a chave da ElevenLabs nem a do Google.
Este roteiro é o que falta. Leva uns 20 minutos.

## Antes de começar

1. **No painel da ElevenLabs**, abra um dos agentes "eLiving …" e use o botão de teste ("Test AI agent") por 10
   segundos. Se ele conectar e falar, os minutos de agente estão valendo. Se der erro de créditos, os minutos
   dependem dos créditos de texto, que voltam em 12/10: até lá o app usa a reserva sozinho.
2. Use o **site publicado** (não a prévia dentro do editor do Lovable).
3. Em cada teste anote: aparelho, versão do sistema, navegador ou app instalado, Wi-Fi ou 4G, com ou sem fone, e
   o texto exato de qualquer aviso.

## No navegador do celular e no computador

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Toque no botão de ligar e aceite o microfone. Conte os segundos de "Conectando...". | A saudação vem inteira, sem o começo cortado. No Android são de 4 a 8 segundos; no iPhone e no computador, menos. |
| 2 | Responda. Depois interrompa o personagem no meio de uma fala. | Ele para de falar e escuta. |
| 3 | Fique calado enquanto ele fala, no viva-voz e depois com fone. | Ele não se corta sozinho. Se cortar no viva-voz, anote: é eco. |
| 4 | Aperte o volume durante a fala. | Se estiver baixo no iPhone, anote: o iPhone trata como chamada. Com fone melhora. |
| 5 | Toque em "Microfone" (mudo), fale, e desfaça. | Mudo, ele não responde. Sem mudo, volta a responder. |
| 6 | Deixe o celular parado por 2 minutos com a ligação aberta. | A tela continua acesa. Sem ninguém falar por 90 segundos, a ligação se encerra sozinha (depois de os ajustes do agente serem gravados na conta). |
| 7 | Bloqueie a tela por 20 segundos e desbloqueie. | Anote se a ligação continuou e se ele ainda ouve e fala. |
| 8 | Desligue e ligue de novo, duas vezes. | Abre de novo. Anote se o navegador pede o microfone outra vez. |
| 9 | Toque em "Me Ligar no Celular" com a ligação no ar. | A ligação do app desliga. |
| 10 | Repita o passo 1 no 4G. | Conecta. Se cair na reserva (a conversa vira por turnos, com outra voz), anote. |
| 11 | Olhe a legenda durante a conversa. | Nenhum colchete `[ ]` aparece. |

## Reserva

Peça a quem cuida do Supabase para pôr o segredo `VOICE_CALL_AGENT=off` nas Edge Functions por alguns minutos e
repita os passos 1, 2 e 6. A conversa passa a ser por turnos (você fala, ele responde). Teste com os quatro
personagens: **com o Alex a voz do Google não existe hoje** (pendência registrada), então é esperado que ele
fique sem voz na reserva até a voz ser escolhida. Depois tire o segredo.

## App instalado (Android e iPhone)

Só depois de gerar um app novo: a versão instalada hoje não declara o microfone, então a ligação não abre nela.
Com o app novo, repita os passos de 1 a 8. Na primeira vez deve aparecer o pedido de microfone do sistema.

## Avisos que dizem a causa

| Aviso na tela | O que é |
|---|---|
| "Acesso ao microfone foi negado..." | Permissão do microfone. |
| "O microfone não voltou depois da troca de linha. Ligue de novo." | O agente falhou e o microfone não reabriu para a reserva. |
| "A ligação caiu. Ligue de novo." | A conversa com o agente caiu depois de ele já ter falado. |

O motivo de uma ligação ter ido para a reserva fica gravado no banco, na tabela `voice_calls`, coluna
`disconnect_reason` (por exemplo `reserva:sem_minutos|user`). No site publicado não há mensagens no console.

## O que anotar para ajustar depois

- **Ele corta quem fala devagar** → voltar a vez de falar de `eager` para `normal` (uma constante em
  `scripts/ensure-character-voice-agents.mjs`).
- **Começo da saudação cortado no Android** → não reduzir a espera de 3 segundos do SDK.
- **Demora para conectar e cai na reserva no 4G** → o prazo do app é de 20 segundos.
- **Fala longa demais ou colchete lido em voz alta** → é do roteiro do agente; anotar a frase.
