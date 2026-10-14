# DEC-032 — A v1 está parada; o app roda só a v2

- **Data:** 14/10/2026
- **Número:** PROVISÓRIO. O Supabase é a fonte dos números; antes de usar este número, conferir lá (só leitura) que ele está livre.
- **Quem decidiu:** o fundador, respondendo na sessão do Claude Code de 14/10/2026 ("não estou rodando a v1, ela está parada; vamos rodar apenas a v2").

## O que foi decidido
- A **v1 não roda mais**: a sala de comando, a conversa por regex, o CRM, o financeiro, o calendário, as 59 tabelas genéricas e o resto da interface antiga saem do app.
- O **app (pasta `src/`) passa a ser só a v2**: login, a tela dos cards (raiz `/`, com pedido real, ações, perguntas e leitura do fundador) e a configuração da Helena (`/configuracoes`, só o fundador).
- A **flag `VITE_HELENA_V2_HABILITADA` deixa de existir**: a v2 está sempre ligada. Os endereços antigos `/cards-v2` e `/configuracoes-v2` redirecionam para os novos.
- A **empresa não é mais um seletor global** do app: ela é um campo do card, escolhido no pedido, como manda a especificação (`helena-v2/organograma.yaml`).

## O que foi feito nesta sessão
- Código da v1 do app movido para `docs/arquivo/app-v1/` (mesmos caminhos, só consulta; fora do TypeScript, dos testes e do lint). Nada foi apagado do histórico.
- Dados que o gateway e dois scripts ainda leem (`agentes.json` e as duas marcas) foram para `docs/helena/dados-v1/`, com os caminhos atualizados.
- `App.tsx`, `Layout.tsx`, `main.tsx` e um único CSS (`src/styles/helena.css`) reescritos para a v2; `runtime.ts` dos cards e da configuração sem a flag.
- Testes do app reescritos para as rotas novas (rotas protegidas, menu, redirecionamentos, rotas da v1 caindo na raiz).

## O que NÃO muda com esta decisão
- **Gateway, serviços de voz e scripts** (`services/`, `scripts/`) continuam no repositório. São a central da v1, que a DEC-028 manda desligar **só com a frase exata do fundador**, depois do inventário e do aviso aos clientes. Nada no servidor foi tocado.
- **Migrations da v1** (`supabase/migrations/`) continuam: são a história do banco real. O esquema `helena_v2` convive com o `public` no mesmo projeto.
- O **banco e a publicação** não foram tocados. Rodar a v2 de verdade ainda depende do dia de prova com Hermes real (`docs/manual/dia-de-prova.md`).

## Por quê
O fundador já operava sem a v1. Manter duas interfaces no mesmo app escondia a v2 atrás de uma flag, duplicava menus e testes, e fazia a porta de entrada da empresa ser um classificador de frases em vez do card.

## Fonte
Esta conversa. Continuidade em `HANDOFF-CLAUDE-CODE.md`.
