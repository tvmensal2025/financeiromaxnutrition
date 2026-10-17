# Memória dos agentes — onde guardar, como buscar, como compactar

**O que é:** o desenho da memória do time da Helena: onde ela mora (Supabase), como cada execução recebe só o que importa (fatos duros + resumo + poucos trechos buscados), como se compacta com revisão, como se isola uma empresa da outra, quanto custa e como desfazer. Escrito em 17/10/2026 a partir do código do repositório; **não consultou o banco nem a VPS**. Tudo o que é novo está **NÃO APLICADO e DESLIGADO por padrão**.
**Como mudar:** a regra de escopo, os limites e os tamanhos moram em `motor/orquestrador/orquestrador/memoria.py` (constantes no topo) e na proposta SQL `docs/propostas/0027_memoria_agentes.sql` (rascunho, fora de `supabase/migrations-v2/`). Mudou uma regra: mude código, SQL e testes juntos (`motor/orquestrador/testes/test_memoria.py` e `test_memoria_sql_rascunho.py` comparam os dois lados). Decisões que dependem de você estão na seção 15. Para retomar o estado geral, veja [onde-estamos.md](onde-estamos.md); para a fábrica, [como-a-fabrica-funciona.md](como-a-fabrica-funciona.md).

---

## 1. A resposta em quatro frases

1. **A memória oficial mora no Supabase.** Telegram é só o canal de conversa. Hermes é só o operador que chama o modelo.
2. **Os agentes não "lembram"; eles consultam.** Guarda-se tudo (entregas, histórico, decisões já ficam no banco), o código **busca só o relevante** e **compacta** o antigo em resumos revisados.
3. **A cada execução, o código monta o contexto:** fatos duros (como hoje) + o resumo certo + no máximo alguns trechos buscados, cada um com o "de onde veio". O agente escreve conteúdo; **quem grava é o código**.
4. **Cada empresa é uma gaveta fechada.** O filtro por empresa/agente/card vale no código e de novo dentro do banco; a vida pessoal (Laura) nunca se mistura com empresa.

| Onde guardar? | Papel | Pode guardar memória? |
|---|---|---|
| **Supabase** (`helena_v2`) | Fonte da verdade: resumos versionados, trechos buscáveis, uso e custo | **Sim, é a única memória oficial** |
| **Telegram** | Canal: você fala, a Helena responde. O Update fica no `telegram_inbox` (redigido) | **Não.** Só `/pedido` e decisões confirmadas viram registro (seção 10) |
| **Hermes** do motor (0.19.0) | Operador descartável: sobe um perfil novo por execução e apaga tudo | **Não.** Memória e compressão estão desligadas no perfil |
| **Hermes 0.15.1 do Telegram** | Conversa com você; tem memória própria | Continua com a memória **de conversa** dele (formato e limite NÃO CONFIRMADOS). **Não é oficial** |

---

## 2. A recomendação foi validada contra o código

| Afirmação | Veredito | Evidência no código |
|---|---|---|
| Supabase é a única fonte de verdade | **CONFIRMADO** | `AGENTS.md` (precedência: banco real > decisões > checkpoint > memória mestre > arquivos). `motor.py` grava a resposta no banco **antes** de apagar a pasta (`registrar_resposta_execucao`, depois `executor.limpar`). `historico` só acrescenta. `checkpoint_mestre` já é um resumo versionado (uma versão ativa, anteriores superadas; relato de 17/10: 38 versões) — o padrão que a memória vai copiar |
| O Hermes de cada execução não guarda memória | **CONFIRMADO** para o 0.19.0 do motor | `executor_helena/perfil.py:179` (`memory_enabled: False`, `user_profile_enabled: False`) e `:182` (`compression: enabled False`); perfil novo por execução (`gerar_perfil` recusa pasta reaproveitada); `conferencia.py:121` marca `MEMORIA_ESCRITA` se o Hermes escrever em `memories/`; a pasta é apagada no fim. **Ressalva:** o Hermes 0.15.1 do Telegram é outra instalação, com memória própria (seção 10) |
| Telegram é só canal, nunca memória | **CONFIRMADO, com ressalva** | `0025_telegram_inbox.sql`: guarda o Update bruto (redigido) para auditoria e deduplicação; só `/pedido` vira pedido; `CONVERSA` e `MIDIA` são registradas **sem interpretação**; callbacks só registrados. Nenhum código do motor fala com Telegram. A ressalva: o histórico de chat do Telegram não é recuperável de forma confiável (o bot não relê mensagens antigas) e não tem hash, revisão nem escopo |
| O contexto é montado pelo código em `contexto_real.py`, e é ali que a memória entra | **REFINADO (a localização estava errada)** | `contexto_real.py` monta o contexto **do validador** (portão 1; chama `conferir_contexto`). O que o agente lê é o `carga` montado em `Motor.executar_e_salvar` (`motor.py`, perto da linha 889), com um subconjunto: `servico`, `pedido`, `modelo`, `fontes_importadas`, `decisoes_vigentes`, `pacote_da_empresa`. O **revisor** recebe o `contexto` inteiro do autor (`motor.py` ~1205). Colocar memória em `contexto_real.py` a levaria ao revisor e ao validador, e ela poderia ser tomada por fonte. Por isso a memória entra **só no `carga` do autor**, em campo próprio (`memoria`) |
| Há risco de vazamento entre empresas | **CONFIRMADO — três pontos reais** | (1) Os 21 agentes são um **centro compartilhado** (`mapa-do-sistema.md`): memória "por agente" sem empresa carregaria a empresa A para o card da B; hoje só o perfil descartável impede isso. (2) A triagem (`triagem_pedido.py`) enxerga **todas** as empresas por desenho; memória de empresa não pode entrar ali. (3) Decisões com `business_id` nulo valem para todas (`fonte_supabase.py` aceita `NULL` ou a empresa do card): o escopo "fundador" é lido por todos e precisa da sua aprovação |
| Limites de tamanho | **Achado novo e importante** | O pacote vai como **um argumento de linha de comando** (`hermes -z <pacote>`, `perfil.montar_comando`). **Testado aqui: o Linux recusa um argumento de 131 072 bytes ou mais** (`Argument list too long`; 131 071 passou). O pacote do autor **não tem teto** hoje; a triagem tem 60 000 bytes (`triagem_pedido.py:308`). Sem compressão do Hermes, conversa grande vira `GRANDE_DEMAIS`. Memória sem orçamento derruba a execução |
| Truncar resumo sem cuidado corrompe números | **Precedente real na v1** | `20260929200000_hermes_compact_work_context.sql:50` corta o resumo do checkpoint com `left(..., 2200)`, que pode partir um número ou uma data ao meio |

Resumo: **a recomendação se confirma**, com duas correções (onde a memória entra no código; e a obrigação de ter orçamento por causa do limite de 131 072 bytes) e uma ressalva (Hermes 0.15.1).

---

## 3. A arquitetura em linguagem simples

Pense no escritório de uma empresa grande:

- O **arquivo morto** guarda **tudo**: cada entrega aprovada, cada decisão, cada aprovação sua. Isso **já existe** no Supabase e nunca é resumido.
- A **ficha de cada trabalho** (card) é um resumo curto do que foi feito e aprovado naquele card.
- A **pasta de cada especialista em cada empresa** diz "o que a Isabela já sabe da empresa X": tom, erros que já corrigiu, o que o cliente aprovou.
- A **sua pasta** guarda o que você decidiu para todas as empresas ("frases curtas", "nunca prometer ganho") — só entra depois do seu "sim".
- O **bibliotecário** (a busca) acha no arquivo morto os poucos trechos ligados ao pedido de hoje, sempre dentro da gaveta certa.
- Antes de cada trabalho, um **assistente de código** (não de IA) entrega ao especialista uma bandeja com: os fatos duros do pedido, a pasta certa e meia dúzia de trechos achados, cada um com a etiqueta do arquivo de onde veio. **Nada mais.**

```text
              ┌────────────── Supabase (helena_v2) — única fonte de verdade ──────────────┐
 Camada 0     │ entregas aprovadas · histórico · decisões · fontes do pedido · checkpoint │  fatos duros: NUNCA resumidos
 Camada 1     │ resumo do CARD                       (escopo CARD)                        │  um por card, versionado
 Camada 2     │ resumo do AGENTE × EMPRESA (× serviço) (escopo AGENTE_EMPRESA)            │  rolante, versionado
 Camada 3     │ memória do FUNDADOR / decisões        (escopo FUNDADOR, e PESSOAL à parte)│  com o "sim" do fundador
 Busca        │ trechos literais + índice de texto em português (tsvector/GIN)            │  recupera o top-K
              └───────────────────────────────┬───────────────────────────────────────────┘
                                              │  só o CÓDIGO lê e escolhe (filtro por escopo no código E no SQL)
                                              ▼
        memoria.py: fatos duros (como hoje) + resumo + top-K trechos com origem  →  `carga` do AUTOR
                                              │  (o revisor NÃO recebe a memória; o validador também não)
                                              ▼
              Hermes descartável (perfil novo, memória desligada) → resposta → código grava no banco
```

---

## 4. As camadas e o que já existe

| Camada | O que guarda | Quem escreve | Estado |
|---|---|---|---|
| **0. Fatos duros** | entregas aprovadas (`entrega`), `historico`, `public.decisoes`, `fontes_importadas` do card, `checkpoint_mestre`, aprovações. Números, fontes, datas e aprovações **nunca** são resumidos: são copiados ou citados por referência | motor/banco (já é assim) | **JÁ EXISTE** |
| **1. Resumo do card** | o que o card entregou e o que foi aprovado ou corrigido | serviço do time (Fase B) ou código (Fase A); revisado | **AUSENTE** (existe só a leitura de volta e o relatório final da Helena; este último não foi provado num card real) |
| **2. Resumo agente/serviço × empresa** | lições e contexto estáveis daquele especialista naquela empresa | idem; nasce de resumos de card **mais** fontes primárias | **AUSENTE** |
| **3. Fundador/decisões** | preferências e regras gerais (escopo FUNDADOR); vida pessoal à parte (PESSOAL, só Laura) | proposta do código, **aprovada por você** | **PARCIAL** (decisões vigentes e o checkpoint já existem e são lidos; preferências estruturadas e a aprovação por item são **AUSENTES**) |
| **Busca (recuperação)** | trechos literais de fontes primárias, com índice de texto em português | código (indexador), nunca o agente | **AUSENTE** (proposta no SQL 0027) |
| **Registro de uso e custo** | o que cada execução recebeu: ids, versões, hashes, tamanho | motor | **AUSENTE** (a medição de tokens reais já existe em `uso.json` → `resposta_execucao.uso`: **JÁ EXISTE**) |
| **Memória do Hermes 0.19.0** | — | desligada de propósito | **JÁ EXISTE** (desligada) |
| **Memória de conversa do Hermes 0.15.1** | conversa com você no Telegram | o próprio Hermes | **NÃO CONFIRMADO** (formato, limite e tamanho) |

---

## 5. O que o agente recebe em cada execução

O código (`memoria.py`) monta, nesta ordem e dentro de um orçamento:

1. **Fatos duros** — exatamente como hoje (`pedido`, `fontes_importadas`, `decisoes_vigentes`, `pacote_da_empresa`). Não mudam.
2. **Resumos do escopo certo** — até 6, do mais específico ao mais geral: card → agente×empresa → fundador. Máximo de 70% do orçamento.
3. **Top-K trechos buscados** (padrão K=5) — o resto do orçamento. Cada trecho traz `origem` (ex.: `ENTREGA:981`) e `hash`.
4. Um **aviso fixo**: a memória é apoio, não fonte; números, datas e aprovações só valem se estiverem nas fontes do pedido.

**Orçamento padrão: 12 000 caracteres do JSON final (≈ 3 a 4 mil tokens).** Tudo é medido no JSON que vai no pacote (aspas e quebras de linha contam). Se não couber: entram **afirmações e trechos inteiros**; o que sobra é registrado como omitido; fatos duros de um resumo são tudo-ou-nada. Texto livre sem afirmações é aparado por `truncar_sem_cortar_numeros` (corta em frase ou palavra e **nunca** no meio de número, data, moeda ou porcentagem). O orçamento ainda é reduzido para o pacote inteiro ficar abaixo de **60 000 bytes** (mesmo teto da triagem; o limite duro do Linux é 131 072). Se mesmo assim passar, a execução segue **sem** memória e o motivo é registrado; memória nunca derruba o trabalho.

Quem monta a **consulta de busca** é o código, a partir do objetivo da etapa e do pedido (`montar_consulta`: palavras significativas, sem acento, sem palavras vazias, máximo de 12 termos). O agente não escolhe o que a busca procura nem pode pedir "mais memória".

**O revisor não recebe a memória.** Ele julga pela rubrica e pelas fontes do pedido; assim a revisão continua independente e o custo não dobra. **O validador também não a vê**: a memória não pode ser citada como fonte.

### Onde liga no código (e por que está desligado)

`Motor(..., fonte_memoria=None)`: parâmetro novo, **desligado por padrão**. Se alguém injetar uma função `(ContextoDeEscopo) -> [Resumo]`, o motor só a usa em card real fora do modo de produção; no **modo de produção a opção é recusada** (`ValueError`), até você autorizar e a trava ser removida em código revisado. Hoje nenhuma função de leitura do banco existe no motor: ligar exigiria a migration 0027 aplicada e um leitor que chame `ler_memoria_execucao` e `buscar_memoria`. Nada disso foi feito.

---

## 6. Busca: o que é, o que não é

- **Armazenar tudo:** o arquivo morto (camada 0) já guarda. Para a busca, o código indexa **trechos literais e curtos** (até 1 200 caracteres) de fontes primárias, cada um com `origem_tipo`, `origem_ref` e o hash da fonte inteira. O código confere antes que o trecho **está de fato** na fonte (`conferir_trecho`); o agente não escreve trecho.
- **Recuperar só o relevante:** busca de texto do Postgres em **português** (`to_tsvector('portuguese', ...)`, `websearch_to_tsquery`, ranking `ts_rank_cd`, índice **GIN**). Acha "campanha" em "campanhas". O **filtro por escopo é obrigatório e acontece antes do ranking**, dentro do SQL (`_memoria_escopo_permite`); o limite de resultados é no máximo 10 e há **teto de caracteres** somados (≈ tokens). O código ainda **refiltra** o que a busca devolveu (`selecionar_trechos`), de modo que um defeito na busca não vaza empresa.
- **Compactar:** seção 7.
- **Busca por vetores (pgvector): OPCIONAL e é uma decisão sua.** **NÃO CONFIRMADO** que a extensão `vector` esteja disponível no projeto: nenhum documento nem migration do repositório a menciona (procurei por `pgvector`, `vector(` e `create extension`; só `pgcrypto` aparece). Quem tiver acesso ao banco confere em modo leitura com `select name, default_version, installed_version from pg_available_extensions where name = 'vector';`. O bloco do SQL está **comentado** no fim do rascunho. Antes de ligar: (1) extensão confirmada; (2) modelo de embedding escolhido (a dimensão depende dele); (3) custo e envio de texto ao provedor de embedding aprovados; (4) a busca vetorial continua obrigatoriamente filtrada pelo mesmo escopo, **antes** de ordenar por distância (índices aproximados podem devolver menos linhas quando o filtro é seletivo). Recomendação: **começar só com texto**. Vetores ajudam em sinônimos e perguntas vagas; para o volume inicial (poucas dezenas de cards por empresa) a busca textual basta e não manda texto para fora.

---

## 7. Política de compactação

### Quando
- **Fase A (sem IA, custo zero de tokens):** ao fechar um card (`PRONTO`), o código gera uma **ficha extrativa**: título, empresa, serviço, ids das entregas aprovadas, valores e datas copiados do que foi aprovado, decisões aplicadas. Tudo com fonte, nada interpretado.
- **Fase B (com IA, revisada):** quando houver N cards novos desde o último resumo de agente×empresa (sugestão N=5) **ou** o resumo ativo passar de 6 000 caracteres **ou** uma fonte citada mudar (`resumos_com_fonte_alterada`). Um agente do time escreve a narrativa; outro revisa.
- **Nunca em segundo plano sem ordem:** uma compactação com IA gasta cota e a vaga única (WIP = 1). Cards de manutenção só nascem com a sua autorização (decisão D6).

### Tamanho-alvo
- Resumo de card: até **1 500 caracteres**. Agente×empresa: até **4 000**. Fundador: até **3 000**. Limite duro do banco: 8 000 por resumo. Trecho: 1 200.
- Orçamento por execução: 12 000 caracteres (seção 5).

### O que nunca se resume
Números, fontes, datas e aprovações. O resumo guarda esses itens em `fatos_duros` (copiados pelo código da fonte, **não escritos pela IA**) e cada afirmação cita as fontes de que veio. O texto livre da IA só descreve; qualquer número que ela escreva precisa **existir numa fonte que a mesma afirmação cita** (`NUMERO_SEM_FONTE`, com normalização de `R$ 1.234,56`, `12,5%`, `17/10/2026` e `2026-10-17`). Identificadores como `DEC-022` e `BIZ-003` não contam como número.

### Resumo de resumo
- **Profundidade máxima 2.** Profundidade 0 = feito de fontes primárias; 1 = feito de resumos; 2 = resumo de resumo. Um terceiro nível é recusado (`PROFUNDIDADE_EXCEDIDA`).
- **Re-ancoragem:** todo resumo que cita outro resumo **precisa citar também fonte primária** (`SEM_ANCORA_PRIMARIA`). Ao atingir o limite, o próximo resumo é refeito **a partir das fontes primárias** da janela recente; o que ficou fora da janela deixa de estar na narrativa, mas **continua no arquivo morto** e na busca.
- Fonte que mudou (decisão alterada, checkpoint novo): o resumo é marcado para recompactar.

### Quem compacta e quem confere
1. **Autor:** um agente do time, por um **serviço próprio** (proposta: `SRV-MEMORIA`; nome e dono são decisão D5, nada foi criado em `helena-v2/`). Sugestão de partida: Olívia (operações internas) como autora e Daniel (dados) como revisor, Helena como reserva. O revisor **nunca** é o autor (`exigir_revisao_independente`; no banco, constraint + `MEMORIA_REVISAO_INDEPENDENTE_OBRIGATORIA`). Antes de o revisor de memória valer, ele deveria passar por um placar como o de `placar_revisor.py`.
2. **Conferência por código, antes da revisão** (`conferir_resumo`, e de novo no banco): cada afirmação cita ≥ 1 fonte **declarada**; cada fonte **existe** e **pertence ao escopo** (empresa, card); profundidade correta e ≤ 2; âncora primária; cada número sustentado pela fonte citada; nenhuma menção a **outra empresa** (nome ou código) nem, nos escopos gerais, a qualquer empresa; nenhum segredo (`segredos_no_texto`); tamanho. Reprovou → `REJEITADO` com motivo, e nada vira ativo.
3. **Revisão do outro agente** (execução de `REVISOR` com resposta gravada) e, nos escopos FUNDADOR e PESSOAL, **o seu "sim"** (RPC `aprovar_memoria_fundador`).
4. **Ativação** (`ativar_resumo_memoria`): comparação otimista (a base precisa continuar a versão ativa); a anterior vira `SUPERADO`. Nada é editado: cada versão é uma linha nova, com `texto_hash` (SHA-256), `base_id`, autor, revisor, número das execuções, fontes e hash de cada fonte.

### Como isso respeita "o agente só escreve conteúdo; o código grava"
O agente devolve uma estrutura (afirmações com fontes). Ele **não** grava no banco, **não** escolhe escopo, empresa, versão, hash, profundidade, validade nem estado, **não** ativa e **não** decide o que entra na próxima execução. Tudo isso é decidido por código e por constraint do banco. A IA nunca aprova a própria memória.

---

## 8. Expiração e esquecimento

- **Expiração** (`expira_em`): a leitura **ignora** o expirado na hora; `expirar_memorias` só marca o estado. Prazos sugeridos (decisão D7): resumo de card 90 dias após o card fechar; agente×empresa 180 dias, renováveis a cada recompactação revisada; fundador sem prazo, mas revisável; pessoal até você revogar.
- **Esquecer** (só você, `esquecer_memoria_fundador`): apaga o **texto** da memória derivada e, em cascata, de todo resumo feito a partir dela; mantém ids, hashes e a trilha ("o que foi esquecido, quando, por quê"). `ESQUECIDO` é definitivo.
- **Esquecer não apaga os registros de negócio** (entregas, histórico, decisões): esses seguem a política própria do banco. Esquecer memória não é desfazer uma entrega.

---

## 9. Isolamento entre empresas e entre pessoal e empresas

Regra única (`escopo_permite` em Python = `_memoria_escopo_permite` no SQL; um teste compara as duas em **todas** as combinações):

| Quem pergunta | Vê |
|---|---|
| Agente em **card de empresa X** | resumo **do próprio card**; resumo **do próprio agente na empresa X** (do serviço ou geral); memória do **fundador** (aprovada) |
| Agente em **card pessoal** (Laura) | resumo do próprio card pessoal; memória **PESSOAL** da Laura; memória do fundador |
| **Coordenação/triagem** (vê todas as empresas) | **somente** memória do fundador (nunca resumo de empresa) |
| Qualquer um | **nunca** outra empresa, outro card, outro agente, PESSOAL em empresa, empresa em PESSOAL |

Camadas de defesa: (1) **constraints de forma** por escopo na tabela; (2) o SQL de escrita confere que cada fonte pertence ao escopo e que o card pertence à empresa (`MEMORIA_FONTE_INEXISTENTE_OU_FORA_DE_ESCOPO`, `MEMORIA_CARD_FORA_DA_EMPRESA`); (3) o SQL de leitura e de busca filtra pelo escopo e **recusa** contexto incoerente (`MEMORIA_ESCOPO_INCONSISTENTE`); (4) o código refiltra; (5) o escopo FUNDADOR **não aceita fonte de empresa** (entrega, fonte importada) e exige o seu "sim"; (6) o código recusa resumo que **mencione** outra empresa; (7) tabelas fechadas: só funções `SECURITY DEFINER` chamadas pelo motor (`service_role`) escrevem; você (autenticado) só lista, aprova e esquece.

**Preferências duradouras só entram no escopo FUNDADOR por duas portas:** uma `DECISAO` sua (`public.decisoes`, global) ou um `/pedido` de Telegram pareado. Um comentário seu dentro do card de uma empresa **não** vira regra geral automaticamente.

NÃO CONFIRMADO: como um **card pessoal** é identificado no banco (hoje assumi `card.empresa` nulo; o organograma fala em escopo PESSOAL, mas nenhuma migration v2 o cria). Decisão D8.

---

## 10. Telegram, Hermes 0.15.1 e o Supabase convivendo

O fundador relata que o Hermes 0.15.1 do Telegram tem "uma memória que parece nunca acabar". Duas coisas diferentes:

- **Memória de conversa do Hermes 0.15.1** (para você conversar de forma contínua). **NÃO CONFIRMADO** o formato e o limite. Continua existindo, **não é oficial** e não alimenta os agentes do time.
- **Memória oficial do negócio** (Supabase). É a que os agentes consultam.

### Como verificar o Hermes 0.15.1, em modo leitura, na VPS (sem copiar conteúdo)
Executar manualmente, como o `inventario.sh` (que hoje só faz `stat` e `du` de `/root/.hermes` e não lista arquivos de memória). Os comandos imprimem **nomes, tamanhos e datas**, nunca o conteúdo:

```bash
H=/root/.hermes
stat -c '%n tipo=%F modo=%a mtime=%y' "$H" "$H/memories" "$H/sessions" "$H/state.db" 2>/dev/null
du -sh "$H/memories" "$H/sessions" 2>/dev/null
find "$H/memories" -type f -printf '%p %s bytes %TY-%Tm-%Td\n' 2>/dev/null | head -50
find "$H/sessions" -type f 2>/dev/null | wc -l
# só os NOMES das chaves de memória/compressão da configuração (sem valores)
grep -oE '^[[:space:]]*(memory[A-Za-z_]*|user_profile[A-Za-z_]*|compression|nudge_interval)[[:space:]]*:' "$H/config.yaml" 2>/dev/null
# nomes de tabelas e contagem de linhas da sessão, abertos somente para leitura
sqlite3 "file:$H/state.db?mode=ro" '.tables' 2>/dev/null
```
O que responder com isso: se existe pasta `memories/`, quanto pesa, quantos arquivos, se a configuração liga memória/compressão e quantas sessões há. **Não abrir nem enviar** o conteúdo (pode conter dados pessoais). Adicionar essa seção ao `inventario.sh` é opcional (decisão D2).

### A ponte opcional e segura (Telegram → Supabase)
Só o que você **confirma** vira registro; a conversa inteira nunca:

| Do Telegram | Vira registro no Supabase? | Como |
|---|---|---|
| `/vincular` (código) | Não | redigido e descartado (`0025`) |
| `/pedido ...` | **Sim, já existe** | pedido + recibo + `telegram_inbox` (`0021/0025`) |
| Conversa livre | **Não vira memória** | registrada como `CONVERSA`, sem interpretação; a memória de conversa fica no 0.15.1 |
| Mídia e callbacks | Registrados, sem leitura | já é assim |
| Decisão confirmada | **Sim** | por `public.decisoes` (DEC-xxx), a rota que já existe; passa a ser fonte citável |
| Preferência ("lembre que...") | **Só por `/pedido`** | vira **proposta** FUNDADOR com fonte `TELEGRAM_PEDIDO`; o banco só aceita `/pedido` de chat pareado, nunca `CONVERSA`/`MIDIA`; precisa do seu "sim" no site |

No sentido contrário (Supabase → Telegram): **AUSENTE e fora deste pacote.** O 0.15.1 não lê a memória oficial. Uma ponte futura possível é só informativa (um resumo gerado do Supabase e enviado pela caixa de saída `telegram_saida`), nunca relida como memória.

---

## 11. Custo em tokens e como medir

- **Referência medida (relato de 17/10):** a chamada mínima direta custou ≈ **10,7 mil tokens de entrada**. Medição por tarefa (autor + revisor + coordenação) **NÃO COMPROVADA**.
- **Acréscimo da memória por execução do autor:** no máximo o orçamento. 12 000 caracteres ≈ **3 a 4 mil tokens** (estimativa conservadora de 3 caracteres por token; o real para português fica perto de 3,5 a 4 e deve ser medido).
- **Por card:** acréscimo ≈ (tokens do bloco) × (execuções do autor que recebem memória). Exemplo ilustrativo, **não medido**: card de 3 etapas, 1 execução por etapa → ≈ 3 × 4 000 = **12 mil tokens a mais** (≈ +37% sobre 3 × 10,7 mil). No teto de 6 execuções por etapa o acréscimo seria 72 mil. O revisor e o validador não recebem a memória, então não pagam.
- **Compactação:** Fase A = **0 token**. Fase B = uma execução de autor + uma de revisor por compactação; a entrada é o conjunto de fontes (**NÃO MEDIDO**, depende do tamanho das entregas). Por isso só dispara por gatilho (seção 7) e com sua ordem.
- **Teto de segurança:** o orçamento nunca passa de 12 000 caracteres e o pacote de 60 000 bytes. Memória vazia não gera campo (sem custo).
- **Como medir de verdade:** (1) o motor registra em `memoria_uso` o que cada execução recebeu (ids, hashes, caracteres, tokens estimados); (2) `resposta_execucao.uso.tokens_entrada` já guarda o real; (3) `medir_custo_memoria()` cruza estimado e real por execução; (4) comparar a média de `tokens_entrada` de execuções **com** e **sem** memória no mesmo serviço (card de prova com `fonte_memoria` ligado em um card e desligado em outro). Só depois disso subir o orçamento.

---

## 12. Falhas e rollback

| Falha | O que acontece | Como desfazer |
|---|---|---|
| Resumo ruim (número errado, fonte falsa) | A conferência por código ou o revisor o recusa → `REJEITADO`; nada ativa | Nada a desfazer |
| Resumo ruim **ativado** | Fica `ATIVO` | Nova versão que o supera, ou `esquecer`; a versão anterior continua na trilha (`SUPERADO`) |
| Fonte mudou depois | `resumos_com_fonte_alterada()` lista | Recompactar (nova versão) |
| Memória estourando o pacote | O motor segue **sem memória** e registra `PACOTE_EXCEDE_LIMITE` | Reduzir orçamento |
| Erro ao montar memória | `_anexar_memoria` captura e segue sem memória | Corrigir e repetir; a execução não é perdida |
| Dois compactadores ao mesmo tempo | O segundo falha com `MEMORIA_BASE_DESATUALIZADA` (40001) | Refazer sobre a versão nova |
| Reexecução da mesma compactação | A chave de idempotência devolve a mesma linha | — |
| Vazamento suspeito de escopo | A leitura recusa contexto incoerente; o teste de paridade acusa divergência | Desligar `fonte_memoria` (padrão), esquecer os itens |
| **Rollback geral** | Basta **não passar** `fonte_memoria` ao `Motor` (é o padrão): o motor volta ao comportamento atual. As tabelas só acrescentam e podem ficar vazias |

---

## 13. O que foi construído nesta entrega

| Peça | Arquivo | Estado |
|---|---|---|
| Este desenho | `docs/manual/memoria-dos-agentes.md` | pronto |
| Rascunho de migration (4 tabelas, 18 funções, RLS, grants, constraints, `tsvector` + GIN; vetor só comentado) | `docs/propostas/0027_memoria_agentes.sql` | **NÃO APLICADO**; **validado em PostgreSQL 16 local descartável** (32 testes) |
| Montagem do bloco, escopo, conferência de resumo, truncagem, recuperação com fake, top-K, orçamento | `motor/orquestrador/orquestrador/memoria.py` | pronto; **desligado** |
| Parâmetro `fonte_memoria` (padrão `None`; recusado em produção) | `motor/orquestrador/orquestrador/motor.py` | **desligado** |
| Testes sem banco | `motor/orquestrador/testes/test_memoria.py` | 48 testes (inclui 3 do gancho no Motor, com dublê) |
| Testes do SQL em banco descartável | `motor/orquestrador/testes/test_memoria_sql_rascunho.py` | 32 testes |

O que **não** foi feito, de propósito: aplicar a 0027; copiar SQL para `supabase/migrations-v2/`; consultar o Supabase real ou a VPS; criar o serviço `SRV-MEMORIA`; escrever o leitor que chama `ler_memoria_execucao`/`buscar_memoria`; ligar o parâmetro no `Motor` de produção; chamada paga a modelo.

Para ligar no futuro (nesta ordem, cada passo com sua autorização): (1) você autoriza a 0027 após revisão; (2) migration aplicada com guardas e leitura de volta; (3) leitor de memória + indexador (código revisado); (4) serviço de compactação e placar do revisor; (5) card de prova com `fonte_memoria` em modo de teste; (6) medir custo; (7) só então discutir remover a trava do modo de produção.

---

## 14. Quadro final: JÁ EXISTE / PARCIAL / AUSENTE / NÃO CONFIRMADO

| Item | Estado |
|---|---|
| Banco como fonte da verdade, histórico só-acrescenta, resposta gravada antes de limpar | **JÁ EXISTE** |
| Perfil Hermes 0.19.0 descartável, memória e compressão desligadas, detecção de `MEMORIA_ESCRITA` | **JÁ EXISTE** |
| Checkpoint versionado + decisões vigentes + escopo por empresa nas decisões | **JÁ EXISTE** |
| Medição de tokens reais por execução (`uso.json`) | **JÁ EXISTE** (consolidação por tarefa não comprovada) |
| Teto de tamanho do pacote do autor | **AUSENTE** (só a triagem tem 60 000 bytes); o orçamento de memória o respeita |
| Resumo do card / agente×empresa / fundador versionados | **AUSENTE** (proposta e código prontos, não aplicados) |
| Busca textual em português com filtro de escopo | **AUSENTE** (proposta e código prontos, não aplicados) |
| Serviço de compactação do time + placar do revisor de memória | **AUSENTE** |
| Registro de uso de memória por execução | **AUSENTE** (proposta) |
| Ligação ao motor | **PARCIAL**: parâmetro desligado e recusado em produção |
| pgvector no projeto | **NÃO CONFIRMADO** |
| Memória do Hermes 0.15.1 (formato, limite, tamanho) | **NÃO CONFIRMADO** |
| Identificação de card pessoal no banco | **NÃO CONFIRMADO** |
| Custo real de tokens com memória | **NÃO MEDIDO** |
| Hermes 0.19.0 lendo o login estável do ChatGPT dentro de um card | **NÃO CONFIRMADO** (risco já registrado em `como-a-fabrica-funciona.md`) |

---

## 15. Decisões para o fundador

Cada uma com a minha recomendação. Nenhuma foi tomada por mim.

1. **D1 — Supabase como única memória oficial.** Recomendo **sim**. Telegram e Hermes ficam como canal e operador.
2. **D2 — Hermes 0.15.1 do Telegram.** Recomendo **manter a memória de conversa dele, sem valor oficial**, e autorizar a verificação em modo leitura da seção 10 (e, se quiser, incluí-la no `inventario.sh`). Não apagar nada sem backup recuperável.
3. **D3 — Busca por vetores (pgvector).** Recomendo **não agora**: começar só com busca de texto em português. Só decidir depois de (a) confirmar a extensão no projeto, (b) escolher o modelo de embedding, (c) aprovar custo e o envio de texto ao provedor.
4. **D4 — Orçamento da memória por execução.** Recomendo **12 000 caracteres, K=5 trechos, só para o autor** (revisor e validador sem memória), subindo só depois de medir.
5. **D5 — Quem compacta.** Recomendo começar pela **Fase A (código, sem IA)** e só depois criar o serviço de compactação do time. Sugestão: Olívia (autora), Daniel (revisor), Helena (reserva), com placar do revisor antes de valer. Criar o serviço exige mudar `servicos.yaml`, a ficha e o validador — fora deste pacote.
6. **D6 — Gatilho da compactação com IA.** Recomendo **somente com a sua ordem** (card de manutenção), porque gasta cota e a vaga única.
7. **D7 — Prazos de validade.** Sugestão: card 90 dias; agente×empresa 180 dias renovável; fundador sem prazo (revisável); pessoal até você revogar. Quer outros?
8. **D8 — Memória pessoal da Laura.** Existe ou não? Recomendo **desligada por padrão**, e definir antes como um card pessoal é identificado (hoje assumi `empresa` nula; NÃO CONFIRMADO).
9. **D9 — "Memória de ofício" do agente (lições independentes da empresa).** Recomendo **não ter**: é exatamente onde o dado de uma empresa escorre para outra.
10. **D10 — Seu "sim" por item no escopo FUNDADOR/PESSOAL.** Recomendo **exigir** (já é a regra do rascunho).
11. **D11 — Ponte Telegram → Supabase.** Recomendo **só `/pedido` e decisões confirmadas**; conversa livre nunca vira memória oficial.
12. **D12 — Aplicar a 0027.** Pede a sua autorização explícita, depois de revisada; nada foi aplicado.
13. **D13 — Ligar `fonte_memoria`.** Recomendo um **card de prova em modo de teste** antes de qualquer produção; a trava do modo de produção só sai por mudança de código revisada.
14. **D14 — Personagens eLiving™** (Sirlene, Doutor Vital, Alex, Rafael) **não são agentes**: não têm memória própria; o que for da marca continua sendo fonte (pacote da empresa), não memória.
