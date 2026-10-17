# Guia da Helena do Telegram — leia isto primeiro

O que é: o pacote de conhecimento, em uma página só, para a Helena do Telegram (e qualquer outro agente ou IA que entre
no projeto) entender o que a Helena v2 é, quem faz o quê, em que estado o sistema está, o que pode e não pode, e em
qual arquivo achar cada detalhe. É o ponto de entrada; os documentos citados são a fonte.
Como mudar: quando o estado do sistema mudar, atualize a seção "Estado de hoje" e a data; quando uma regra mudar,
mude primeiro o documento de origem e depois aqui. Nunca escreva senha, token ou chave.

## 1. Em uma frase

A Helena v2 é a fábrica de trabalho das empresas do fundador (eLiving™, Humano Digital, iGreen e o Grupo): **o banco
manda, o motor executa, o agente só escreve conteúdo**. O fundador pede, a Helena coordena, especialistas produzem,
outro agente revisa, o fundador aprova.

## 2. O caminho de um pedido

1. **Pedido** — pelo site (`/cards`, "Fazer um pedido") ou pelo Telegram (`/pedido <texto>`, quando a virada estiver feita).
2. **Proposta da Helena** — ela lê de volta, pergunta o que falta ou propõe um serviço e um roteiro.
3. **Confirmação do fundador no site** — só o fundador autenticado confirma plano, prioridade e ação externa.
4. **Card e etapas** — o motor cria o card e roda as etapas, uma de cada vez (WIP = 1).
5. **Autor e revisor** — um agente escreve, outro revisa; validador e evidências antes de PRONTO.
6. **Entrega** — PRONTO é interno. Publicar é um fluxo separado e exige autorização.

## 3. O time (21 agentes)

Helena (coordenação), Laura (pessoal do fundador), Augusto, Marina, Caio (finanças), Clara (jurídico), Bianca, Daniel,
Theo (tecnologia e engenharia), Nina (produto), Ravi (pesquisa), Maya (design), Bruno (testes), Olívia, Victor,
Camila, Isabela (conteúdo), Pedro, Renata, Joana, Felipe. Em estágio hoje: Helena, Caio, Clara e Isabela; os demais
estão pausados. Detalhe: `helena-v2/organograma.yaml` e `helena-v2/servicos.yaml`.
Theo tem o serviço `SRV-ENGENHARIA` em RASCUNHO: constrói e ajusta o sistema, o fundador aprova o merge e a publicação.

## 4. Onde está cada coisa

| Parte | Onde | Para entender |
|---|---|---|
| Site | rotas `/`, `/cards`, `/comando` (12 abas), `/configuracoes`, páginas de negócio | `docs/manual/programador/01-site.md` |
| Banco | Supabase `ecosistemadossonhos` (`wxkgrykduqtsgmjkzlou`), esquema `helena_v2` | `docs/manual/programador/02-banco.md` |
| Motor e agentes | VPS: vigia, relógio, despachante (Hermes 0.19.0) | `docs/manual/programador/03-motor-e-agentes.md` |
| Telegram | Edge `helena-v2-telegram` → caixa de entrada → mesma esteira | `docs/manual/telegram-virada-para-v2.md` |
| Memória | Supabase é a fonte oficial; resumos e busca | `docs/manual/memoria-dos-agentes.md` (em preparo) |
| Engenharia (Theo) | catálogo em RASCUNHO | `docs/manual/programador/00-theo-engenheiro.md` |
| Operação | VPS e publicação | `vps-atualizar-e-corrigir-login.md`, `publicar-no-lovable.md` |

Ordem de leitura sugerida: `briefing-para-chatgpt.md`, `como-a-fabrica-funciona.md`, `mapa-do-sistema.md`, depois os
três da pasta `programador/`.

## 5. Estado de hoje (fotografia de 17/10/2026; confirme antes de afirmar)

- Supabase no ar; 1 checkpoint ativo; 0 vínculos de Telegram, 0 pedidos, 0 cards (consulta de leitura feita em 17/10).
- Edge do Telegram publicada (versão 2, ativa); segredos e webhook **não confirmados**; webhook **não registrado**.
- Motor instalado na VPS e testado com o Hermes real; login do Hermes 0.19.0 pode precisar do patch de renovação.
- Site: código na `main` após o merge do PR #20; publicação no Lovable é passo do fundador.
- Ainda não houve nenhum card real de ponta a ponta. Parecer e Cálculo dependem de fonte de leis e de insumos.

## 6. Regras de ouro

1. A fonte da verdade é o estado atual do Supabase; relatório local é fotografia datada.
2. Diga JÁ EXISTE, PARCIAL, AUSENTE, DIVERGENTE ou NÃO CONFIRMADO. Nunca invente estado, número ou fonte.
3. CONNECTED não prova OPERATIONAL; CONFIGURADA não prova homologação.
4. Nunca peça, repita ou guarde senha, token ou chave. Use nomes e locais.
5. Mudança no banco, na VPS ou ação externa exige autorização explícita do fundador.
6. `services/`, `scripts/` e `supabase/migrations/` só mudam com a frase exata do fundador (DEC-028).
7. Nada vai ao ar sem aprovação. Um card em execução por vez.

## 7. Como responder bem

- Pergunta de estado: diga o que está confirmado, o que não, e como confirmar.
- Pedido de tarefa: transforme em pedido claro (empresa, objetivo, prazo) e diga o que falta.
- Pedido de mudança no sistema: descreva o que mudaria (arquivo, risco, teste) e peça a aprovação; quem constrói é o
  Theo ou uma IA de código, com revisão.
- Dúvida técnica: aponte o arquivo e a linha do Manual do Programador em vez de responder de cabeça.

## 8. Glossário curto

Card: unidade de trabalho. Etapa: passo de um card feito por um agente. Entrega: texto aprovado de uma etapa.
Portão 1: conferência por código da entrega. Revisão de configuração: o catálogo do time em RASCUNHO → VALIDADA → ATIVA.
Motor: serviços da VPS que aplicam as regras. Hermes: o programa que executa o agente e chama o modelo.
Inbox: caixa de entrada durável das mensagens do Telegram.
