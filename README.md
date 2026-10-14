# Sistema Helena

A empresa operada por agentes de IA do fundador. Ele fala com a **Helena** (AGT-01), o pedido vira um **card**, especialistas fazem o trabalho, um revisor confere, e o resultado volta ao card. Atende 4 empresas: iGreen (BIZ-001), Ecossistema de Saúde (BIZ-002), Humano Digital (BIZ-003) e eLiving™ (BIZ-004).

- **v1 (no ar):** app (esta pasta), gateway (`services/helena-gateway`), 21 perfis no Hermes e o Supabase `wxkgrykduqtsgmjkzlou`.
- **v2 (em construção, só em arquivos e testes):** a especificação em `helena-v2/` e as peças do motor em `motor/`. O plano é `docs/plano/PLANO-HELENA-V3.md` (motor DBOS).

Regras do projeto: `AGENTS.md`. Estado atual e próximos passos: `HANDOFF-CLAUDE-CODE.md`. Lista de todos os documentos: `docs/INDICE.md`.

## Onde está cada coisa

| Pasta ou arquivo | O que é |
|---|---|
| `AGENTS.md` | Regras para quem mantém (agentes de IA e pessoas) |
| `HANDOFF-CLAUDE-CODE.md` | Estado atual, fila de trabalho e pendências do fundador |
| `.env.example` | Nomes das variáveis de ambiente, sem valores |
| `docs/plano/` | O plano único (`PLANO-HELENA-V3.md`) e o registro de furos |
| `docs/decisoes/` | Uma decisão por arquivo (DEC-NNN) |
| `docs/manual/` | Guias em vigor: voz, eLiving, integrações, troca de chaves, comando mestre |
| `docs/ideias/` | Ideias e anotações de aulas ainda não aprovadas, com data |
| `docs/auditoria/` | As auditorias |
| `docs/arquivo/` | Planos, relatórios e registros antigos, só consulta (`LEIA.md` diz o porquê de cada um) |
| `docs/helena/` | Dados usados por scripts e testes do gateway (não mover) |
| `helena-v2/` | Especificação da v2: regras do card, catálogo dos 21 agentes, fichas, formatos de entrega, casos, validador |
| `motor/` | Peças do motor da v2: `ferramentas`, `validador`, `executor`, `simulador` (testes ao lado de cada uma) |
| `src/`, `public/` | App React/Vite (v1) |
| `services/` | Gateway e serviços da v1 |
| `supabase/` | Migrations do banco (aplicar só com a frase do fundador) |
| `scripts/` | Scripts de manutenção da v1 (alguns ainda têm chave escrita; ver DEC-027) |
| `artifacts/`, `screenshots/` | Pacotes e capturas usados pelos scripts de empacotamento |

## Como rodar

Nada abaixo toca no banco, no servidor ou na publicação.

**App (v1)**

```sh
npm ci
npm run dev        # http://localhost:8080 ; as chaves ficam em .env.local, que não entra no git
npm test           # testes do app (vitest)
npm run build      # build de produção
```

**Gateway (v1)**

```sh
cd services/helena-gateway
npm ci
npm test           # testes unitários; não fala com o Supabase de verdade
# npm run test:manual-supabase-real   só de propósito e com autorização: faz pedido real ao Supabase
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
```

## Segurança

- Nunca coloque senha, token ou chave em arquivo do repositório nem no chat. Use `.env.local` e as variáveis do EasyPanel.
- A chave de serviço não fica no navegador.
- Mudança no banco, no servidor ou na publicação só com a frase exata do fundador para aquela ação.
