# Mapa operacional da Helena v2

Este é um guia para localizar o fluxo atual. A orientação curta enviada à triagem é gerada por `motor/orquestrador/orquestrador/mapa_operacional.py` a partir da **revisão de configuração capturada** e do **contexto canônico do pedido**. Este arquivo explica as fontes; seu texto não é carregado no prompt. O mapa não autoriza ações.

## Telas

| Rota | Uso |
| --- | --- |
| `/` | Painel de visão geral (`PainelV2Page`). `/?card=...` e `/?pedido=...` encaminham para `/cards`, preservando a busca. |
| `/cards` | Pedidos, propostas, cards em Kanban e pedido de publicação (`CardV2Page`, `KanbanV2`). |
| `/configuracoes` | Revisão e ativação da configuração v2 (`ConfiguracoesV2Page`). |
| `/painel`, `/cards-v2`, `/configuracoes-v2` | Endereços antigos que redirecionam, respectivamente, para `/`, `/cards` e `/configuracoes`. |

As rotas efetivas estão em `src/App.tsx`. Não existe rota `/overview`; a visão geral está em `/`. A apresentação das propostas e do Kanban está em `src/pages/CardV2Page.tsx` e seus componentes.

## Fontes e responsabilidade

| Fonte | O que determina |
| --- | --- |
| Revisão publicada de `helena-v2/organograma.yaml` | Identidades do fundador, coordenação, agentes e empresas; pacote empresarial confirmado. O fundador não é agente. |
| Revisão publicada de `helena-v2/servicos.yaml` | Estado do serviço, dono, revisor titular e empresas atendidas. `RASCUNHO`, `EM_TESTE`, `PAUSADO` e `APOSENTADO` não recebem card real. `ESTAGIO` e `ATIVO` ainda passam pelos validadores do motor. |
| Contexto do claim de proposta | Checkpoint `ATIVO`, decisões vigentes e portfolio. O `contexto_hash` identifica o snapshot e o banco o revalida antes de gravar a proposta ou confirmar. Checkpoint e decisões contextualizam fatos; portfolio é cadastro de empresa, não prova dos fatos de um pedido. |
| `helena_v2.pedido_entrada` e `pedido_entrada_evento` | Pedido e eventos imutáveis, inclusive esclarecimentos; a triagem não apaga o histórico. |
| `pedido_entrada_resposta_bruta` e `pedido_entrada_proposta` | Resposta auditável do Hermes e proposta tipada `PERGUNTAR` ou `PROPOR`. Proposta não executa trabalho. |
| `pedido_entrada_plano` | Plano após confirmação por RPC autenticada do fundador. Modelo e mapa não confirmam pelo fundador. |
| `helena_v2.card`, `etapa`, `entrega`, `historico` | Card e andamento aplicados pelo motor segundo configuração e máquina. Revisor efetivo e aptidão são validados na criação do card; o revisor do mapa é o titular do catálogo. |
| `helena_v2.publicacoes` | Pedido e estado da publicação (`PEDIDA`, `EM_EXECUCAO`, `PUBLICADA`, `FALHOU`, `REVERTIDA`), separados do estado do card. `resposta_execucao` guarda respostas de autor/revisor, não resultado de publicação. |

## Sequência observável

`RECEBIDO` (pedido) → `PERGUNTAR` ou `PROPOR` (proposta) → confirmação do fundador → `PLANO_CONFIRMADO` (pedido) → validação do motor e `CARD_CRIADO` (pedido) → fluxo do card até `PRONTO` → pedido de publicação em `/cards` e estado próprio em `publicacoes`. Um card `PRONTO` não equivale a algo publicado. A ativação de configuração é outro controle, em `/configuracoes`.

O despacho consome planos confirmados usando `consumir_plano_pedido` e `criar_card_pedido`; o motor ainda deve emitir `PLANO_VALIDO` somente após sua validação. Para serviços cujo resultado exige Parecer, a ausência de fonte legal verificável (`FON-LEIS`) bloqueia a confirmação/execução. A orientação não transforma esse bloqueio em permissão.

O mapa viaja dentro do pacote da coordenação (`_autor_plano` em `triagem_pedido.py`) junto dos eventos, das opções elegíveis e do checkpoint atual. O limite total do pacote é 60 KB. Dados de capacidade como `fundador_uid`, token de lease e credenciais ficam fora do pacote. Alterações nas rotas, fontes ou estados devem atualizar o manifesto em `mapa_operacional.py`, este guia e os testes correspondentes.

Esse alcance é o da triagem do motor. Um `/pedido` encaminhado pela inbox usa essa triagem após a instalação; uma mensagem comum do Telegram segue a conversa do Hermes e ainda não recebe automaticamente este mapa ou consultas ao Supabase. A configuração e as ferramentas reais dessa conversa precisam ser inventariadas antes de conectar seu contexto, como indica a [retomada Hermes/VPS](retomada-hermes-vps.md).
