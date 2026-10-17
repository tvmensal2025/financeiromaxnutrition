# Sistema Helena

A empresa operada por agentes de IA do fundador. Ele faz um pedido, o pedido vira um **card**, especialistas fazem o trabalho, um revisor confere, e o resultado volta ao card. Atende 4 empresas: iGreen (BIZ-001), Ecossistema de Saúde (BIZ-002), Humano Digital (BIZ-003) e eLiving™ (BIZ-004).

**Para retomar sem misturar relatos antigos com o estado atual, comece por [Ponto único de retomada](docs/manual/onde-estamos.md).**

Para conectar o trabalho preservado, consulte o [mapa do sistema para a IA](docs/manual/mapa-do-sistema.md) e o [inventário de reaproveitamento](docs/manual/mapa-de-reaproveitamento.md). A orientação enviada ao Hermes na triagem é gerada a partir da configuração e do contexto capturados pelo motor; seu contrato está no [guia da triagem](docs/manual/guia-da-triagem.md). Um documento salvo não comprova que o serviço remoto já o esteja usando.

- **v2 (o app atual):** o app (esta pasta, só a v2 desde a DEC-032), a especificação em `helena-v2/`, as peças do motor em `motor/` e o esquema `helena_v2` em `supabase/migrations-v2/`. O plano é `docs/plano/PLANO-HELENA-V3.md` (motor DBOS). O HANDOFF relata a instalação do motor e conexões TLS em 17/10/2026; no mesmo bloco, um relato inicial diz que o despachante estava desligado e uma atualização posterior diz que os três serviços ficaram ativos. Há também relatos divergentes sobre a revisão ativa. São registros históricos, não confirmação do estado atual. O dia de prova e o primeiro card ponta a ponta continuam sem comprovação nos documentos.
- **v1 (preservada):** a interface antiga está em `docs/arquivo/app-v1/`. A orientação do fundador de 17/10 autoriza adaptar seu trabalho visual à v2; o arquivo original permanece preservado. Gateway, serviços de voz (`services/`), scripts (`scripts/`) e migrations antigas (`supabase/migrations/`) têm contratos próprios e não são religados pela inclusão do painel.

Regras do projeto: `AGENTS.md`. Retomada e próxima ação: [`docs/manual/onde-estamos.md`](docs/manual/onde-estamos.md). Relatos técnicos datados: `HANDOFF-CLAUDE-CODE.md`. Lista de documentos: `docs/INDICE.md`.

## O app da v2

| Rota | O que é | Quem vê |
|---|---|---|
| `/login` | Entrada com e-mail e senha (Supabase Auth) e `app_access` ativo | todos |
| `/` | **Visão geral**: cards consultados, decisões pendentes, pedidos recentes e empresas/agentes da revisão ativa | fundador; membros veem a indicação de acesso reservado |
| `/cards` | **Cards**: Kanban, detalhe, etapas, entregas, ações, perguntas e publicação; fundador também registra pedidos em texto livre e confirma propostas | membros, com dados sujeitos às permissões do banco |
| `/configuracoes` | **Configuração e revisões** dos documentos da Helena (fichas, organograma, serviços, modelos, roteiros, entregas), ativação e reversão | só o fundador |

`/painel`, `/cards-v2` e `/configuracoes-v2` redirecionam para as rotas correspondentes. Links antigos `/?card=...` continuam abrindo o card em `/cards`; o banco e a tela conferem acesso ao destino. A inclusão de visão geral não reativa as rotas financeiras/CRM da v1. Não existe flag: a v2 está sempre ligada.

## Onde está cada coisa

| Pasta ou arquivo | O que é |
|---|---|
| `AGENTS.md` | Regras para quem mantém (agentes de IA e pessoas) |
| `HANDOFF-CLAUDE-CODE.md` | Estado atual, fila de trabalho e pendências do fundador |
| `.env.example` | Nomes das variáveis de ambiente, sem valores |
| `docs/plano/` | O plano único (`PLANO-HELENA-V3.md`) e o registro de furos |
| `docs/decisoes/` | Uma decisão por arquivo (DEC-NNN) |
| `docs/manual/` | Guias em vigor: como mudar, dia de prova, conectar runtimes, eLiving, voz, troca de chaves, comando mestre |
| `docs/ideias/` | Ideias e anotações de aulas ainda não aprovadas, com data |
| `docs/auditoria/` | As auditorias e os ataques independentes |
| `docs/arquivo/` | Planos, relatórios, registros antigos e o app da v1 (`app-v1/`), só consulta (`LEIA.md` diz o porquê de cada um) |
| `docs/helena/` | Dados usados por scripts e testes do gateway (não mover); `dados-v1/` tem os JSON que saíram de `src/` |
| `helena-v2/` | Especificação da v2: regras do card, catálogo dos 21 agentes, fichas, formatos de entrega, casos, validador |
| `motor/` | Peças do motor da v2: `ferramentas`, `validador`, `executor`, `simulador`, `orquestrador` (testes ao lado de cada uma) |
| `src/`, `public/` | App React/Vite da v2 |
| `services/` | Gateway e serviços de voz da v1 (parados no app; ainda implantados) |
| `supabase/migrations-v2/` | Esquema `helena_v2` (aplicar só com a frase do fundador) |
| `supabase/migrations/` | Migrations antigas do `public` (história do banco) |
| `scripts/` | Scripts de manutenção da v1 (alguns ainda têm chave escrita; ver DEC-027) |
| `artifacts/`, `screenshots/` | Pacotes e capturas usados pelos scripts de empacotamento |

## Como rodar

Nada abaixo toca no banco, no servidor ou na publicação.

**App (v2)**

```sh
npm ci
npm run dev        # http://localhost:8080 ; as chaves ficam em .env.local, que não entra no git
npm test           # testes do app (vitest)
npx tsc --noEmit -p tsconfig.app.json
npm run build      # build de produção
```

**Especificação da v2**

```sh
cd helena-v2
pip install -r requirements.txt
python validar.py              # OK, ou OK com pendências conhecidas (PENDENCIAS.yaml); erro novo sai com código 1
python validar.py --estrito    # trata as pendências como erro
python -m pytest -q            # testes do validador e da máquina de regras (cerca de 7 minutos)
```

**Motor da v2** (cada peça tem o seu `requirements.txt`)

```sh
cd motor/ferramentas && python -m pytest -q    # servidor de ferramentas dos agentes (só leitura)
cd motor/validador   && python -m pytest -q    # portão 1 das entregas
cd motor/executor    && python -m pytest -q    # adaptador do Hermes com servidor falso (cerca de 2 minutos)
cd motor/simulador   && python -m pytest -q    # agentes de mentira e checagem das regras
cd motor/orquestrador && python -m pytest -q   # motor DBOS, fila, relógio, vigia, publicação (banco local)
```

**Banco da v2**

```sh
cd supabase/migrations-v2
pip install -r requirements.txt
python gerar_passagens.py --conferir   # o SQL gerado confere com o YAML
python -m pytest                       # sobe um PostgreSQL de teste sozinho
```

**Gateway (v1, parado)**

```sh
cd services/helena-gateway
npm ci
npm test           # testes unitários; não fala com o Supabase de verdade
```

## Segurança

- Nunca coloque senha, token ou chave em arquivo do repositório nem no chat. Use `.env.local` e as variáveis do EasyPanel.
- A chave de serviço não fica no navegador.
- O repositório está **público temporariamente** (17/10/2026, para publicar o site). Volte para privado depois de publicar e nunca cole chave, senha ou token no chat: o que passou pelo chat precisa ser trocado.
- Mudança no banco, no servidor ou na publicação só com a frase exata do fundador para aquela ação.
