# Plano: todas as mensagens do WhatsApp em fonte única e no padrão premium

Versão 1, de 06/10/2026. Base: o catálogo `docs/whatsapp/CATALOGO_MENSAGENS_WHATSAPP_20261006.md` (351 registros, 51 lugares) e o padrão `docs/whatsapp/PADRAO_PREMIUM_WHATSAPP.md`.

As decisões abaixo já estão tomadas e registradas (regra do AGENTS.md). O que mexe em produção fica preparado e só roda com o OK do dono: SQL no Supabase de produção, deploy de Edge Function, `git push` e merge na `main`.

---

## 1. Decisões

1. **O código é a fonte da verdade do texto.**
   - Cada fluxo tem um módulo de mensagens em `supabase/functions/_shared/whatsapp/mensagens/`, coberto por testes.
   - Handler, cron e worker não escrevem texto; eles chamam o módulo.
2. **A foto do prato não é duplicada.**
   - O módulo dela é `_shared/whatsapp/foto-prato-mensagens.ts`, cuidado por outra frente.
   - Este plano só o importa, por exemplo `primeiroNome`, `NBSP`, `ASSINATURA` e `LIMITE_CARACTERES`, e não reescreve nada dele.
   - A ligação no webhook, no worker e na fila de reserva também é da outra frente.
3. **A tabela `whatsapp_message_templates` deixa de fingir que manda.**
   - Hoje ela não é lida (G1) e o Admin edita um texto que não chega ao aluno.
   - Ela vira espelho somente leitura do código: um script gera as linhas a partir dos módulos.
   - O Admin passa a mostrar "Catálogo de mensagens (somente leitura)" com o id do catálogo.
   - O que o dono pode ajustar no Admin são as **regras** (regra permanente "tudo ajustável no Admin"):
     - limite de caracteres;
     - aviso de demora em segundos;
     - aberturas ligadas;
     - prazo de análise exibido;
     - liga e desliga de cada mensagem proativa.
   - Edição de **texto** pelo Admin fica para a fase 2. Só vale com validação dos mesmos guardiões no salvamento, numa Edge com `requireAdmin`. Sem isso, um texto editado no painel furaria o padrão.
4. **Assinatura vem de um só lugar.**
   - `signatureFor()` em `_shared/agents/registry.ts` passa a devolver `_Sirlene · eLiving_`, `_Dr. Vital · eLiving_`, `_Rafael · eLiving_` e `_Alex · eLiving_`. Hoje devolve `_Sirlene 💚_` e similares.
   - `cron-signature.ts` continua reconhecendo as assinaturas antigas, inclusive "Sofia" e "MaxNutrition", para limpar mensagens antigas na fila. Isso é intencional e não é marca visível.
5. **O dono de cada assunto segue o registry** (G8):
   - Sirlene: comida, água e peso;
   - Dr. Vital: exame e remédio;
   - Alex: treino e exercício;
   - Rafael: hábitos, sono, humor, missões, metas, motivação, celebração e sabotadores.
   - As mensagens de exercício assinadas pelo Dr. Vital e as de sono assinadas pela Sirlene mudam de dono no lote do fluxo delas.
6. **Mensagem sem chamador é apagada, não migrada.** O lote 10 trata disso.

---

## 2. Estrutura dos módulos

```
supabase/functions/_shared/whatsapp/
  foto-prato-mensagens.ts        (já existe, WT, outra frente: não duplicar)
  laudo-protegido.ts             (já existe, WT: vira a base de exames.ts para o laudo)
  marketing-consent.ts           (já existe: só ajustar o texto)
  numbered-options.ts            (reaproveitar formatBoldChoices)
  gender-utils.ts                (reaproveitar getGenderedTerms / isFeminine)
  text-format.ts                 (rede de segurança; tirar a conversão de --- em régua)
  mensagens/
    comum.ts           assinatura(personagem), numero(), unidade(), data(), titulo(), montar()
                       - reexporta primeiroNome/NBSP/LIMITE_CARACTERES de foto-prato-mensagens.ts
    boas-vindas.ts     bv.* , conv.* , menu.*                 (catálogo §2)
    alimentacao.ts     alim.texto.*, alim.audio.*, alim.video.*, foto.galeria.*, nutri.*  (§3, fora a foto)
    acompanhamento.ts  agua.*, sono.*, humor.*, exercicio.*, peso.*, nutri.resumo_dia     (§4)
    exames.ts          exame.*                                 (§5)
    missoes.ts         missao.*, meta.*, motivacao.*, lembrete.*, celebracao.*            (§6)
    relatorios.ts      relatorio.*, sabotadores.*, habitos.*    (§7)
    erros.ts           erro.* comuns a todos os fluxos         (§9)
    catalogo.ts        lista { id, fluxo, personagem, gatilho, montar(exemplo) } de TODAS
                       (alimenta os testes guardiões, o espelho do banco e o Admin)
    __tests__/
      padrao-premium.test.ts
      catalogo-completo.test.ts
```

**Regras dos módulos:**
- Cada função recebe dados, como `{ nome, genero, ... }`, e devolve a string final.
- Nenhuma função lê o banco nem chama a rede.
- As funções com opções devolvem `{ texto, opcoes }`, para que o handler grave o mapeamento em `whatsapp_user_state`.
- As aberturas variadas usam o mesmo `indiceAbertura` da foto do prato, sem repetir a anterior.

**Worker da VPS:** `WhatsAppCallback.ts` usa cópias de runtime em `vps-backend/src/ai-worker/src/utils/` (`exames.ts` e a cópia da foto que já existe). Um teste de igualdade compara cópia e original, como já é feito com `fotoPratoMensagens.ts`.

**Prompts da IA:** `whatsapp-ai-assistant` passa a montar a assinatura e as regras de formato a partir de `mensagens/comum.ts` e do padrão. Muda o seguinte:
- sai "SEMPRE pareça humana", o nome do modelo de IA e a regra de "home Hoje";
- entram as proibições do padrão e o primeiro nome;
- a resposta da IA passa por um validador leve antes do envio: troca `**`, tira régua, corta a assinatura duplicada e acrescenta a assinatura certa.

---

## 3. Testes guardiões

| Teste | O que barra | Onde |
|---|---|---|
| `mensagens/__tests__/padrao-premium.test.ts` | Para cada item de `catalogo.ts`, com dados de exemplo e o pior caso (nome composto longo, gênero ausente, números com decimal, lista longa): `**`; régua (`━`, `─{3,}`, linha `---`); mais de 1.000 caracteres; ausência da assinatura do personagem dono, ou mais de uma assinatura; "Usuário"; sobrenome do exemplo; `\d\.\d` em número exibido; número colado na unidade (`\d(g\|ml\|kg\|kcal\|L)\b`); mais de 3 emojis; ❌ ou 🚨 em rótulo de opção; `1. ` como opção; "clique" e "toque"; frases de culpa (lista do padrão, seção 10); promessas de lembrete (lista do padrão, seção 9) | novo |
| `_shared/__tests__/brand-visible-text.test.ts` | Estende o atual: `maxnutrition.` em URL, "MaxChef", "Max Nutrition", "Instituto dos Sonhos", "Sofia", "coach" em qualquer texto de `mensagens/*` e nos arquivos ainda não migrados, com lista de exceções que só diminui (catraca) | existe |
| `mensagens/__tests__/catalogo-completo.test.ts` | Todo id do catálogo existe em `catalogo.ts`, e os ids marcados como apagados não existem mais | novo |
| `vps-backend/.../__tests__/mensagens-copia.test.ts` | A cópia do worker é idêntica ao módulo | novo |
| `whatsapp-send-interactive` (teste de unidade) | Quando chamado pelo webhook, em resposta, o envio sai com `kind:'reply'` (corrige G15) | novo |
| `numbered-options.test.ts` | O `formatBoldChoices` gera `*1*  Rótulo` e o mapeamento | existe, estender |
| `text-format.test.ts` | `---` não vira régua | existe, estender |

**Catraca de varredura:** um teste lê os 51 lugares do catálogo e conta as ocorrências de régua, `**`, assinatura antiga e marca. O número máximo de cada uma fica gravado no teste e só pode cair. Cada lote baixa esse teto.

---

## 4. Ordem de execução (lotes por fluxo)

Os números vêm do catálogo: são as mensagens de código de cada fluxo, sem contar banco nem o módulo novo. Cada lote termina com `npm run build`, Vitest, os testes Deno das Edge e uma captura da conversa em ensaio (texto renderizado no simulador de WhatsApp do Admin ou num print do envio de teste), com commit local na `release/eliving-producao`.

| Lote | Escopo | Mensagens | Produção? |
|---|---|---|---|
| **L0 Fundação** | `mensagens/comum.ts` e `catalogo.ts` vazio; `signatureFor` com as assinaturas novas; guardiões em modo catraca; correção do G15 (`kind:'reply'` nas respostas do `whatsapp-send-interactive` chamadas pelo webhook); `text-format` deixa de transformar `---` em régua | 0 novas (destrava todas) | não (deploy só com OK) |
| **L1 Marca no código** | as trocas da seção 5.1 | 4 locais | não |
| **L2 Foto do prato** | outra frente: ligar `foto-prato-mensagens.ts` no webhook, no worker e na fila (substitui #50 a #87 da foto por #132 a #140). Este plano só confere os guardiões | cerca de 38 substituídas por 9 | deploy com OK |
| **L3 Boas-vindas, conversa e menus** | um só convite ao visitante (junta #1, #2 e #3); `instant-responses.ts` fica só com os padrões de reconhecimento e os textos vão para `boas-vindas.ts`; nome do aluno nas respostas instantâneas (passar `userName`, já carregado); menus e ajuda sem "clique"; `bv.telefone_varias_contas` no padrão; decidir o gatilho do `whatsapp-welcome` (o código fica pronto; ligar o envio proativo é decisão do dono) | 31 | deploy com OK |
| **L4 Exames** | sequência foto → lote → tipo → senha → laudo no padrão; numeração única 1, 2 e 3 (webhook, texto de reserva e cron); senha nunca junto do link (WC, `send-whatsapp-report`, cache); PDF com texto próprio sem senha; prazo único; botão "Perguntar" com resposta; uma assinatura do Dr. Vital; prompt do Dr. Vital sem "médico especialista"; alerta crítico calmo (decisão de produto à parte) | 38 | deploy com OK, inclusive do worker na VPS |
| **L5 Erros, texto livre, áudio, vídeo e galeria** | `erros.ts` comum; "Não registrei nada"; fim da falsa promessa de AI:973; vídeo com opção real ou aviso honesto; galeria assinada pelo dono certo (sem o "Rafael 🏃" fixo) | cerca de 30 (parte de §3 e §9) | deploy com OK |
| **L6 Acompanhamento** | água, sono, humor, exercício e peso no padrão e com dono certo; conserto do G3 (`templateType`) e do G10 (leitor de `awaiting_weight` e do horário de acordar); meta do aluno no lugar de 2.500 fixo; vírgula decimal; tirar "vou te lembrar" | 46 | deploy com OK |
| **L7 Missões, motivação e celebração** | Rafael como dono; XP coerente (um número só, vindo do sender); rótulos únicos para as 7 perguntas; tirar "você receberá às 9h" enquanto o proativo estiver desligado; `Math.abs` do peso; SVG válido como imagem | 42 | deploy com OK |
| **L8 Relatórios** | uma voz por relatório; até 1.000 caracteres com o resto no app; corrigir "Dr. Vita"; score sem base; déficit calórico invertido; `nutrition-daily-summary` passa pelo `evolution-sender`; autenticação em `whatsapp-generate-template` | 13 (mais o resumo do dia do L6) | deploy com OK |
| **L9 Banco** | as 83 linhas viram espelho gerado de `catalogo.ts` (`scripts/sync-whatsapp-templates.mjs` gera o SQL); as linhas sem par no catálogo ficam `is_active=false`; o Admin mostra o catálogo somente leitura. Ensaio com `BEGIN … ROLLBACK` | 83 linhas (67 com "Sofia" e 5 com "MaxNutrition") | **sim: SQL só com OK do dono** |
| **L10 Limpeza** | apagar código sem chamador: `button-handler.ts` legado (fora o que o webhook importa), `createSofia*`, `createErrorMessage`, `fallback-responses.ts`, `guest-onboarding-service.ts`, `whatsapp-interactive-sender.ts`, `post-analysis-flows.ts`, `template-processor.ts`, `whatsapp-command-router`, decidir sobre `vps-backend/src/routes/whatsapp.js` (antes conferir a URL do webhook na Evolution) | cerca de 32 mortas e 7 do router | deploy com OK |

**Por que nesta ordem:**
- L0 e L1 são baratos e tiram a marca antiga visível.
- L2 a L5 cobrem o que o aluno recebe hoje: foto, conversa, exame e erros.
- L6 a L8 mexem em mensagens hoje desligadas, barradas ou quebradas.
- L9 e L10 só fazem sentido com o código pronto.

---

## 5. Lista exata de trocas de marca

### 5.1 Código local (sem produção; vai no L1)

| # | Arquivo:linha | Texto atual | Texto novo | Observação |
|---|---|---|---|---|
| 1 | `supabase/functions/send-meal-plan-whatsapp/index.ts:129` | `👉 https://maxnutrition.app/sirlene-nutricional?tab=meudia` | `👉 https://app.eliving.com.br/sirlene?tab=meudia` | `/sirlene-nutricional` só redireciona para `/sirlene` (`src/App.tsx:222`), então o link novo vai direto. Na linha 131, `_Sirlene Nutricional • eLiving Private Health_` vira `_Sirlene · eLiving_` (padrão). |
| 2 | `supabase/functions/whatsapp-nutrition-webhook/handlers/button-handler.ts:2461` | `https://maxnutrition.com.br/relatorio/${pendingMedical.public_link_token}` | apagar o trecho (L10) | É código morto. Trocar só o domínio reabriria um link `/relatorio/` sem proteção, que os testes `whatsappLaudoProtegido.test.ts` e `SendExamWhatsAppModal.b10` proíbem. Se o L10 atrasar, trocar pelo link protegido de `laudo-protegido.ts`, nunca por `app.eliving.com.br/relatorio/`. |
| 3 | `supabase/functions/finalize-medical-document/index.ts:797` | `<span>www.maxnutrition.com.br</span>` | `<span>www.eliving.com.br</span>` | Rodapé da página do laudo. O WT já trocou a outra ocorrência (HEAD:782). |
| 4 | `supabase/functions/whatsapp-command-router/handlers/nutrition-handler.ts:322` e `:380` | `` `2️⃣ Vá em "MaxChef"\n` `` | apagar com o router (L10); se ficar, `` `2️⃣ Vá em "Cardápio"\n` `` | O router não está no fluxo ao vivo. |
| 5 | `src/components/admin/whatsapp/EvolutionProcessStatus.tsx:84` | `'Análise de Pratos Sirlene & MaxChef'` | `'Análise de pratos e cardápio (Sirlene)'` | Visível só para o admin. |
| 6 | Rótulo "Instância: maxnutrition" no painel (`WhatsAppBroadcast`, `WhatsAppDashboard`, `WhatsAppConfig`, `EvolutionConnectionCard`, `WhapiConfigPanel`, `EvolutionProcessStatus:129`, `evolutionAdmin.ts:34`) | `maxnutrition` exibido como nome | rótulo "Instância do WhatsApp (identificador técnico)" mantendo o valor | **Não renomear a instância.** Renomear desconecta o chip. |
| 7 | `src/components/admin/whatsapp/EvolutionConnectionCard.tsx:51` e `WhapiConfigPanel.tsx:47` | `Olá! Este é um teste da Sirlene IA / eLiving via Evolution API.` | `Teste de conexão do eLiving pelo WhatsApp.⏎⏎_eLiving_` | Mensagem de teste do admin. |
| 8 | `supabase/functions/n8n-weekly-whatsapp-report/index.ts:178` | `DR. VITA` (duas vezes) | `Dr. Vital` | Nome errado, não marca. Vai no L8 se o lote L1 não pegar. |

**Não trocar** (identificador técnico; quebraria envio, login ou cobrança):
- `evolutionInstance: 'maxnutrition'` (`infra-config.ts:8`, `whatsapp.js:19`, `AIWorker.ts:541`, `WhatsAppCallback.ts:196`);
- domínios antigos do CORS (`_shared/cors.ts:10-14`, `google-fit-token:16-21`);
- `com.maxnutrition.app` (Google Fit);
- `source: 'instituto-dos-sonhos-maxnutrition'`;
- SKUs `MAX-*` da AppMax;
- regex legada de `cron-signature.ts`;
- `User-Agent` técnico;
- `['OK','MAX','OI']` da pronúncia;
- nomes de pasta e tabela com "coach" ou "sofia_".

Os logs internos ("MaxNutrition AI") só mudam quando o arquivo for mexido por outro motivo.

### 5.2 Dado de produção (banco; só com OK do dono)

Há 5 linhas com "MaxNutrition". O SQL abaixo troca **uma linha por vez**, com o texto antigo exato no `WHERE`. Cada troca exige que exatamente uma linha mude e, no fim, confere que não sobrou nenhuma ocorrência. Está como **ensaio** (`ROLLBACK`). Para aplicar, o dono troca a última linha por `COMMIT;` e roda no SQL Editor do projeto `imvfmjgmacrulhztrqlh`. Nunca usar `supabase db push`.

```sql
-- whatsapp_message_templates: tirar "MaxNutrition" (5 linhas). ENSAIO: termina em ROLLBACK.
BEGIN;

DO $$
DECLARE n int;
BEGIN
  UPDATE public.whatsapp_message_templates
     SET footer_text = '🌿 Sirlene · eLiving', updated_at = now()
   WHERE template_key = 'welcome_message' AND footer_text = '🌿 Sofia - MaxNutrition';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'welcome_message: esperado 1, alterou %', n; END IF;

  UPDATE public.whatsapp_message_templates
     SET footer_text = '🌿 Sirlene · eLiving', updated_at = now()
   WHERE template_key = 'help_menu' AND footer_text = '🌿 Sofia - MaxNutrition';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'help_menu: esperado 1, alterou %', n; END IF;

  UPDATE public.whatsapp_message_templates
     SET body_text = replace(body_text, '*Olá! Bem-vindo ao MaxNutrition!*', '*Olá! Bem-vindo ao eLiving!*'), updated_at = now()
   WHERE template_key = 'faq_greeting_oi' AND body_text LIKE '%*Olá! Bem-vindo ao MaxNutrition!*%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'faq_greeting_oi: esperado 1, alterou %', n; END IF;

  UPDATE public.whatsapp_message_templates
     SET body_text = replace(body_text, '*Como funciona o MaxNutrition:*', '*Como funciona o eLiving:*'), updated_at = now()
   WHERE template_key = 'faq_how_it_works' AND body_text LIKE '%*Como funciona o MaxNutrition:*%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'faq_how_it_works: esperado 1, alterou %', n; END IF;

  UPDATE public.whatsapp_message_templates
     SET body_text = replace(body_text, 'crie sua conta gratuita no MaxNutrition!', 'crie sua conta gratuita no eLiving!'), updated_at = now()
   WHERE template_key = 'guest_demo_result' AND body_text LIKE '%crie sua conta gratuita no MaxNutrition!%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'guest_demo_result: esperado 1, alterou %', n; END IF;

  SELECT count(*) INTO n
    FROM public.whatsapp_message_templates
   WHERE concat_ws(' ', name, description, header_text, body_text, footer_text, buttons::text, list_sections::text) ILIKE '%maxnutrition%';
  IF n <> 0 THEN RAISE EXCEPTION 'ainda há % linha(s) com MaxNutrition', n; END IF;
END $$;

ROLLBACK;  -- ensaio. Para aplicar: trocar por COMMIT; (só com OK do dono)
```

**"Sofia" nas 67 linhas restantes.** Não há SQL de troca linha a linha. Três motivos:
1. As linhas não chegam ao aluno (G1).
2. A regra de 06/10 proíbe troca em massa.
3. O texto inteiro delas também está fora do padrão: rodapé "🌿 Sofia", "_Sofia 💚_", régua, `{{userName}}` com nome completo.

O L9 substitui as 83 linhas pelo espelho gerado do código, revisado id por id no catálogo. O SQL do L9 terá a mesma trava:
- `BEGIN`;
- uma instrução por `template_key`, com o texto antigo no `WHERE`;
- contagem final de "Sofia" e "MaxNutrition" igual a zero;
- `ROLLBACK` no ensaio.

Ele será gerado por `scripts/sync-whatsapp-templates.mjs` e testado antes em PGlite.

---

## 6. Riscos e pontos para o dono decidir (o código fica pronto antes)

1. **Ligar o envio proativo.** São dois interruptores: `WHATSAPP_PROACTIVE_REMINDERS` e `EVOLUTION_ALLOW_UNSOLICITED`. Hoje lembretes, relatórios, celebrações e a boas-vindas de cadastro não saem. As mensagens ficam prontas no padrão, mas ligar é decisão do dono, por causa do custo e do risco de bloqueio do chip.
2. **URL do webhook na Evolution.** Pode apontar para a Edge `whatsapp-webhook-unified` ou para a VPS `/whatsapp/webhook`. Precisa ser conferida antes de apagar `vps-backend/src/routes/whatsapp.js` (o L10 não o apagou: ver seção 13).
3. **Fila `drain-evolution-queue` pausada** (migração `20261003221959`). Respostas que caem na fila podem não sair até a conta do Vault ser reconciliada.
4. **Alerta de valor crítico em exame** não existe hoje. Criar é decisão de produto e clínica. Se for criado, segue a seção 10 do padrão.

---

## 7. Estimativa total

| Item | Quantidade |
|---|---|
| Mensagens de código a migrar para módulos (L3 a L8, sem a foto) | cerca de 200 |
| Mensagens da foto substituídas pelo módulo premium (L2, outra frente) | cerca de 38, que viram 9 |
| Mensagens mortas a apagar (L10) | cerca de 39 |
| Linhas do banco a virar espelho (L9) | 83 |
| Trocas de marca no código (L1) | 4 trocas para o aluno, 3 para o admin e 1 nome errado ("Dr. Vita") |
| Trocas de marca no banco (SQL pronto acima) | 5 linhas |

---

## 8. Registro do L5 (erros, texto livre, áudio, vídeo e galeria), 06/10/2026

Código pronto no working tree, sem commit e sem deploy. Módulos novos em `supabase/functions/_shared/whatsapp/mensagens/`:
- `erros.ts`: erros comuns a todos os fluxos;
- `alimentacao.ts`: texto livre, áudio, vídeo, galeria e cardápio;
- `compartilhar.ts`: o que o app monta para o aluno enviar por `wa.me` (o app o importa direto).

Decisões tomadas (registradas por regra do AGENTS.md):
1. **"Não registrei nada" só onde é verdade.** A IA falhou antes de gravar, o áudio sem transcrição e o erro ao carregar o áudio dizem a frase. A exceção solta do texto e a falha geral da IA só dizem que houve uma oscilação, porque não dá para saber o que já foi gravado.
2. **Fim da falsa promessa de AI:973.** O "Já estou guardando os dados" saiu. A reserva da refeição diz que nada foi registrado. As demais reservas (saudação, agradecimento, despedida, confirmação, ajuda) reaproveitam as respostas de conversa do L3. O texto desconhecido diz a verdade (oscilação) em vez de fingir que respondeu.
3. **A contingência do assistente lê o resultado das ferramentas.** `situacaoDasAcoes` separa feita, não salvou e só uma parte. Acabou o "Anotei aqui" vago.
4. **Refeição por texto.** Quando a IA grava uma só refeição, a mensagem vem pronta do módulo (número em pt-BR, `≈`, "Estimativa pela sua descrição"), sem a IA reescrever e sem macro inventado. Se não deu para separar os alimentos, o texto diz que é uma estimativa geral e oferece a foto do prato. Os valores de reserva gravados no diário (250 e 300 kcal) continuam como estavam: mudar o que é gravado é decisão do dono.
5. **Vídeo: aviso honesto.** Vídeo não é analisado e o texto diz isso, sem a pergunta sem opção de resposta. Quem guarda ou deixa de guardar o vídeo é a frente de mídia (o catálogo de mídia manda não guardar): o texto não promete nem nega o armazenamento.
6. **A galeria é do Alex.** A galeria de atividades e memórias de treino (`activity_results`) fala como Alex em todas as telas. Sem conta, o aviso é do eLiving. As opções 1, 2 e 3 agora gravam o mapeamento em `whatsapp_user_state` (antes, a resposta "1" caía na IA).
7. **Botões do cardápio.** O cardápio, a receita e a lista de compras de exemplo, iguais para todos, saíram. Cada botão responde com a verdade (o plano de verdade está no app) e leva à tela certa: `/sirlene?tab=meudia`, `/sirlene?tab=receita` e `/mercado`. O botão `meal_accept` diz que não salvou nada.
8. **Dono por variante.** `MensagemCatalogo.personagensPorVariante` deixa um mesmo id ter dois donos (`erro.ia_indisponivel`: Sirlene e Alex). O `formato: 'compartilhado'` cobre as falas do próprio aluno (convite e "Oi Sirlene"), sem assinatura de personagem.
9. **As linhas do banco ficam com o L9.** `erro.banco.*` (9) e `alim.banco.*` (16) não entram agora, porque o robô não as lê.

Catraca depois do L5: `TETO_DE_PENDENTES` de 246 para 221; régua de 20 para 16; assinatura antiga de 283 para 261. O negrito duplo segue em 19.


---

## 9. Registro do L6 (acompanhamento: água, sono, humor, exercício, peso, lembrete de refeição e resumo do dia), 06/10/2026

Código pronto no working tree, sem commit e sem deploy. Módulo novo em `supabase/functions/_shared/whatsapp/mensagens/acompanhamento.ts` (45 ids do catálogo, §4, ids 141 a 186, menos o 176 `saude.lembrete_medicacao`, que é MORTO e sai no L10).

Decisões tomadas (registradas por regra do AGENTS.md):
1. **Dono certo.** Sirlene: comida, água e peso. Rafael: sono e humor (como hábito). Alex: exercício. Antes sono, humor, exercício e peso saíam assinados pelo Dr. Vital.
2. **Meta do aluno, nunca fixa.** A água usa `profiles.daily_water_goal` (e `water_goal_ml` no agendador) por `metaDeAgua()`; sem meta a mensagem mostra só o total. A meta de sono só aparece se for a do aluno. O resumo do dia deixou de usar 2.000 kcal e 2.000 ml. Meta batida não vira "100%" (o padrão proíbe número que parece garantia): diz "Você chegou à sua meta de hoje".
3. **G3 (templateType).** O webhook mandava `template` para o `whatsapp-send-interactive`, que exigia `templateType` e recusava. `sendInteractiveTemplate` agora envia o texto como resposta e grava o mapeamento das opções (`registerActiveButtonState`). Os modelos de `interactive-templates.ts` viraram invólucros finos do módulo: texto pronto, sem cabeçalho, sem rodapé e sem botão antigo, com `opcoes` (id e rótulo, na ordem).
4. **G2 nos outros remetentes.** `opcoes-estado.ts` (novo) grava o mesmo estado `awaiting_button_selection` para o `whatsapp-send-interactive`, o agendador e os lembretes inteligentes. A resposta "1" deixa de cair na IA.
5. **G10 (leitores).**
   - Peso: `startWeighing` grava `awaiting_weight` com `state_data` e `onConflict: 'user_id,state'` (antes: coluna `context` e `onConflict: 'user_id'`, que nunca gravavam). `processWeightText` lê "72,5" ou "72.5", grava em `user_measurements` e pede a cintura; `processWaistText` e `skipWaist` fecham a pesagem com a variação neutra.
   - Hora de acordar: "Vou dormir agora" e o "Bom dia" do agendador gravam `awaiting_wake_time`. `processWakeTimeText` lê "6h30" ou "7 da manhã", calcula a noite no relógio de São Paulo (hora que ainda não chegou conta como de ontem; a conta tem de fechar uma noite possível) e pergunta a qualidade.
   - O estado "aguardando" nunca sequestra uma conversa qualquer: `respostaCombinaComEstado` só intercepta o que parece a resposta ("almocei às 12h" não é a hora de acordar), uma resposta de uma casa ("1", "2") segue para o mapeamento das opções e o estado vence (30 min para peso, cintura, treino e nota; 18 h para a hora de acordar).
6. **Hora de São Paulo.** `getHours()` no servidor (UTC) mostrava "2h30" para quem foi dormir às 23h30. `hora()` (novo em `comum.ts`) e `diaDeSaoPaulo()` resolvem; a IA de texto livre também passou a datar água e peso no dia de São Paulo.
7. **Sem promessa de lembrete.** Saíram "Vou te lembrar novamente em breve", "Vou te lembrar amanhã", "Vou te lembrar mais tarde" e "Amanhã te pergunto que horas acordou". Sem lembrete, o texto diz como registrar quando o aluno quiser.
8. **Tom sem culpa.** Saíram "Pior noite", "Vamos ajustar a estratégia?", "Você está assim há N dias seguidos", "Seu objetivo vale muito mais que 2 minutos de doce", "Há N dias", "Lembre-se de me contar", os 🔴/🟡/⚠️/😔 e as afirmações fisiológicas ("queima de gordura", "acalma o cortisol", "400 a 500 ml", "7 a 8 horas"). Humor baixo por três vezes seguidas ganha uma frase gentil sobre conversar com alguém de confiança ou com um profissional.
9. **Peso e privacidade.** O lembrete de peso convida e não expõe o número nem a cintura. A variação é neutra ("−0,8 kg desde 05/10"), sem "ganhou" nem "perdeu".
10. **Ids que viraram o mesmo texto de outro.** Três lembretes de água (`agua.lembrete`, `agua.lembrete_smart`, `agua.lembrete_vps`), dois de peso (`peso.lembrete_semanal`, `peso.lembrete_smart`) e dois check-ins de humor (`humor.checkin`, `humor.checkin_diario`) mantêm o id no catálogo, mas renderizam a mesma função. `humor.sem_registro` (a nota sem humor para juntar) é variante de `humor.nota_registrada`, sem id próprio.
11. **Botões que não tinham resposta.** "Dicas de sono", "Ver semana" do sono, "Ideias para me movimentar" e "Ver semana" do exercício caíam em "ação desconhecida" ou na ajuda. Agora respondem. O "Sim, fiz" pergunta a intensidade (antes pulava direto para a duração) e o "Pular a cintura" é novo. `sleep_view_week` saiu do grupo que só abria a ajuda.
12. **A água depois do treino é a segunda mensagem.** Antes ela substituía a confirmação do treino e o aluno nunca via que o exercício foi registrado.
13. **IA de texto livre.** "Bebi 500 ml" e "peso 72" saem prontos do módulo (a IA não reescreve). A água passou a usar a soma atômica `log_water_intake_atomic`, a mesma do botão (o ler-somar-gravar de antes perdia água quando duas mensagens chegavam juntas).
14. **Resumo do dia (NDS).** Sem saldo calórico: o "déficit" estava invertido e elogiava o que não devia. Totais com "≈" e a nota "Estimativas pelas fotos e descrições". O envio direto por `fetch` (fora do guarda) fica com o L8.
15. **VPS.** Os modelos `waterReminder` e `weightReminder` do cron (desligado) seguem o mesmo texto, sem meta fixa, sem peso e sem opções que a VPS não mapeia. O resto de `routes/whatsapp.js` e `routes/tracking.js` fica com o L10.

Corrigido de passagem (mesma classe de erro): `titulo()` colapsava o espaço sem quebra ("250 ml" virava "250 ml" com espaço comum e quebrava a regra número + unidade); as linhas de estado de humor e exercício usavam `upsert` sem `onConflict` (a segunda gravação falhava e a intensidade antiga ficava); o `exercise_yes` do botão antigo marcava "leve" sem perguntar.

Também corrigido do L4: o botão "Perguntar" do exame gravava o estado na coluna `context`, que a tabela `whatsapp_user_state` não tem (ela guarda em `state_data`), e a leitura não filtrava o estado (com mais de uma linha por aluno o `maybeSingle` dava erro). Agora grava e lê `state_data` com `onConflict: 'user_id,state'`, e a dúvida do exame vai de fato ao Dr. Vital.

Catraca depois do L6: `TETO_DE_PENDENTES` de 221 para 178 (43 mensagens); régua 16 (sem mudança); negrito duplo 19 (sem mudança); assinatura antiga de 261 para 242 (modelos de código 24 para 10, botões da nutrição 39 para 38, verificação de refeição e resumo do dia 2 e 2 para 0).


---

## 10. Registro do L7 (missões, motivação e celebração), 06/10/2026

Código pronto no working tree, sem commit e sem deploy. Módulo novo em `supabase/functions/_shared/whatsapp/mensagens/missoes.ts`: 33 ids do catálogo (§6, ids 256 a 267 e 277 a 297), todos do Rafael. As 9 `missao.it.*` (268 a 276) são MORTAS e saem no L10; as 9 linhas do banco (`missao.banco.*`) ficam com o L9.

Decisões tomadas (registradas por regra do AGENTS.md):
1. **Dono Rafael em tudo.** Antes: bom dia, meta, lembretes e celebração saíam como Sirlene; a conclusão das missões como Dr. Vital ("tudo mapeado"); a recusa como "Dr. Vital | Sirlene". O bom dia é do Rafael com ou sem a flag `crons_by_specialist`. As mensagens do módulo já saem assinadas: nada passa por `applyCronSignature`.
2. **Um XP só, o do sender.** As 7 perguntas, os rótulos e o XP moram em `PERGUNTAS_DA_MISSAO` (uma tabela): o envio diário, o tratador (`MISSION_CONFIG` vem de `configuracaoDosBotoes()`) e a conclusão usam a mesma. A conclusão mostra só "Hoje: N XP" (antes: "pontos" e "XP × 1,5", dois números diferentes). `points_earned` e `xp_earned` gravam o mesmo valor. O máximo do dia é 180 (o catálogo já dizia que o real era 180, não 175 nem 200).
3. **Rótulos únicos.** Os três lugares tinham rótulos diferentes ("Pouca (0-1L)" no código, "copos" no banco, ❌ na atividade). Agora: água "Até 1 L", "De 1 a 2 L", "Mais de 2 L"; sono "6 h ou menos", "7 a 8 h", "9 h ou mais"; atividade "Sim, fiz", "Hoje não", "Pular"; e assim por diante. Sem emoji no rótulo (o emoji da pergunta vai no título, porque o conversor do WhatsApp tira o emoji de dentro do negrito). A gratidão é "Pelo que você agradece hoje?" (sem "grato") e o sono é "na última noite" (não "ontem"). Os rótulos do banco (`missao.banco.*`) seguem como estão até o L9.
4. **Sem promessa de envio.** Saíram "Você receberá suas missões diárias às 9h", "Manhã (9h)", "Próxima missão será enviada automaticamente!" e "Dr. Vital mapeou". A preferência de momento é guardada e o texto diz que as missões não chegam sozinhas por aqui enquanto o envio proativo está desligado. Ligar o envio proativo é decisão do dono; quando ligar, a variante "chegam no momento escolhido" entra no módulo.
5. **Nenhuma mensagem manda "digitar missão".** O catálogo (§6.1) dizia que o texto "missão" cai no tratador, mas o `whatsapp-webhook-unified` só trata os botões `mission_*` (a detecção de texto, `detectMissionCommand`, só existe no webhook antigo da nutrição). Então as mensagens apontam para o app e para o botão que o aluno já recebeu. Se o dono quiser o comando de texto, é rota nova no webhook (não feita aqui).
6. **A próxima pergunta vai no mesmo envio.** Antes: "Resposta registrada", `setTimeout` de 2 s e a pergunta em outra mensagem; se a função terminasse antes dos 2 s, a missão parava. Agora `mensagemRespostaRegistrada` traz a confirmação e a próxima pergunta juntas (uma mensagem a menos no teto de 8 por minuto).
7. **Opções mapeadas (G2).** O tratador, o envio diário e a sequência de perguntas gravam `awaiting_button_selection` (`gravarOpcoesNumeradas`); a resposta "1", "2" ou "3" deixa de cair na IA. O `whatsapp-daily-mission-sender` passou de `sendEvolutionButtons` (que montava "1." e não gravava nada) para o texto do módulo.
8. **Sequência e XP total só se forem reais.** A tabela `profiles` não tem as colunas `streak_days` e `total_points` (conferido em `src/integrations/supabase/types.ts` e nas migrações): a leitura falhava e a conclusão mostrava "Sequência: 1 dia" e "+5 bônus" que nunca foram gravados. Agora a sequência e o bônus só aparecem se a leitura e a gravação deram certo; o status mostra só o que foi lido. As duas gravações no perfil viraram uma. A decisão sobre criar as colunas (ou trocar por `award_user_points` na sessão do aluno, como pede a trava de reconciliação) é do dono.
9. **Celebração de peso sem `Math.abs`.** `weightLost` é o peso perdido, positivo: ganho, zero ou ausente cai na celebração padrão e não diz "perdeu". Saíram "O Dr. Vital também mandou parabéns" (um personagem falando pelo outro), "vitória sobre velhos hábitos" e o `toFixed(1)` com ponto. Um só 🎉; sem "VOCÊ CONSEGUIU!", "LENDA", "Não pare agora!" e "Eu sabia que você conseguiria".
10. **Sem ameaça nos lembretes.** `lembrete.sequencia.risco` não diz mais "Seria uma pena perder esse progresso" nem "INCRÍVEL"; as missões não têm mais a lista "Mantém seu streak / Ganha pontos"; "missão(ões)" virou plural certo. Os lembretes de missão apontam para o app, sem opção numerada (as missões do dia do app e as perguntas do WhatsApp são sistemas diferentes).
11. **Meta sem percentual.** `meta.lembrete` mostra Meta, Agora e Diferença. O percentual antigo (`atual / meta`, no teto de 100%) dava "100%" e "Você conseguiu!" para quem queria emagrecer (74 kg com meta de 70), e "Faltam 0". A meta não diz se o valor sobe ou desce, então não há cálculo de percentual. Só diz que chegou quando os dois valores são iguais. O título da meta (texto do aluno) perde `*`, `_` e `~` e é cortado em 80 caracteres.
12. **Bom dia sem dado sensível.** O prompt e a consulta do bom dia não leem mais peso nem humor (peso e exame não vão em mensagem proativa). Saíram "streak", "arrasando" e o sorteio do texto de reserva (agora por hash, sem repetir). O texto de reserva é do módulo.
13. **Missão completa: reserva e SVG válido.** A IA usa o prompt do Rafael e a resposta passa pelo validador (`ajustarRespostaDaIA`); se a IA falha ou não há chave, sai `mensagemMissaoCompletaTexto` (antes: mensagem vazia, e o envio quebrava). O SVG agora é XML válido (cabeçalho, namespace, texto escapado: o nome do aluno nunca vira tag, e "Ana & Bia" não quebra o arquivo), sem emoji que a fonte não desenha e sem "Com carinho, Sirlene". Vai como documento `image/svg+xml` (`resumo-do-dia.svg`): antes ia como "conquista.jpg" com tipo `image/jpeg` e não abria. O WhatsApp não mostra SVG como foto; transformar em PNG pede um renderizador (não feito). A falha do arquivo não derruba mais o envio do texto. O nome ausente deixou de virar "Campeão(ã)".
14. **Guardião de sobrenome sem falso alarme.** `padrao-regras.ts` comparava o sobrenome do exemplo sem diferenciar maiúscula, e o substantivo "dias" ("Sequência: 5 dias") batia com o sobrenome "Dias" do nome de teste. A comparação passou a ser sensível a maiúscula (o sobrenome vaza como está no cadastro).

Código reaproveitado em vez de duplicado: `comNome`, `finito`, `linhas` e `opcao` de `acompanhamento.ts` (agora exportados), `regrasDeFormatoParaIA` de `prompt-ia.ts`, `ajustarRespostaDaIA` de `resposta-ia.ts`, `gravarOpcoesNumeradas` de `opcoes-estado.ts`.

Fica para o L10 (código morto, sem chamador): as 9 `createMission*` de `interactive-templates.ts` (ainda dizem "Você receberá… às {hora}" e "Você ainda não completou"), o tratador legado de missões do `button-handler.ts` (`MISSION_CONFIG` próprio, `handleMissionOptin`, `handleMissionCommand`) e o `text-handler.ts` do webhook antigo da nutrição.

Catraca depois do L7: `TETO_DE_PENDENTES` de 178 para 145 (33 mensagens); régua 16 (sem mudança); negrito duplo 19 (sem mudança); assinatura antiga de 242 para 205 (lugares 16, 28, 30, 31, 33 e 34 foram a zero).


---

## 11. Registro do L8 (relatórios, sabotadores e análise de hábitos), 06/10/2026

Código pronto no working tree, sem commit e sem deploy. Módulo novo em `supabase/functions/_shared/whatsapp/mensagens/relatorios.ts`: 11 ids do catálogo (§7, ids 307 a 310, 312 a 315 e 317 a 319). O laudo do Admin (311, `relatorio.laudo`) já era do L4 e a 316 (`relatorio.semanal.nutricao`, em `interactive-templates.ts`) segue MORTA e sai no L10. O gerador de modelos (325, `admin.gerador_modelos`) não tem texto fixo: os prompts dele foram para `prompt-ia.ts`.

Decisões tomadas (registradas por regra do AGENTS.md):
1. **Uma voz por relatório.**
   - O semanal (cron e n8n) é do Dr. Vital: o relatório vem do `dr-vital-weekly-report` e traz exame, Health Score e hábitos. Saiu a segunda voz, "Sirlene Nutricional", com a análise escrita dela, as diretrizes e a assinatura "Longevity & Performance". A nutrição entra como números (refeições, média diária, proteína). A análise escrita da Sirlene continua só no app (`generate-card-data`) e o cron nem chama mais a IA dela: uma chamada a menos por aluno.
   - Semanal avulso, mensal, diário e nutricional do Admin: Sirlene. Treinos: Alex (antes saía como Sirlene). Relatório sem tipo: eLiving. Resultado dos sabotadores: Rafael (antes "Dr. Vital", "médico especialista").
   - A legenda da análise de hábitos é do dono da sessão, pela mesma tabela que o app usa para assinar o relatório da sessão (`_shared/session-report-identity.ts`): mentalidade e hábitos Rafael, treino Alex, alimentação e água Sirlene, saúde e sono Dr. Vital, tipo desconhecido eLiving. Antes era sempre "Dr. Vital".
2. **Até 1.000 caracteres e o resto no app.** `comLimite()` monta o relatório e, se passa de 1.000, tira o último bloco opcional (conquistas, depois análise, depois foco da próxima semana, depois exame), uma vez por vez. Os números nunca saem. Termina com "O relatório completo está no app eLiving." (só quando há número para ver). Texto da IA ou do Admin entra em frases inteiras e, se nenhuma cabe, não entra: nada de "..." no meio da frase.
3. **Número sem base não aparece.**
   - O Health Score some quando o cálculo é 0 ou ausente.
   - O score nutricional (que partia de 50) só sai quando há ao menos um dia de nutrição registrado (`temBase`).
   - Linha sem dado some: nunca "0" nem "—".
   - Peso só com duas pesagens ou mais (antes "0 kg" no n8n). Médias só dos dias com registro.
   - Semana sem nenhum registro diz "Não encontrei registros seus nesta semana." e não promete relatório completo.
4. **Exame sem "tudo normal".** Saíram "Todos os biomarcadores analisados em faixa de normalidade" (cron) e "Parâmetros sob controle" (n8n, sem ler nada). O texto cita o exame recente e, só se há biomarcador em foco ou risco alto, diz "Vale mostrar ao seu médico nos próximos dias." Valores clínicos não vão: os nomes dos biomarcadores sim, os números ficam no app.
5. **Peso neutro, sem cobrança.** Variação "−0,8 kg", "+0,5 kg" ou "sem variação" (sem 📉/📈, "ganhou" ou "perdeu"). Saíram as recomendações automáticas do n8n ("Tente completar mais missões", "Pratique atividades que melhorem seu humor", "Mantenha pesagens mais regulares"), "Continue assim!", "Descanse bem!", os emojis de nota (🌟/🍀) e "Seu relatório é confidencial".
6. **Sabotadores sem afirmação clínica.** O prompt do Rafael diz que sabotador é um padrão de pensamento que todo mundo tem, dá UMA sugestão pequena e uma pergunta aberta, e proíbe diagnóstico e efeito no corpo ("dores de cabeça", "problemas digestivos"). A assinatura vem do padrão (a IA não assina). **Se a IA falha ou a chave falta, sai uma reserva em números** (antes o envio lançava erro e nada chegava). A legenda da imagem diz "nesta imagem" (a legenda é da própria imagem; antes "acima!").
7. **`nutrition-daily-summary` passa pelo `evolution-sender`.** O texto já era do módulo (L6). Faltava o envio: ia por `fetch` direto à Evolution e furaria o guarda (teto de 8 por minuto, envio não solicitado, fila) se o proativo fosse ligado. Agora usa `sendEvolutionText(..., { kind: 'unsolicited' })`, e o log ganha o estado `queued` e a mensagem de erro. Saiu o `applyCronSignature` (o texto já sai assinado).
8. **`whatsapp-generate-template` só atende o Admin.** Estava com `verify_jwt = false` e sem nenhum guarda: qualquer pessoa, até sem login, gastava a chave do Gemini. O tratador foi para `handler.ts` (sem `serve`, para o teste chamá-lo) e `requireAdmin` é a primeira coisa que roda, antes de ler a chave e o corpo. Voz, assinatura e regras vêm de `prompt-ia.ts` (`promptDoGeradorDeModelos`): saíram "médico virtual", "Reforça constância e responsabilidade" (cobrança), "Use livremente" os emojis e as assinaturas "Com carinho, Sirlene 💚". Ganhou as vozes do Rafael e do Alex. A resposta passa por `ajustarRespostaDaIA` e a abertura `*{{nome}}*` é garantida.
9. **Relatório do Admin tem limite honesto.** O texto livre do Admin (`customMessage`) só é ajustado ao padrão e, se o relatório passa de 1.000 caracteres, o envio responde com erro claro em vez de cortar.

Corrigido de passagem (mesma classe de erro):
- `n8n-weekly-whatsapp-report` consultava `health_diary` pelas colunas `date` e `water_intake`, que não existem (são `diary_date` e `water_intake_ml`): a consulta falhava para todo aluno e nenhum relatório era gerado. Conferido em `src/integrations/supabase/types.ts` e na migração inicial. As conquistas agora leem `achievement_name` (antes `title`, que não existe). A janela de datas vai ao texto.
- O texto de reserva do `dr-vital-weekly-report` ("Prezado(a) …", assinatura "Dr. Vital, Medicina Preventiva") entrava no WhatsApp: `analiseDoDrVitalParaWhatsApp` tira a saudação e a assinatura.
- A tela do teste de sabotadores (`SaboteurTest.tsx`) dizia "Dr. Vital está analisando…" e "Dr. Vital enviou…": agora é o Rafael, igual ao WhatsApp.
- A persona do Rafael (`PERSONA_DO_RAFAEL`) saiu de `missoes.ts` para `prompt-ia.ts` (mesma fonte para o bom dia, a missão completa, os sabotadores e o gerador); `comSinal` (acompanhamento), `limparTexto` (missões) e `frasesQueCabem` (exames) passaram a ser exportados e reaproveitados em vez de copiados. A cópia do worker de exames foi regerada (`node scripts/sync-exames-mensagens-worker.mjs`).

Catraca depois do L8: `TETO_DE_PENDENTES` de 145 para 134 (11 mensagens); régua de 16 para 11 (lugares 23 e 32); negrito duplo 19 (sem mudança); assinatura antiga de 205 para 195 (lugares 23, 32, 35, 36 e 38 foram a zero); exceções de "Sofia" de 3 para 0 (lugar 38). Os lugares 23, 32, 35, 36, 37, 38 e 40 estão sem marca antiga, "Sofia" e "coach".


---

## 12. Registro do L9 (banco: a tabela vira espelho do catálogo), 06/10/2026

SQL e tela prontos no working tree, sem commit, sem deploy e **sem nada aplicado em produção**. O que existe:
- `supabase/functions/_shared/whatsapp/mensagens/espelho-banco.ts`: para cada uma das 83 linhas de `whatsapp_message_templates` (as baixadas de produção em 06/10/2026, guardadas como fixture em `scripts/tests/fixtures/whatsapp_message_templates.producao-20261006.json`), qual mensagem do catálogo ela espelha (`par`) ou por que não tem par.
- `supabase/functions/_shared/whatsapp/mensagens/espelho-formato.ts`: o formato da linha (voz, categoria, descrição `[id · variante] gatilho`), sem import pesado, para o app ler.
- `scripts/sync-whatsapp-templates.mjs` (+ `scripts/sync-whatsapp-templates.export.ts`, lido pelo Deno): gera `supabase/proposed/59_whatsapp_templates_espelho.sql`. `node scripts/sync-whatsapp-templates.mjs --check` confere se o SQL committed é o que o código gera hoje.
- `supabase/proposed/59_whatsapp_templates_espelho.sql`: trava `SET max.liberar_59 = 'sim'`, ensaio por padrão (só grava com `SET max.ensaio_59 = 'nao'`), cópia da tabela inteira em `ops_backup.espelho_59_copia`, 83 UPDATEs por id e `template_key` exatos (cada um precisa alterar 1 linha, senão aborta tudo) e autoverificação (total, ativas, zero "Sofia"/"MaxNutrition"/"MaxChef"/"Instituto dos Sonhos"/"coach", voz dentro da trava). ROLLBACK em SQL no cabeçalho.
- Ensaio PGlite: `scripts/tests/proposed-59-espelho-ensaio-db.test.mjs` (`npm run test:proposed-59-db`), contra a réplica da tabela com as 83 linhas reais.
- Admin: a aba de modelos virou "Catálogo de mensagens (somente leitura)" (`WhatsAppTemplates.tsx`, `TemplateCard.tsx`, `catalogoMensagens.ts`). O modal de edição (`TemplateEditorModal.tsx`) saiu.

Decisões tomadas (registradas por regra do AGENTS.md):
1. **Uma linha por mensagem do catálogo.** Cada par é `(id, variante)` e nenhum é espelhado por duas linhas. A linha mostra a mensagem renderizada com o aluno de exemplo "Rafael" (a mesma de `montar()`), então o texto é o do código por construção. Das 83 linhas, **68 têm par** e ficam ativas; **15 não têm** e ficam `is_active = false`, com `category = 'sem-par'` e um aviso no lugar do texto antigo (o texto antigo só fica na cópia de segurança). Nenhuma linha é apagada nem criada.
2. **Linha sem par quando o código não tem a mensagem equivalente** ou quando outra linha já espelha o mesmo texto (por exemplo, `sofia_no_food_detected` e `error_image_unclear` repetiam a falha de foto sem alimento). Os 15 motivos estão escritos em `espelho-banco.ts` e na descrição de cada linha. Catraca: `TETO_DE_LINHAS_SEM_PAR = 15` em `espelho-banco.test.ts`, só cai.
3. **A voz da linha é a do dono do assunto no catálogo.** Antes a coluna só aceitava `sofia`, `drvital` e `system`, então Rafael e Alex não existiam e as linhas de sono, humor, exercício e missões saíam com a voz errada. O SQL troca a trava para `sirlene`, `drvital`, `rafael`, `alex` e `system` e o padrão da coluna para `system`. Ordem: a trava antiga sai antes dos UPDATEs e a nova entra depois (ADD CONSTRAINT confere as linhas existentes; a primeira versão do SQL falhou nisso no ensaio e o ensaio pegou).
4. **`category` passa a ser o fluxo do catálogo** (boas-vindas, alimentacao, acompanhamento, exames, missoes, relatorios, erros) ou `sem-par`. O slug antigo carregava o nome antigo da marca e as categorias eram duplicadas ("Sofia - Alimentação" e "sofia-alimentacao").
5. **O id do catálogo vai na `description`** (`[agua.confirmacao · meta_batida] gatilho`), sem coluna nova: o Admin lê o formato (`lerDescricaoDoEspelho`) e mostra o id. `template_key`, `id` e `created_at` não mudam.
6. **O 59 substitui o 43 e o 91 para esta tabela.** Rodar o `43_` ou o `91_` depois do `59_` não altera nada nela (provado no ensaio). Os outros blocos deles (`ai_configurations`, `system_settings`) continuam valendo.
7. **Admin somente leitura.** Sem botão Editar, sem chave de ligar e desligar, sem escrita na tabela (teste de código). O envio de teste ("Testar") só aparece nas linhas espelhadas e ativas. Enquanto o SQL não for aplicado, a tela avisa quantas linhas ainda estão no texto antigo e não oferece teste nelas. As regras ajustáveis no Admin (limite, aberturas, liga e desliga proativo) seguem como fase 2 do plano.
8. **O que não foi feito de propósito:** não criei linhas para as mensagens do catálogo que não tinham linha na tabela (123 das 185 entradas de `catalogo.ts`): o L9 pedia as 83 linhas, e criar linhas é INSERT em produção. Se o dono quiser o catálogo inteiro na tela, é uma segunda etapa do mesmo script.

Catraca depois do L9: `TETO_DE_PENDENTES` de 134 para 52 (as 82 linhas do banco com id `*.banco.*` ainda fora de `catalogo.ts` ficaram resolvidas pelo espelho; a `exame.banco.critical_alert` já estava em `catalogo.ts`); `TETO_DE_LINHAS_SEM_PAR` novo, em 15; régua, negrito duplo e assinatura antiga não mudam (o L9 não mexe nos 50 lugares de código). O lugar 51 (a tabela) deixa de ser "dado de produção fora da varredura" e passa a ter ensaio próprio.

Como aplicar (só com OK do dono, no SQL Editor do projeto `imvfmjgmacrulhztrqlh`, nunca `db push`): (1) só leitura: `select count(*), count(*) filter (where is_active) from public.whatsapp_message_templates;` deve dar 83 e 83; (2) ensaio: `SET max.liberar_59 = 'sim';` e o arquivo (termina em "ENSAIO 59_ OK" com a lista das 15 desativadas); (3) gravar: `SET max.liberar_59 = 'sim'; SET max.ensaio_59 = 'nao';` e o arquivo. Se a tabela mudar antes disso, baixar as linhas de novo (só leitura) e gerar de novo com `--producao <json>`.
---

## 13. Registro do L10 (limpeza: código sem chamador), 06/10/2026

Código apagado no working tree, sem commit, sem deploy, sem SQL e sem chamada a produção. Cada arquivo e cada função só saiu depois de uma busca em todo o repositório (importadores estáticos e dinâmicos, nome do arquivo e da função em texto, `supabase/config.toml`, migrações e crons, scripts, `package.json`, CI e testes). O teste `mensagens/__tests__/limpeza-l10.test.ts` trava o resultado.

**Arquivos apagados (30, contando os 10 da Edge do roteador):**
- Webhook antigo da nutrição (`whatsapp-nutrition-webhook/`; o `index.ts` fica e devolve 410): `handlers/` confirmation-handler, edit-handler, image-upload, medical-handler, medical-handler-melhorado, text-handler, text-handler-premium, tracking-handlers; `services/` cache-service, guest-onboarding-service, intent-service, pending-service; `utils/` duplicate-prevention, image-type-detector, message-utils (e o teste dele), ollama-helper. O único elo vivo era o `button-handler.ts`, e o `tracking-handlers.ts` só era chamado pelo roteador de botões antigo.
- Compartilhados sem importador: `_shared/ai/fallback-responses.ts`, `_shared/whatsapp/post-analysis-flows.ts`, `_shared/whatsapp/template-processor.ts` (o único importador era o `post-analysis-flows.ts`).
- A Edge `whatsapp-command-router` inteira (`index.ts` e 9 tratadores) e o bloco dela em `supabase/config.toml`. Nenhum cron, migração, script, CI ou Edge a chamava; o único `invoke` estava no `text-handler.ts` apagado.

**Funções apagadas dentro de arquivos que ficam:**
- `interactive-templates.ts`: 50 modelos sem chamador e o objeto `InteractiveTemplates` (os 9 `createSofia*`, `createErrorMessage`, os 9 `createMission*`, `createMedicationReminder` (o agendador só importava, nunca chamava), `createWeeklyReport`, os modelos antigos do Dr. Vital, `createDailySummary`, os menus de dados e configuração, `createHelpMenu`, `createCheckinResponse`, `createMealPlanSuggestion`, `createMealRecipe` e o objeto `InteractiveTemplates`). Ficam os que `whatsapp-send-interactive`, `whatsapp-test-interactive`, o webhook único, o agendador e o acompanhamento de saúde ainda chamam.
- `button-handler.ts`: de 2.363 para cerca de 180 linhas. Ficam só os 8 tratadores que o webhook único importa (`handleSofiaMealPlan`, `handleSofiaTips`, `handleMealAccept`, `handleMealChange`, `handleMealRecipe`, `handleMealShopping`, `handleVitalUnderstood`, `handleVitalFullReport`). Saíram o roteador `handleButtonClick`, o tratador legado de missões (`MISSION_CONFIG` próprio, `handleMissionOptin`, `handleMissionCommand`), a edição de refeição, a senha legada e o link `/relatorio/` sem proteção. Os nomes iguais (`handleHelp`, `handleVitalMore`…) que o webhook único usa são definições locais dele, não deste arquivo.
- `mission-handlers.ts`: `handleMissionCommand`, `handleMissionStatus`, `sendMissionOptinInvite` e `MISSION_QUESTIONS`.
- `whatsapp-interactive-sender.ts`: 12 envios sem chamador (boas-vindas legada, botões de teste, PDF, imagem). Ficam `sendInteractiveMessage` e `sendTextMessage`, que o `button-handler.ts` e as missões usam. **O plano previa apagar o arquivo inteiro; a busca provou que ele tem chamador, então só encolheu.**
- `whatsapp-sender.ts` (5 funções) e `user-service.ts` (`findUserByPhone` e `getDailyTotal`; ficou só o tipo `UserInfo`).

**Não apagado, de propósito:**
- `vps-backend/src/routes/whatsapp.js` (segundo webhook da VPS). Pendência do dono: conferir, no painel da Evolution, se a URL do webhook aponta para a Edge `whatsapp-webhook-unified` ou para a VPS `/whatsapp/webhook`. O teste do L10 falha se alguém apagar o arquivo antes disso.
- `whatsapp-nutrition-webhook/index.ts`: continua respondendo 410 para quem ainda chamar.
- O catálogo (`CATALOGO_MENSAGENS_WHATSAPP_20261006.md`) segue com as 32 mortas marcadas MORTO: o guardião exige que elas não existam em `catalogo.ts`, e continuam não existindo.

**Catraca (o teto só cai):**

| Item | Antes | Depois |
|---|---|---|
| Lugares varridos | 50 | 47 (13, 17 e 19 apagados; os números ficam reservados) |
| Régua | 11 | **2** (resta o lugar 42, a VPS) |
| Negrito duplo | 19 | **7** (resta o lugar 27) |
| Assinatura antiga | 195 | **25** |
| Marca antiga (exceções) | 7 | **6** (saiu o identificador `generate-meal-plan-maxchef`, que só o roteador citava) |
| `TETO_DE_PENDENTES` | 52 | 52 (as mortas já não contavam; nada a baixar) |

**Fica para o dono ou para uma segunda onda (provadamente sem importador, mas fora da lista do plano):**
1. Em produção, a função `whatsapp-command-router` continua publicada até alguém rodar `supabase functions delete whatsapp-command-router` (só com OK do dono). O código local já não a tem.
2. Sem importador depois do L10: `_shared/whatsapp/adapter-layer.ts`, `_shared/whatsapp/whapi-adapter.ts` e `_shared/whatsapp/gpt52-medical-templates.ts`. `_shared/media/persist-bytes.ts` também ficou sem consumidor (a etapa de mídia é de outra frente e já o descreve como código morto).
3. `src/components/admin/WhatsAppButtonMapping.tsx` não é importado por ninguém e ainda cita os modelos apagados em texto.
4. `src/tests/whatsapp/template-processor.test.ts` testa uma cópia própria (mock) do processador de modelos que o L10 apagou; vale decidir se sai.
5. `mensagemConviteDaMissao` e `mensagemStatusDaMissao` (`mensagens/missoes.ts`) ficaram só no catálogo, porque os tratadores legados que as usavam saíram.

## 14. Registro da revisão adversarial L0 a L10, 07/10/2026

Oito achados, todos verificados. Tratados no código (nada publicado, nada aplicado em produção):

| # | Achado | Real? | Feito |
|---|---|---|---|
| 1 | `exames.test.ts` do worker quebrava o `tsc` | sim | casts nos mocks e `afterEach` com chaves; `npm run typecheck` do worker limpo |
| 2 | "1/2/3" valia para opção enviada horas antes | sim | `opcoesVigentes` (prazo de 30 min, `PRAZO_DAS_OPCOES_MS`) em `opcoes-estado.ts`, usada pelo webhook; teste em `opcoes-estado.test.ts` |
| 3 | falha da foto no worker com texto antigo | sim | `WhatsAppCallback.sendFailureNotification` usa `mensagemFalhaLeitura` (`ia_indisponivel`); lugar 41 zerado; teste do worker ajustado |
| 4 | refeição por texto mostrava 250/300 kcal inventadas | sim | com `generica` o módulo não mostra kcal nem proteína, o assistente passa `kcal: null` e grava `user_confirmed: !generica` |
| 5 | rollback do SQL 59 voltava ao espelho se rodado 2 vezes | sim | rollback usa `min(execucao)` (a cópia mais antiga é o original); caso novo no ensaio PGlite (15 de 15) |
| 6 | tratadores mortos do Dr. Vital | sim (já apagados no working tree) | confirmado sem referências; teto do lugar 15 zerado |
| 7 | `upsert` do sintoma sem `onConflict` | sim | `onConflict: 'user_id,state'` em `health-tracking-handlers.ts` |
| 8 | Edge `whatsapp-command-router` ainda publicada | sim | registrado para o dono: `supabase functions delete whatsapp-command-router --project-ref imvfmjgmacrulhztrqlh` |
