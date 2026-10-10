# Passagem de contexto: continuar o Sistema Helena v3.1

Data: 10/10/2026. Branch: `claude/gallant-cray-xrdt0t`. Responder sempre em português simples (o fundador não é programador e lê no celular).
Leia antes: `AGENTS.md`, `docs/planos/sistema-helena-pacote/DECISOES-DO-FUNDADOR-20261010.md`, `docs/planos/sistema-helena-pacote/01-plano-v3.md` (plano base), `03-analise-especialistas.md` (48 melhorias) e `04-critica-da-analise.md` (12 correções obrigatórias).

## Por que este arquivo existe
A cota semanal acabou no meio do trabalho (a sessão bateu o limite várias vezes). **Os avisos de "workflow concluído" estavam errados**: os agentes falharam por limite e o roteiro seguiu mesmo assim. Exemplo: o plano v3.1 mostrou "2 rodadas sem furo novo" só porque os atacantes não rodaram. **Não conte nada como verificado sem rodar o teste.**

## Estado verificado (rodar para confirmar)
| Peça | Onde | Estado | Como conferir |
|---|---|---|---|
| Servidor de ferramentas `ler_pagina`/`buscar` | `motor/ferramentas/` | PRONTO: 588 testes passam, sem teste pulado | `cd motor/ferramentas && python -m pytest -q` |
| Validador de entregas (portão 1) | `motor/validador/` | Escrito: 677 testes passam. Falta ataque independente | `cd motor/validador && python -m pytest -q` |
| Executor do agente + servidor falso do provedor | `motor/executor/` | **3 testes FALHAM** (e a suíte é lenta, >2 min). Falta consertar e atacar | `cd motor/executor && python -m pytest -q -x` |
| Simulador da esteira | `motor/simulador/` | Código escrito, **SEM NENHUM TESTE** (o agente morreu). Falta escrever testes e atacar | `cd motor/simulador && python -m pytest -q` |
| Máquina de passagens (regras do card) | `helena-v2/maquina/` | Prova chegou a 0 violações na versão intermediária, atacada e consertada. **Reconferir**: `provar.py` leva mais de 2 min (meta: menos de 1 min) | `cd helena-v2 && python maquina/provar.py && python -m pytest -q maquina/test_maquina.py` |
| Contratos e catálogo dos 21 agentes | `helena-v2/schemas/`, `servicos.yaml`, `organograma.yaml`, `models.yaml` | Escritos, atacados e consertados | ver `validar.py` abaixo |
| Fichas, entregas, casos e jornadas | `helena-v2/agents/`, `deliverables/`, `casos/` | **Só 6 de 21** (Helena, Laura, Marina, Augusto, Caio, parte da Bianca). Nenhuma foi atacada | listar `helena-v2/agents/` |
| `helena-v2/validar.py` e `test_validar.py` | `helena-v2/` | **QUEBRADOS**: ainda são os da v1 antiga; `models.yaml` novo mudou de formato (TypeError). Precisa reescrever para v3.1 | `cd helena-v2 && python validar.py` |
| Roteiros das 4 empresas | `helena-v2/playbooks/` | Só o das 10 pessoas, **antigo**. Faltam os de iGreen, Saúde, eLiving e o ajuste do das 10 pessoas | — |
| Plano v3.1 | `docs/planos/sistema-helena-pacote/v3.1-secoes/` | 11 seções escritas (~435 mil caracteres), **NÃO montadas** em documento único, **não conferidas**. Os atacantes acharam **348 furos** em 8 grupos (`furos-apontados-por-atacantes.json`), **nenhum consertado ainda** | — |
| Banco, motor DBOS, tela do card, CI, backup, pacote de instalação | — | **Não começaram** | — |

## Fila de trabalho, em ordem de prioridade
1. **Consertar o `validar.py`/`test_validar.py` para a v3.1** (valida fichas, entregas, catálogo, organograma, roteiros, casos e jornadas contra os esquemas novos; cruza ficha×catálogo; matriz de revisão sem conflito; um teste de mutação por regra). É o portão de tudo.
2. **Plano v3.1:** consertar os 348 furos nas seções (verificando cada um; muitos se repetem entre os dois atacantes e entre grupos), aplicar as decisões do fundador (chaves trocadas NO FIM dos testes, não na fase 0; central da v1 será desligada; DBOS mantido), montar `docs/planos/sistema-helena-pacote/01-plano-v3.1.md` único (sem repetições, números iguais entre seções, "(novo na v3.1)" nas mudanças) e atacar o documento inteiro até 2 rodadas secas **de verdade** (conferir que os agentes não falharam). Depois escrever o registro de furos das rodadas 5 e 6.
3. **Fichas, entregas, casos e jornadas dos 15 agentes que faltam** (Bianca, Daniel, Theo, Nina, Ravi, Maya, Bruno, Olívia, Victor, Camila, Isabela, Pedro, Renata, Joana, Felipe e Clara). Seguir o molde dos 5 prontos. Ataque independente em cada um.
4. **Etapa A:** consertar as 3 falhas do executor, escrever os testes do simulador (1000+ sementes, mutações que o checador precisa pegar) e atacar as 4 peças.
5. **Roteiros das 4 empresas** com jornada de ponta a ponta que passe no replay da máquina. Códigos: BIZ-001 iGreen, BIZ-002 Ecossistema de Saúde, BIZ-003 Humano Digital, BIZ-004 eLiving™.
6. **Etapa B (banco):** migrations SQL geradas da `passagens.yaml`, função única que muda o estado, grants por extenso, vigia das 13 regras, testes no PostgreSQL local (16, em `/usr/lib/postgresql/16/bin`, via `su postgres`, porta própria; desligar ao terminar).
7. **Etapa C (motor DBOS 3.2.0):** laço, vaga de trabalho + vaga da Helena, chave por execução, trava única, recuperação, testes de queda (20x), dois motores, cancelamento em até 15 s, motor que se recusa a ligar sem o endereço do banco.
8. **Etapa D:** os 21 agentes rodando de ponta a ponta no simulador e nos roteiros das 4 empresas.
9. **Etapa E:** tela do card no app, testes automáticos do GitHub (com orçamento de minutos), backup, receitas de manutenção para quem não é programador, pacote de instalação com o passo a passo das frases do fundador.
10. **Conferência cruzada final:** plano × especificação × decisões do fundador; rodar validador e todos os testes e mostrar a saída real.

## Regras que não mudam
- Banco, servidor e deploy só mudam com a **frase exata do fundador para aquela ação**. Nada disso foi tocado. Tudo o que existe está só em arquivos e testes locais.
- Nunca copiar valores de chave. Há chave de acesso total do Supabase escrita em 9 arquivos de `scripts/` e `services/helena-gateway/dev-server.mjs` (lista com `git grep -l eyJhbGciOi`); a troca foi adiada para o fim dos testes por decisão dele. Nenhum arquivo novo pode ter chave.
- Agentes nunca cadastram, contatam gente de fora, gastam, assinam ou publicam. Ferramentas dos agentes só LEEM. DEC-014: sem API paga da OpenAI.
- Nunca prometer "zero furo": dizer "nenhum furo conhecido em aberto".
- Nunca dizer que algo está verificado sem rodar o teste. **Confira se os agentes de um workflow falharam** (campo `failures` no aviso) antes de aceitar "concluído".
- Hostinger: o fundador precisa conferir no painel o que vence em 27/10/2026. Sem recomendação até ele conferir.

## Como retomar
- Modelo barato: usar Sonnet para construir e atacar; Haiku só para tarefa mecânica (rodar testes, conferir arquivos). Nada de Opus para tarefa repetitiva.
- Ambiente local de testes: `python3 -m venv /tmp/venv && /tmp/venv/bin/pip install "dbos==3.2.0" "psycopg[binary]" pytest pyyaml jsonschema`.
- Os roteiros de agentes que geraram este trabalho estão em `docs/planos/sistema-helena-pacote/roteiros-de-agentes/*.workflow.js`. São a referência dos prompts e dos esquemas de saída. Os caminhos `/tmp/...` dentro deles são do ambiente antigo: troque por `docs/planos/sistema-helena-pacote` e `helena-v2`.
- Trabalhe em etapas pequenas e **faça commit e push ao fim de cada etapa**, atualizando a tabela "Estado verificado" acima.
