# Como mudar o Sistema Helena sem quebrar

Para quem mantém (você ou outro agente). Uma página. Regra de ouro: **a regra mora num lugar só**. Mude lá, rode a conferência, olhe o verde ou o vermelho.

## O que é fonte e o que é gerado

| Você quer mudar | Mude aqui (fonte) | Depois rode | O que acontece sozinho |
|---|---|---|---|
| O modelo de IA de um agente | `helena-v2/models.yaml` (uma linha) | `python validar.py` | nada mais |
| Missão, regras ou limites de um agente | `helena-v2/agents/<nome>.yaml` | `python validar.py` | a conferência recusa ficha que diverge do catálogo |
| Quem revisa o quê, quem é dono de um serviço | `helena-v2/servicos.yaml` | `python validar.py` | confere teto de revisões, ordem de ativação, quem julga depois |
| O formato de uma entrega (seções, limites, checagens) | `helena-v2/deliverables/<tipo>.yaml` | `python validar.py` e os testes do validador | as checagens do validador leem os números dali |
| Uma meta em etapas (roteiro) | `helena-v2/playbooks/<meta>.yaml` | `python validar.py` | confere ciclo, orçamento e revisores |
| Uma regra do card (estados, prazos, tetos) | `helena-v2/maquina/passagens.yaml` | `python helena-v2/maquina/provar.py`, depois `python supabase/migrations-v2/gerar_passagens.py` (na raiz do repositório) e os testes do banco | o SQL das passagens é **gerado**, nunca editado à mão |
| Uma checagem do portão 1 | o YAML da entrega (números) e `motor/validador/validador/checagens/spec_<tipo>*.py` (lógica) | testes do validador | o quadro de cobertura do README se atualiza com `python -m spec_helena --atualizar-readme` |
| Ideias e anotações de aula | `docs/ideias/AAAA-MM-DD-assunto.md` | nada | não mexe em nada: é só um lugar para guardar |

## Trocar de modelo ou de runtime sem mexer na estrutura

- **Trocar o modelo** de um agente: edite UMA linha do apelido em `helena-v2/models.yaml` e rode `python validar.py`. Fichas, banco e telas não mudam (`motor/executor/testes/test_troca_de_modelo.py` prova isso com as fichas reais).
- **Trocar de runtime** (Hermes, EVE, OpenClaw ou outro): o motor fala com qualquer executor pela mesma porta (`rodar`, `cancelar`, `limpar`, `capacidades`). O nome do runtime escolhido vem da variável `HELENA_V2_EXECUTOR` (vazia = `hermes`). Só entra no registro (`motor/executor/executor_helena/registro.py`) um adaptador escrito, revisado e aprovado na suíte de conformidade; veja o passo a passo em `motor/executor/README.md` ("Como adicionar um executor novo"). Hoje só o Hermes está aprovado; EVE e OpenClaw têm adaptador **pronto para conectar, não aprovado** (testado só contra um falso de cada um; o motor recusa a partida com eles). O passo a passo de conexão, agente por agente, está em `docs/manual/conectar-runtimes.md`.
- **Fazer manutenção** (mudar missão, limites, serviços, roteiros): por ficha/YAML ou pela tela de configuração; nada disso exige mexer no motor.

## Personalização por revisões

A tela **Configuração e revisões** (`/configuracoes`, só o fundador; desde a DEC-032 não há flag, e `/configuracoes-v2` redireciona) edita os documentos reais de agentes, organograma, serviços, modelos, roteiros e entregas. Clone uma revisão, altere o rascunho, salve, solicite validação e só então ative. O worker técnico processa a fila; o navegador não aprova sua própria configuração. Consulte `motor/orquestrador/README.md` para os comandos locais.

Cada novo card do motor exige uma revisão ativa e conserva seu identificador. Para inativar a revisão ativa, primeiro ative outra; a base técnica é preservada. Revisões inativadas continuam no histórico e cards em andamento conservam sua própria revisão. Retirar um serviço exige ajustar também as dependências, fichas e roteiros afetados: a validação recusa referências quebradas. Duas edições simultâneas não se sobrescrevem; a segunda precisa atualizar a versão.

Identidades, schemas de validação, permissões e a máquina de estados exigem mudança técnica com testes e migração. O painel não elimina essa necessidade. Os bundles operacionais não incluem os exemplos dos testes. O motor desta etapa continua sendo uma prova local com opt-in explícito para respostas simuladas; ainda não é um executor conectado à produção.

## Os comandos (todos locais, nenhum toca no banco real, no servidor ou na publicação)

```sh
cd helena-v2 && pip install -r requirements.txt && python validar.py     # OK, ou erro em português
cd helena-v2 && python -m pytest -q                                      # as regras do conferente e da máquina (cerca de 5 minutos)
cd motor/validador && pip install -r requirements.txt && python -m pytest -q
cd supabase/migrations-v2 && pip install -r requirements.txt && python -m pytest   # sobe um PostgreSQL de teste sozinho
npm ci && npm test && npm run build                                      # o app
```

Todo envio ao GitHub roda isso sozinho (aba Actions, "Helena v2"). **Verde = pode seguir. Vermelho = não junte.**

## Mudar sem medo

1. Faça a mudança num ramo novo, nunca direto na `main`.
2. Rode `python validar.py` primeiro: é o mais rápido e diz o que está errado.
3. Resolveu uma pendência conhecida? Tire a linha dela de `helena-v2/PENDENCIAS.yaml` (a conferência acusa pendência velha).
4. Não escreva a mesma regra em dois arquivos. Se precisar de um número, ele vai no YAML e o código lê de lá.
5. Nada novo grande no plano: o plano está congelado. Mudou algo importante? Uma decisão curta em `docs/decisoes/` e uma linha no `HANDOFF-CLAUDE-CODE.md`.

## O que nunca fazer sem a sua frase exata

Aplicar migration no Supabase real, publicar, mexer no servidor (EasyPanel, Hostinger), rodar o Hermes real ou qualquer arquivo de `scripts/`. Os arquivos de `scripts/` têm chave escrita (a troca fica para o fim dos testes, DEC-027): não os rode, não os leia, não os copie.

## Onde olhar quando algo falha

| Sintoma | Olhe |
|---|---|
| `validar.py` aponta um arquivo | a linha do erro diz o arquivo e a regra (ex.: `[MAT-08]`); a descrição da regra está em `helena-v2/validar.py` |
| Teste do validador falha num caso | `motor/validador/README.md` (guia e quadro de cobertura) |
| O SQL do banco "difere do gerador" | rode `python supabase/migrations-v2/gerar_passagens.py` e comite o resultado |
| Não sei onde está um documento | `docs/INDICE.md` |
