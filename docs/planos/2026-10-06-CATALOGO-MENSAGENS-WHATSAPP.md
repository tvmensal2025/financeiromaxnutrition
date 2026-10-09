# Catálogo de todas as mensagens do WhatsApp (eLiving), 06/10/2026

Este é o registro único das mensagens que o eLiving manda pelo WhatsApp. Para cada uma, o catálogo diz onde ela mora hoje, se chega ao aluno e o que falta para ficar premium.

- **Como foi feito:** somente leitura. Comparei o código publicado (`HEAD`, commit `dc9b68ff`) com o working tree e li a tabela `whatsapp_message_templates` (83 linhas, baixadas em 06/10). Nada foi editado, publicado ou chamado em produção.
- **Padrão de comparação:** `docs/whatsapp/PADRAO_PREMIUM_WHATSAPP.md`.
- **Plano de correção:** `docs/whatsapp/PLANO_MIGRACAO_MENSAGENS.md`.

## Resposta curta para o dono

1. **Não, a correção não está toda feita.** O padrão premium existe para a foto do prato, no módulo `foto-prato-mensagens.ts`. Esse módulo ainda não foi publicado nem ligado: nenhum arquivo ativo o chama. As demais mensagens continuam no formato antigo.
2. **Nenhuma mensagem que chega hoje ao aluno é premium.** A melhor nota de uma mensagem ativa é 3,5 de 5. As únicas com nota 5 são as 9 do módulo novo da foto, ainda desligado.
3. **As mensagens moram em 51 lugares diferentes:** 40 arquivos de Edge Function, 3 do servidor VPS, 7 do app e painel, e 1 tabela do banco. A tabela do banco quase não é lida pelo robô. Editar um modelo no Admin não muda o que o aluno recebe, com uma exceção: o `whatsapp-welcome`, que também não dispara hoje.
4. **Marca antiga visível:**
   - 8 mensagens: 5 modelos do banco com "MaxNutrition" e 3 textos no código (`maxnutrition.app`, `maxnutrition.com.br` e "MaxChef").
   - Mais 1 página de laudo com `www.maxnutrition.com.br` no rodapé.
   - "Sofia" aparece em 67 das 83 linhas do banco, em texto visível. Não aparece em nenhum texto visível do código.
   - "Coach" e "Instituto dos Sonhos" não aparecem em nenhum texto visível.
5. **Achado novo desta consolidação (G15):** várias respostas a botões saem marcadas como "não solicitadas" e o guarda de envio as barra. É o caso da confirmação de água, "ainda não", semana de água, pedido de peso, "depois" e evolução do peso. Detalhe na seção 0.3.

---

## 0. Como ler este catálogo

### 0.1 Colunas

| Coluna | Significado |
|---|---|
| `id` | Nome sugerido e definitivo da mensagem. Será a chave no módulo de mensagens e nos testes. |
| Gatilho | O que o aluno fez, ou qual cron ou botão disparou a mensagem. |
| Fala | Personagem que assina hoje. Entre colchetes, o personagem correto quando ele é outro. |
| Onde mora | `arquivo:linha` no working tree, com o publicado entre parênteses quando muda. Para o banco, o `template_key`. |
| Estado | Se a mensagem chega ao aluno (siglas abaixo). |
| Nota | Nota premium de 0 a 5. Nota 4 ou mais é premium. |
| Problemas | Siglas abaixo. |
| Início do texto | Começo do texto atual exato. `⏎` marca quebra de linha e `…` indica corte. O texto completo está no arquivo citado. |

### 0.2 Siglas

**Estado**

| Sigla | Significado |
|---|---|
| ATIVO | Chega hoje ao aluno pelo webhook. |
| RESERVA | Chega por um caminho alternativo, como o worker da VPS ou a fila de reserva, quando o webhook não processa na hora. |
| BARRADO | O código manda, mas o guarda de envio bloqueia, porque o envio sai como "não solicitado" com `EVOLUTION_ALLOW_UNSOLICITED` desligado. Ver G15. |
| DESLIGADO | Mensagem proativa parada pelo interruptor `WHATSAPP_PROACTIVE_REMINDERS` e pelos crons removidos. |
| QUEBRADO | Nunca chega por defeito de código. |
| MORTO | Nenhum chamador. |
| BANCO | Só existe na tabela `whatsapp_message_templates`. O robô não lê; aparece só no Admin. |
| WT | Só no working tree, ainda não publicado. |
| APP | Texto montado no app, enviado pelo próprio aluno com `wa.me`, ou aviso dentro do app. |
| INCERTO | Depende de configuração de produção que não dá para ler (URL do webhook, n8n externo, flags). |

**Problemas**

| Sigla | Problema |
|---|---|
| MARCA | Marca antiga visível ("MaxNutrition", "maxnutrition.app", "MaxChef"). |
| SOFIA | Cita "Sofia". |
| REG | Régua (`━━━`, `───`, `---`). |
| 2AST | Negrito com `**`. |
| PONTO | Decimal com ponto, ou número colado na unidade ("130g"). |
| NOMEC | Nome completo do aluno. |
| SEMNOME | Não usa o primeiro nome quando deveria. |
| CULPA | Culpa, bronca, cobrança ou pressão. |
| ASSIN | Assinatura fora do padrão ou ausente. |
| LONGO | Mais de 1.000 caracteres. |
| EMOJI | Emoji em excesso (mais de 4) ou emoji de falha (❌) em escolha do aluno. |
| INVENT | Número inventado, meta fixa ou promessa de exatidão ("precisão máxima"). |
| FALSO | Promete o que o sistema não faz ou afirma algo falso. |
| OPC | Opções `1.` em vez de `*1*`, ou opções que o robô não entende. |
| PERS | Personagem errado para o assunto. |
| TEC | Texto técnico ou frio ("Usuário não encontrado", erro cru). |
| GEN | Gênero fixo ("Bem-vindo", "conhecê-lo", "querido(a)", "grato"). |
| CAIXA | Título em caixa alta. |

### 0.3 Achados que valem para várias mensagens

- **G1. A tabela do banco não chega ao aluno.**
  - Só `whatsapp-welcome` consulta a tabela, procurando `welcome_premium` na coluna `content`. Esse modelo e essa coluna não existem, então a consulta sempre falha.
  - `template-processor.ts` só é usado por `post-analysis-flows.ts`, que não tem importador.
  - Os 83 modelos aparecem só no Admin (`src/components/admin/whatsapp/*`).
- **G2. Botões viram texto numerado `1.` sem registro.** O mapeamento de 1/2/3 só é gravado em `sendWhapiButtons` (W:2457). Os modelos de `interactive-templates.ts` não gravam esse mapeamento, então a resposta "1" do aluno cai na IA.
- **G3. Sono, humor e exercício: o modelo nunca chega.** `sendInteractiveTemplate` (W:5204) chama `whatsapp-send-interactive` sem `templateType`, e a função recusa com erro 422.
- **G4. A mesma foto recebe resultados diferentes** conforme quem processa: o webhook, o worker, a fila de reserva ou o app.
- **G5. Proativos desligados.** `WHATSAPP_PROACTIVE_REMINDERS` precisa ser `'true'` para ligar. Os crons foram removidos pelas migrações `20260913220000` e `20260925130000`.
- **G6. Metas fixas no lugar do dado do aluno:** água 2.500 ml (W:4649) ou 2.000 ml, 2.000 kcal, sono 8 h.
- **G7. Cardápio, receita e lista de compras do botão são falsos e iguais para todos** (BH:849-960).
- **G8. Personagem trocado.**
  - Sono, humor, exercício e pesagem assinam "Dr. Vital" no código e "Sofia" no banco.
  - O dono certo está em `_shared/agents/registry.ts`: Sirlene cuida de comida, água e peso; Dr. Vital, de exames e remédios; Alex, de treino; Rafael, de hábito, sono, humor, missão e motivação.
- **G10. Respostas sem leitor.** `awaiting_weight` e o horário de acordar são gravados, mas nada os consome.
- **G13. Tom.** Há culpa em "Seria uma pena perder esse progresso", "Seu objetivo vale muito mais que 2 minutos de doce", "Calma aí! Você está enviando muitas mensagens" e "não fugir da meta".
- **G14. Decimais.** `toFixed(1)` com ponto e "130g" sem espaço aparecem em quase tudo.
- **G15 (novo). Respostas a botão saem como "não solicitadas".**
  - `whatsapp-send-interactive/index.ts:265` chama `sendEvolutionInteractive(phone, interactive)` sem `kind`. O padrão é `'unsolicited'` (`evolution-interactive.ts:18`).
  - Com `EVOLUTION_ALLOW_UNSOLICITED` desligado, o guarda devolve `unsolicited_blocked`.
  - O webhook não confere o retorno na água (W:4641-4655) nem no peso (W:4762-4880). A água fica gravada e o aluno não recebe confirmação.
  - Só a ajuda tem texto reserva (W:4915), por isso a ajuda chega pela versão reserva.
  - Confirmar em conversa real, porque o valor do env em produção não é legível.
- **Assinaturas.** Há 14 variantes em uso: `_Sirlene 💚_`, `_Sirlene 🥗_`, `_Sirlene, sua nutricionista virtual 🥗_`, `_Sirlene, sua nutricionista virtual 💚_`, `Com carinho,⏎Sirlene 💚⏎_eLiving_`, `Com amor,⏎*Sirlene* 💚⏎_eLiving_`, `Com orgulho, Sirlene 💚`, `🌿 Sirlene - eLiving`, `_Sirlene Nutricional • eLiving Private Health_`, `_Dr. Vital 🩺_`, `_Dr. Vital, seu doutor virtual 🩺_`, `_Dr. Vital, seu mentor de saúde e longevidade 🩺_`, `🩺 Dr. Vital - eLiving` e `_Dr. Vital 🩺 | Sirlene 🥗_`. O padrão é uma por personagem: `_Sirlene · eLiving_`, `_Dr. Vital · eLiving_`, `_Rafael · eLiving_`, `_Alex · eLiving_`.

---

## 1. Onde as mensagens moram (51 lugares)

| # | Lugar | Tipo | Estado geral | Mensagens catalogadas |
|---|---|---|---|---|
| 1 | `supabase/functions/whatsapp-webhook-unified/index.ts` (W) | Edge, webhook único de entrada | ATIVO | foto, pendência, edição, água e peso (chamada), menus, exames, galeria, áudio e vídeo |
| 2 | `supabase/functions/whatsapp-ai-assistant/index.ts` (AI) | Edge, IA de texto livre | ATIVO | convite ao visitante, respostas de reserva, ferramentas, prompts |
| 3 | `supabase/functions/_shared/instant-responses.ts` | texto fixo | ATIVO | saudações, ajuda, "como funciona", identidade |
| 4 | `supabase/functions/_shared/whatsapp/interactive-templates.ts` (IT) | modelos de código | parte BARRADO, parte QUEBRADO, parte DESLIGADO | água, sono, humor, exercício, peso, menus, missões |
| 5 | `supabase/functions/_shared/whatsapp/health-tracking-handlers.ts` (HT) | texto fixo | ATIVO | sono, humor, exercício (texto simples) |
| 6 | `supabase/functions/_shared/whatsapp/pending-confirmation.ts` (PC) | texto fixo | WT | respostas 1, 2 e 3 à refeição |
| 7 | `supabase/functions/_shared/whatsapp/foto-prato-mensagens.ts` | módulo premium | WT, não ligado | foto do prato v2 |
| 8 | `supabase/functions/_shared/whatsapp/foto-prato-leitura.ts` | texto fixo | WT | falhas da leitura |
| 9 | `supabase/functions/_shared/whatsapp/laudo-protegido.ts` | texto fixo | WT | laudo pronto (caminho do app) |
| 10 | `supabase/functions/_shared/whatsapp/phone-identity.ts` | texto fixo | WT | telefone em várias contas |
| 11 | `supabase/functions/_shared/whatsapp/marketing-consent.ts` | texto fixo | ATIVO | rodapé SAIR e confirmação |
| 12 | `supabase/functions/_shared/whatsapp/gender-utils.ts` | texto fixo | QUEBRADO (não dispara) | boas-vindas de cadastro |
| 13 | `supabase/functions/_shared/ai/fallback-responses.ts` | texto fixo | MORTO | reservas do Dr. Vital |
| 14 | `supabase/functions/_shared/audio-keyword-matrix.ts` | texto de áudio | ATIVO | apresentação falada da Sirlene |
| 15 | `supabase/functions/whatsapp-nutrition-webhook/handlers/button-handler.ts` (BH) | texto fixo | parte ATIVO (importado por W), parte MORTO | cardápio, dicas, pós-exame, senha legada |
| 16 | `supabase/functions/whatsapp-nutrition-webhook/handlers/mission-handlers.ts` | texto fixo | ATIVO (importado por W:3150) | respostas das missões |
| 17 | `supabase/functions/whatsapp-nutrition-webhook/services/guest-onboarding-service.ts` | texto fixo | MORTO | 12 convites ao visitante |
| 18 | `supabase/functions/whatsapp-nutrition-webhook/utils/whatsapp-interactive-sender.ts` | texto fixo | MORTO | boas-vindas legada |
| 19 | `supabase/functions/whatsapp-command-router/` (index e handlers) | texto fixo | MORTO na prática (só o webhook descontinuado chama) | comandos, "MaxChef" |
| 20 | `supabase/functions/whatsapp-welcome/index.ts` | Edge | não dispara | aviso no app |
| 21 | `supabase/functions/whatsapp-medical-handler/index.ts` | Edge, chamada pelo app | ATIVO | análise e erro do exame |
| 22 | `supabase/functions/medical-batch-timeout/index.ts` | cron | ATIVO se o cron estiver agendado | pergunta exame ou receita |
| 23 | `supabase/functions/send-whatsapp-report/index.ts` | Edge, Admin | BARRADO | 7 relatórios |
| 24 | `supabase/functions/dr-vital-notifications/index.ts` | cron | DESLIGADO (vai só para o app) | notificações |
| 25 | `supabase/functions/send-meal-plan-whatsapp/index.ts` (SMP) | Edge, chamada pelo app | ATIVO | cardápio enviado |
| 26 | `supabase/functions/process-one-analysis-job/index.ts` (POA) | fila de reserva | RESERVA | resultado da foto |
| 27 | `supabase/functions/sofia-image-analysis/index.ts` (SI) | análise | APP (texto gravado no job e no chat do app) | resultado da foto no app |
| 28 | `supabase/functions/whatsapp-daily-motivation/index.ts` | cron | DESLIGADO | bom dia |
| 29 | `supabase/functions/whatsapp-daily-mission-sender/index.ts` | cron | DESLIGADO e BARRADO | 7 perguntas de missão |
| 30 | `supabase/functions/whatsapp-goal-reminders/index.ts` | cron | DESLIGADO | lembrete de meta |
| 31 | `supabase/functions/whatsapp-smart-reminders/index.ts` (SR) | cron | DESLIGADO | 8 lembretes |
| 32 | `supabase/functions/whatsapp-weekly-report/index.ts` | cron | DESLIGADO | relatório semanal premium |
| 33 | `supabase/functions/whatsapp-celebration/index.ts` | app | DESLIGADO (vai para o app) | 5 celebrações |
| 34 | `supabase/functions/whatsapp-mission-complete/index.ts` | app | DESLIGADO (vai para o app) | missão completa |
| 35 | `supabase/functions/whatsapp-saboteur-result/index.ts` | app | BARRADO | resultado de sabotadores |
| 36 | `supabase/functions/whatsapp-habits-analysis/index.ts` | app | BARRADO | legenda da análise |
| 37 | `supabase/functions/n8n-weekly-whatsapp-report/index.ts` | n8n externo | INCERTO | relatório "Dr. Vita" |
| 38 | `supabase/functions/whatsapp-generate-template/index.ts` | Admin (gerador) | ATIVO, sem autenticação | prompts do gerador |
| 39 | `supabase/functions/whatsapp-nutrition-check/index.ts` (NC) | cron | DESLIGADO | pergunta de refeição |
| 40 | `supabase/functions/nutrition-daily-summary/index.ts` (NDS) | cron | DESLIGADO (fura o guarda se ligar) | resumo do dia |
| 41 | `vps-backend/src/ai-worker/src/worker/WhatsAppCallback.ts` (WC) | worker VPS | ATIVO (exames) e RESERVA (foto) | laudo, receita, resultado da foto |
| 42 | `vps-backend/src/services/whatsapp.js` e `cron.js` | VPS | DESLIGADO (`nativeOnly`) | lembretes de água e peso |
| 43 | `vps-backend/src/routes/whatsapp.js` | VPS, segundo webhook | INCERTO | respostas próprias |
| 44 | `src/lib/shopping-list/share-format.ts` | app (`wa.me`) | APP | lista de mercado |
| 45 | `src/components/.../RecipeSharePremiumModal.tsx` | app (`wa.me`) | APP | receita compartilhada |
| 46 | `src/.../NutritionDossierPage.tsx` | app (`wa.me`) | APP | convite |
| 47 | `src/.../SirlenePrimaryAction.tsx` | app (`wa.me`) | APP | "Oi Sirlene" |
| 48 | `src/components/admin/whatsapp/EvolutionConnectionCard.tsx` | Admin | ATIVO (teste) | teste de conexão |
| 49 | `src/components/admin/whatsapp/WhapiConfigPanel.tsx` | Admin | ATIVO (teste) | teste de conexão |
| 50 | `src/components/admin/whatsapp/WhatsAppInteractiveTest.tsx` | Admin | ATIVO (teste) | terceira cópia dos modelos |
| 51 | Banco `whatsapp_message_templates` (83 linhas, 15 categorias) | dado de produção | BANCO | 83 modelos |

Fora da conta, porque não têm texto próprio:
- `whatsapp-send-interactive` e `whatsapp-test-interactive` só despacham `interactive-templates.ts`.
- `whatsapp-scheduler` só agenda.
- `evolution-sender.ts`, `evolution-interactive.ts`, `numbered-options.ts` e `text-format.ts` só transportam e formatam.

`finalize-medical-document/index.ts:797` não é mensagem, mas é a página do laudo aberta pelo link. Entrou na lista de trocas de marca.

---

## 2. Boas-vindas, cadastro, conversa geral e menus

### 2.1 Do início ao fim (como o aluno vê hoje)

**Número sem cadastro escreve qualquer coisa**
1. Recebe `bv.visitante.convite` (AI:1506), com cerca de 1.200 caracteres e a equipe inteira.
2. Se mandar foto de comida, recebe `alim.foto.recebido` e depois `bv.visitante.convite_foto` (W:3948).
3. Se mandar foto de exame, recebe `bv.visitante.convite_exame` (W:5577) e a foto não é analisada.
4. Se o número estiver em duas contas, recebe `bv.telefone_varias_contas`. Isso só acontece no WT; no publicado o aluno fica sem resposta (erro 500).

**Aluno se cadastra no app**
1. Nada chega no WhatsApp. `whatsapp-welcome` não é chamado por nenhum código de `src/`, e, se fosse, o proativo está desligado.
2. Dentro do app pode aparecer `bv.cadastro.aviso_app`.

**Aluno cadastrado escreve "oi", "bom dia", "obrigado", "ajuda"**
1. Recebe uma resposta instantânea sem IA (`instant-responses.ts`), sem o nome dele e assinada `_Sirlene 💚_`.
2. Qualquer outro texto vai para a IA (seção 10).

**Aluno toca em "Ajuda" ou "Menu"**
1. A lista interativa é barrada (G15) e sai `menu.ajuda.reserva` (W:4915), que manda "clicar" em botão que não existe.
2. Os itens do menu respondem com `menu.item.*`.

### 2.2 Registros

| # | id | Gatilho | Fala | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 1 | `bv.visitante.convite` | texto de número sem perfil | Sirlene | AI:1506 | ATIVO | 2 | REG LONGO EMOJI INVENT ASSIN SEMNOME | "Olá! 👋 Que prazer falar com você!⏎⏎Eu sou a *Sirlene*, sua nutricionista virtual! 🥗⏎⏎Faço parte de uma equipe incrível:…⏎🎁 *Quer fazer um teste GRÁTIS?*… Tudo com precisão máxima! 🎯… _Sirlene 🥗_" |
| 2 | `bv.visitante.convite_foto` | visitante manda foto ou "1" sem pendência | Sirlene | W:3948 (HEAD:3892) | ATIVO | 1 | REG EMOJI INVENT ASSIN, duplica o #1 | "Olá! 👋 Que prazer falar com você!… • Gorduras • Carboidratos • Proteínas • Calorias⏎⏎Tudo com precisão máxima! 🎯… _Sirlene 🥗_" |
| 3 | `bv.visitante.convite_exame` | visitante manda foto de exame | Dr. Vital | W:5577-5601 (HEAD:5492) | ATIVO | 1 | REG LONGO EMOJI INVENT GEN FALSO ("médico especialista"; promete analisar e não analisa) | "Olá! 👋 Prazer em conhecê-lo!⏎⏎Eu sou o *Dr. Vital*, médico especialista! 🩺…" |
| 4 | `bv.visitante.servico` (12 variantes) | visitante (fluxo antigo) | Sirlene | `guest-onboarding-service.ts:180-237` | MORTO | 3 | ASSIN, "ilimitadas", Sirlene interpretando exame | "✨ *Oi! Que bom ter você aqui!*⏎⏎Sou a *Sirlene* 💚, nutricionista virtual do eLiving.…Como posso te chamar? 😊" |
| 5 | `bv.telefone_varias_contas` | `PhoneIdentityConflictError` (limite de 1 a cada 10 min) | Sirlene | `phone-identity.ts:27`, enviado em W:268 | WT | 3 | ASSIN, parágrafo único | "Oi! Aqui é a Sirlene, do eLiving. 💚 Recebi sua mensagem, mas este número está cadastrado em mais de uma conta…" |
| 6 | `bv.cadastro.boas_vindas` | `whatsapp-welcome` com `userId` e `phone` | Sirlene | `gender-utils.ts:140` (`getWelcomeMessage`) | QUEBRADO (sem chamador; proativo desligado) | 3 | REG NOMEC EMOJI ASSIN INVENT ("te dou os macros"), "Com amor" | "✨ *Olá, ${name}!* ✨⏎⏎Seja muito ${bem-vindo/a} ao *eLiving*! 💚⏎⏎Sou a *Sirlene*…" |
| 7 | `bv.cadastro.aviso_app` | `whatsapp-welcome` com proativo desligado | eLiving | `whatsapp-welcome/index.ts:36-37` | APP (notificação) | 3 | GEN SEMNOME | título "Bem-vindo ao eLiving"; "Seus lembretes vão aparecer neste app. O WhatsApp só responde se você escrever." |
| 8 | `bv.cadastro.boas_vindas_interativa` | `templateType:'welcome'` | Sirlene | IT:813-834 (`createWelcomeMessage`) | MORTO e BARRADO | 3 | NOMEC GEN ASSIN OPC | "🌿 Bem-vindo ao eLiving!" / "Olá, ${name}! 👋⏎⏎Sou a *Sirlene*, sua nutricionista virtual…" |
| 9 | `bv.cadastro.boas_vindas_legado` | webhook descontinuado | Sirlene | `whatsapp-interactive-sender.ts:184` | MORTO | 2 | GEN ASSIN | "💚 *Bem-vindo ao eLiving!*" / "Olá, ${name}! 👋…" |
| 10 | `bv.banco.welcome_message` | nenhum | Sofia | banco `welcome_message` (geral) | BANCO | 1 | MARCA SOFIA FALSO ("Lembrar de beber água") | H "👋 Bem-vind{{genderSuffix}}!" B "Olá, {{userName}}! 💚⏎⏎Sou a *Sofia*…" F "🌿 Sofia - MaxNutrition" |
| 11 | `bv.banco.guest_welcome` | nenhum | Sofia | banco `guest_welcome` (Onboarding) | BANCO | 1 | SOFIA ASSIN PERS | "👋 *Olá! Sou a Sofia, sua nutricionista virtual!* 💚…" |
| 12 | `bv.banco.guest_ask_name` | nenhum | Sofia | banco `guest_ask_name` | BANCO | 2 | SOFIA | "😊 *Prazer em conhecer você!*⏎⏎Me conta: como posso te chamar?⏎⏎_Sofia 💚_" |
| 13 | `bv.banco.guest_demo_result` | nenhum | Sofia | banco `guest_demo_result` | BANCO | 1 | MARCA SOFIA REG | "📸 *Análise da Sofia* 💚⏎⏎{{analysisResult}}⏎⏎---⏎…crie sua conta gratuita no MaxNutrition! 🚀" |
| 14 | `bv.banco.guest_signup_invite` | nenhum | sem assinatura | banco `guest_signup_invite` | BANCO | 2 | ASSIN, "ilimitadas" | "*{{guestName}}*, para análises ilimitadas e acompanhamento completo, crie sua conta gratuita! 🚀…" |
| 15 | `bv.banco.guest_demo_error` | nenhum | Sofia | banco `guest_demo_error` | BANCO | 3 | SOFIA | "*{{guestName}}*, tive um probleminha para analisar sua foto. 😅…" |
| 16 | `bv.banco.faq_welcome` | nenhum | Sofia | banco `faq_welcome` | BANCO | 2 | SOFIA | "🎉 *Obrigada! É um prazer te ter aqui!* 💚…_Sofia 💚_" |
| 17 | `conv.saudacao.oi` (3 variantes) | "oi", "olá", "opa", "fala" | Sirlene | `instant-responses.ts:148` | ATIVO | 3 | GEN SEMNOME ASSIN EMOJI | "👋 *Olá! Bem-vindo ao eLiving!* 💚⏎⏎*Como posso ajudar você hoje?*…" |
| 18 | `conv.saudacao.bom_dia` (3) | "bom dia" | Sirlene | `instant-responses.ts:181` | ATIVO | 2 | GEN ("querido(a)") SEMNOME ASSIN | "☀️ *Bom dia! Que dia lindo para cuidar da sua saúde!* 💚…" |
| 19 | `conv.saudacao.boa_tarde` (3) | "boa tarde" | Sirlene | `instant-responses.ts:215` | ATIVO | 3 | SEMNOME ASSIN, "Já almoçou?" | "🌤️ *Boa tarde! Espero que esteja tendo um ótimo dia!* 💚…" |
| 20 | `conv.saudacao.boa_noite` (3) | "boa noite" | Sirlene | `instant-responses.ts:249` | ATIVO | 2 | GEN SEMNOME ASSIN | "🌙 *Boa noite! Que noite tranquila para você!* 💚…" |
| 21 | `conv.saudacao.e_ai` (2) | "e aí", "eae" | Sirlene | `instant-responses.ts:283` | ATIVO | 3 | SEMNOME ASSIN | "👋 *E aí! Tudo certo com você?* 💚…" |
| 22 | `conv.agradecimento` (4+2) | "obrigado", "valeu" | Sirlene | `instant-responses.ts:306` e `:333` | ATIVO | 3 | SEMNOME ASSIN, "Sua saúde é minha prioridade" | "😊 *De nada! Fico feliz em ajudar!* 💚⏎⏎*Estou sempre aqui para você!*…" |
| 23 | `conv.despedida` (3+2) | "tchau", "até logo" | Sirlene | `instant-responses.ts:352` e `:373` | ATIVO | 3 | CULPA leve ("Lembre-se: hidrate-se e coma bem!") ASSIN | "👋 *Até logo! Foi ótimo falar com você!* 💚…" |
| 24 | `conv.confirmacao` (3+2+2+1) | "ok", "beleza", "sim", "não" | Sirlene | `instant-responses.ts:392`, `:422`, `:437` e `:651` | ATIVO | 2 | FALSO (responde "sim" e "não" sem olhar a pergunta anterior) ASSIN | "👍 *Perfeito! Estou aqui!* 💚⏎⏎*O que você gostaria de fazer?*…" |
| 25 | `conv.bem_estar` (3+2) | "tudo bem?" | Sirlene | `instant-responses.ts:452` e `:481` | ATIVO | 2 | "Estou super bem" dito por uma IA | "😊 *Tudo ótimo! E com você?* 💚…" |
| 26 | `conv.fome` (2) | "estou com fome" | Sirlene | `instant-responses.ts:500` | ATIVO | 1 | CULPA ("com consciência", "não fugir da meta", "não fica no escuro") | "🍽️ *Bora matar essa fome com consciência!* 💚…" |
| 27 | `conv.registro_refeicao` (3) | "registrar refeição" | Sirlene | `instant-responses.ts:47`, `:60` e `:71` | ATIVO | 3 | SEMNOME ASSIN | "📝 *Modo Registro de Refeição* 💚⏎⏎*Como você quer registrar?*…" |
| 28 | `conv.dr_vital_atalhos` (5) | "exame", "dr vital", "meus exames" | Sirlene escrevendo pelo Dr. Vital | `instant-responses.ts:83-134` | ATIVO | 2 | PERS ASSIN, "Dúvida médica" sem aviso | "🩺 *Dr. Vital - Análise de Exames* 💚⏎⏎*Para analisar seus exames:*…" |
| 29 | `conv.identidade` (2) | "quem é você" | Sirlene | `instant-responses.ts:578` | ATIVO | 2 | REG, "IA avançada", "nutrição e saúde" | "🤖 *Olá! Sou a Sirlene!* 💚⏎⏎*Sua assistente de nutrição e saúde!*⏎⏎━━━…" |
| 30 | `conv.capacidades` | "o que você faz" | Sirlene | `instant-responses.ts:619` | ATIVO | 2 | REG (5 réguas) INVENT | "✨ *O que eu posso fazer por você:*⏎⏎━━━━━━━━━━━━━━━━━━━━⏎⏎📸 *Análise de Refeições*…" |
| 31 | `conv.como_funciona` | "como funciona" | Sirlene | `instant-responses.ts:553` | ATIVO | 2 | REG INVENT ("Identifico todos os alimentos") | "📋 *Como funciona o eLiving:*⏎⏎━━━━━━━━━━━━━━━━━━━━⏎⏎*Passo 1️⃣ → Envie a Foto*…" |
| 32 | `conv.ajuda_texto` | "ajuda", "menu", "?" escritos | Sirlene | `instant-responses.ts:522` | ATIVO | 2 | REG (3 réguas) EMOJI LONGO? INVENT | "📋 *Posso te ajudar com:*⏎⏎━━━━━━━━━━━━━━━━━━━━⏎⏎✨ *Análise de Alimentos*…" |
| 33 | `conv.banco.faq_greeting_oi` | nenhum | Sofia | banco `faq_greeting_oi` | BANCO | 1 | MARCA SOFIA GEN | "👋 *Olá! Bem-vindo ao MaxNutrition!* 💚…" |
| 34 | `conv.banco.faq_greeting_bom_dia` | nenhum | Sofia | banco | BANCO | 2 | SOFIA | "☀️ *Bom dia! Que dia lindo para cuidar da sua saúde!* 💚…_Sofia 💚_" |
| 35 | `conv.banco.faq_greeting_boa_tarde` | nenhum | Sofia | banco | BANCO | 2 | SOFIA | "🌤️ *Boa tarde! Espero que esteja tendo um ótimo dia!* 💚…" |
| 36 | `conv.banco.faq_greeting_boa_noite` | nenhum | Sofia | banco | BANCO | 2 | SOFIA | "🌙 *Boa noite! Que noite tranquila para você!* 💚…" |
| 37 | `conv.banco.faq_greeting_eae` | nenhum | Sofia | banco | BANCO | 2 | SOFIA | "👋 *E aí! Tudo certo?* 💚⏎⏎Bora cuidar da saúde!…" |
| 38 | `conv.banco.faq_help` | nenhum | Sofia | banco | BANCO | 1 | SOFIA | "📋 *O que posso fazer por você:* 💚⏎⏎✨ *Análise de Alimentos*…" |
| 39 | `conv.banco.faq_how_it_works` | nenhum | Sofia | banco | BANCO | 1 | MARCA SOFIA | "📋 *Como funciona o MaxNutrition:* 💚…" |
| 40 | `conv.banco.faq_thanks` | nenhum | Sofia | banco | BANCO | 2 | SOFIA | "😊 *De nada! Fico feliz em ajudar!* 💚…_Sofia 💚_" |
| 41 | `conv.banco.faq_ok` | nenhum | Sofia | banco | BANCO | 2 | SOFIA | "👍 *Perfeito!* 💚⏎⏎Qualquer coisa, é só chamar!⏎⏎_Sofia 💚_" |
| 42 | `menu.ajuda.lista` | botão "help" (W:2936-2939, envio em W:4902) | eLiving | IT:838 (`createHelpMenu`) e IT:2282 (`createHelpResponse`) | BARRADO (G15) | 3 | SEMNOME ASSIN OPC FALSO ("Lembretes automáticos") | "❓ Central de Ajuda" / "Escolha uma opção para saber mais…" |
| 43 | `menu.ajuda.reserva` | falha da lista de ajuda (o caso de hoje) | sem assinatura | W:4915 (HEAD:4823) | ATIVO | 2 | FALSO ("Clique em 'Cardápio'", botão que não existe) ASSIN | "🌿 *Como posso ajudar?*⏎⏎📸 *Enviar Foto* – Tire foto da refeição ou exame…" |
| 44 | `menu.principal.lista` | `templateType:'menu'` | eLiving | IT:2413 (`createMainMenu`) | BARRADO | 3 | ASSIN OPC | "🌿 eLiving" / "Olá! Como posso te ajudar hoje?⏎⏎Escolha uma opção abaixo:" |
| 45 | `menu.item.analisar` | item `menu_analyze` | Sirlene | W:2944-2946 (HEAD:2889) | ATIVO | 3 | SEMNOME ASSIN | "📸 *Analisar Refeição*⏎⏎Envie uma foto da sua refeição e eu analiso os nutrientes!…_Sirlene 🥗_" |
| 46 | `menu.item.exame` | item `menu_exam` | Dr. Vital | W:2972 | ATIVO | 3 | SEMNOME ASSIN | "🔬 *Analisar Exame*⏎⏎Envie uma foto do seu exame de sangue e o Dr. Vital vai analisar!…" |
| 47 | `menu.item.progresso` | `menu_progress`, `menu_history` | eLiving | W:2983-2987 (HEAD:2926) | ATIVO | 3 | SEMNOME ASSIN | "📊 *Progresso e Histórico*⏎⏎Para ver sua evolução completa…_eLiving 💚_" |
| 48 | `menu.banco.main_menu` | nenhum | Sofia | banco `main_menu` | BANCO | 1 | SOFIA | "{{userName}}, o que deseja fazer?…" F "🌿 Sofia" |
| 49 | `menu.banco.help_menu` | nenhum | Sofia | banco `help_menu` | BANCO | 1 | MARCA SOFIA | "{{userName}}, como posso te ajudar?…" F "🌿 Sofia - MaxNutrition" |

---

## 3. Alimentação e foto do prato (Sirlene)

### 3.1 Do início ao fim (como o aluno vê hoje)

**Foto do prato**
1. `alim.foto.recebido`, com aviso neutro e assinatura `_eLiving_`.
2. Um destes três:
   - `alim.foto.resultado` (W:3848), cartão com kcal por item;
   - uma falha (`alim.foto.sem_alimento`, `erro_leitura`, `leitura_indisponivel` (WT), `excecao`, `erro_enfileirar`, `erro_geral`);
   - se o worker assumir, `alim.foto.worker_resultado`, que traz régua e não traz kcal.
3. O aluno responde:
   - "1" ou "sim" leva a `alim.pend.confirmar_card` (W:4227). Se a refeição estava só em `food_history`, no publicado a resposta se perdia (TypeError); no WT sai `alim.pend.txt_confirmar`.
   - "2" leva a `alim.edit.modo`, depois `alim.edit.linhas_correcao` e `alim.edit.atualizado`, de volta ao passo 3.
   - "3" leva a `alim.cancel.ok`.
4. Depois de confirmar, o aluno não recebe "seu dia até agora". Esse texto só existe no módulo novo, desligado.

**Texto livre ("almocei arroz e feijão")**
1. A IA registra direto como confirmado, sem perguntar, e responde 2 a 4 linhas (`alim.texto.ia`).
2. Se a IA falhar, `alim.texto.fallback_refeicao` diz "Já estou guardando os dados" sem gravar nada.

**Áudio:** sai `alim.audio.ouvi` seguido da resposta da IA, ou uma das falhas.

**Vídeo:** sai `alim.video.recebido`, com uma pergunta sem opção de resposta.

**Foto que não é prato nem exame:** sai `foto.galeria.*`, com rodapé fixo "Rafael 🏃" para todos.

**Cardápio, receita e lista de compras:**
- O botão do zap devolve o cardápio falso (`nutri.cardapio_botao`).
- O cardápio verdadeiro vem do app (`nutri.cardapio_enviado`), com o link `maxnutrition.app`.

### 3.2 Registros: fluxo vivo

| # | id | Gatilho | Fala | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 50 | `alim.foto.recebido` | qualquer imagem, inclusive exame | eLiving | W:1009 (HEAD:984) | ATIVO | 2 | SEMNOME ASSIN TEC; soma com `exame.recebimento.primeira_foto` | "📸 *Foto recebida*⏎⏎Vou verificar se consigo abrir e identificar a imagem.⏎Depois encaminho para a análise correspondente.⏎⏎_eLiving_" |
| 51 | `alim.foto.leitura_nao_confirmada` | exceção ao baixar ou classificar (limite de 1 a cada 30 s) | eLiving | W:1101 (HEAD:1076) | ATIVO | 2 | SEMNOME ASSIN, sem "Não registrei nada" | "⚠️ *Leitura não confirmada*⏎⏎Não consegui concluir a leitura desta imagem…_eLiving_" |
| 52 | `alim.foto.resultado` (e `_cache`) | análise encontrou alimento | Sirlene | `formatMealAnalysisMessage` W:3848-3883 (HEAD:3791-3826), chamado em W:6163 e W:6267 | ATIVO | 2 | INVENT (kcal por item) PONTO OPC (texto diz "Corrigir/Descartar", botões gravados dizem "Editar/Excluir"); não avisa que é estimativa | "🍽️ *{Nome}, li o seu prato*⏎{emoji} *{Alimento}*  ·  {g} g  ·  {kcal} kcal…⏎✅ *1* Confirmar⏎✏️ *2* Corrigir⏎🗑️ *3* Descartar⏎_Sirlene · eLiving_" |
| 53 | `alim.foto.sem_alimento_cache` | cache sem itens | Sirlene | W:6200 (HEAD:6105) | ATIVO | 2 | SEMNOME ASSIN | "❓ *Não consegui identificar alimentos na foto.*⏎⏎Tente enviar uma foto mais nítida…⏎⏎_Sirlene 🥗_" |
| 54 | `alim.foto.erro_leitura` | `sofia-image-analysis` falhou | Sirlene | W:6232 (HEAD:6137) | ATIVO | 2 | CULPA (culpa a foto quando o erro é do sistema) ASSIN | "❓ *{Nome}, não consegui identificar os alimentos com clareza nesta foto.*…" |
| 55 | `alim.foto.leitura_indisponivel` | cota ou IA fora | Sirlene | W:6242 (só WT) | WT | 3 | ASSIN, sem "Não registrei nada" | "⏳ *{Nome}, não consegui ler sua foto agora.*⏎⏎Tente de novo em alguns minutos ou me diga o que você comeu. 🥗…" |
| 56 | `alim.foto.sem_alimento` | análise sem itens | Sirlene | W:6303 (HEAD:6198) | ATIVO | 2 | ASSIN, sem "Não registrei nada" | "❓ *{Nome}, não consegui identificar alimentos nesta foto.*…" |
| 57 | `alim.foto.excecao` | exceção na análise | Sirlene | W:6309 (HEAD:6204) | ATIVO | 2 | ASSIN EMOJI(❌) | "❌ *{Nome}, tive uma instabilidade momentânea na análise.*…" |
| 58 | `alim.foto.erro_enfileirar` | falha na fila | Sirlene | W:6086 (HEAD:5991) | ATIVO | 2 | TEC ASSIN | "❌ *{Nome}, erro ao processar*⏎⏎Tente novamente em instantes.⏎⏎_Sirlene 🥗_" |
| 59 | `alim.foto.erro_geral` | exceção externa | Sirlene | W:6318 (HEAD:6213) | ATIVO | 2 | TEC SEMNOME ASSIN | "❌ *Erro ao processar a imagem*⏎⏎Tente novamente em alguns instantes.…" |
| 60 | `alim.foto.worker_resultado` | worker termina | Sirlene | WC:566-585 | RESERVA | 3 | REG PONTO, sem kcal (difere do webhook) | "*{Nome}, li o seu prato*⏎⏎━━━━━━━━━━━━━━━━⏎⏎• *Arroz*⏎   130g…⏎*1*  Confirmar e salvar…⏎_Sirlene · eLiving_" |
| 61 | `alim.foto.worker_erro` | worker com `error` | Sirlene | WC:527 | RESERVA | 2 | SEMNOME CULPA | "❌ *Erro na análise*⏎⏎Tente enviar uma foto mais nítida.⏎⏎_Sirlene · eLiving_" |
| 62 | `alim.foto.worker_sem_alimento` | worker sem itens | Sirlene | WC:541-550 | RESERVA | 1 | FALSO (oferece "1 Confirmar" sem nada para confirmar) TEC | "📋 *Relatório da análise:*⏎⏎{texto cru da IA}⏎⏎*O que você quer fazer?*⏎⏎*1*  Confirmar…" |
| 63 | `alim.foto.worker_falha` | job falhou ou expirou | Sirlene | WC:795; POA:23-24 (`FAILURE_MSG`) | RESERVA | 2 | SEMNOME ASSIN | "⚠️ *Não consegui analisar sua foto.*⏎⏎Pode ter sido um problema temporário…⏎⏎_Sirlene 🥗_" |
| 64 | `alim.foto.fila_reserva` | cron de reserva processa | Sirlene | POA:226-227 | RESERVA | 1 | TEC ("fallback", "fila de reserva") SEMNOME PONTO | "🍽️ *Análise concluída (fallback):*⏎⏎• Arroz – 130g…⏎_Enviado pela fila de reserva. Para botões de confirmar/corrigir, use o app._" |
| 65 | `alim.foto.fila_sem_alimento` | idem, sem itens | Sirlene | POA:230 | RESERVA | 1 | ASSIN | "❓ Não consegui identificar alimentos nesta foto. Tente outra imagem.⏎⏎_Sirlene 🥗_" |
| 66 | `alim.foto.worker_generico` | tipo de job desconhecido | eLiving | WC:924, 931 | RESERVA | 1 | TEC (mostra o erro cru) | "❌ *Erro no processamento*⏎⏎{erro}⏎⏎_eLiving 💚_" |
| 67 | `alim.pend.confirmar_card` | botão confirmar, ou "1/sim/ok" com pendência | Sirlene | W:4227-4235 (HEAD:4146) | ATIVO | 2 | CAIXA SEMNOME PONTO ASSIN, sem progresso do dia | "✅ *Refeição Registrada com Sucesso!*⏎⏎📊 *RESUMO NUTRICIONAL (TACO):*⏎🔥 *Calorias:* {n} kcal…⏎_Sirlene, sua nutricionista virtual 💚_" |
| 68 | `alim.pend.confirmar_aprendizado` | confirmou depois de corrigir | Sirlene | W:4216-4220 (HEAD:4135) | ATIVO | 2 | CULPA leve (contador), "usuários" | "🧠 *Obrigado por corrigir!*⏎Sua correção ajudou a melhorar a inteligência da Sirlene.…" |
| 69 | `alim.pend.confirmar_erro` | falha ao buscar ou confirmar | sem assinatura | W:3909, 4113, 4131 | ATIVO | 1 | TEC ASSIN, sem "Não salvei" | "❌ Erro ao buscar análise. Tente novamente." / "❌ Erro ao confirmar. Tente novamente." |
| 70 | `alim.pend.sem_pendencia` | "1/sim" sem análise pendente | sem assinatura | W:3974 (HEAD:3917) | ATIVO | 2 | ASSIN SEMNOME | "❓ Não encontrei análise pendente.⏎⏎Envie uma nova foto de refeição!" |
| 71 | `alim.pend.txt_confirmar` | "1/sim" com `food_history` pendente | Sirlene | PC:259 (HEAD: W:6312, quebrado) | WT | 3 | ASSIN, difere do #67 para o mesmo evento | "✅ *{Nome}, refeição confirmada!*⏎⏎📊 Registrado no seu diário alimentar.⏎⏎_Sirlene 🥗_" |
| 72 | `alim.pend.txt_editar` | "2/não/editar" | Sirlene | PC:271 (HEAD:6324) | WT | 3 | ASSIN PONTO; "não" vale editar aqui e cancelar em outro lugar | "✏️ *{Nome}, modo edição*⏎⏎Descreva o que precisa corrigir:…" |
| 73 | `alim.pend.txt_cancelar` | "3/cancelar" | Sirlene | PC:318 | WT | 3 | ASSIN | "❌ *{Nome}, refeição cancelada!*⏎⏎Nenhum dado foi salvo.…" |
| 74 | `alim.pend.txt_erro` | falha ao salvar ou descartar | Sirlene | PC:248, 307 | WT | 3 | ASSIN | "⏳ *{Nome}, não consegui salvar agora.*⏎⏎Responda *1* de novo em alguns instantes.⏎⏎_Sirlene 🥗_" |
| 75 | `alim.edit.modo` | botão editar ou "2" | Sirlene | W:4335-4343 (HEAD:4254) | ATIVO | 2 | SEMNOME PONTO INVENT ASSIN | "✏️ *Modo Edição de Refeição*⏎⏎📋 *Prato atual:*⏎*1.* 🟢 {nome}: {g}g (~{kcal} kcal)…" |
| 76 | `alim.edit.sem_pendencia` | editar sem pendência | sem assinatura | W:4291 (HEAD:4210) | ATIVO | 2 | EMOJI(❌) ASSIN | "❌ Não encontrei uma análise pendente para editar.…" |
| 77 | `alim.edit.atualizado` | aluno escreveu a correção | Sirlene | W:4416-4426 (HEAD:4335) | ATIVO | 2 | iguais ao #52 | "✏️ *Refeição atualizada*⏎{linha}⏎+ cartão…✏️ *2* Corrigir de novo…" |
| 78 | `alim.edit.nao_entendi` | correção ilegível | sem assinatura | W:4434 (HEAD:4353) | ATIVO | 2 | SEMNOME ASSIN | "🤔 Não entendi. Tente novamente:⏎⏎• _"Adiciona banana 100g"_…" |
| 79 | `alim.edit.linhas_correcao` | parser da correção | sem assinatura | W:2151-2199 (IA) e W:2232-2317 (regras) | ATIVO | 2 | PONTO, "item/itens" | "✅ Adicionado: {nome} ({g}g)" / "✅ Removido: {nome}" / "✅ Substituído: {a} → {b}" |
| 80 | `alim.edit.mais` | botão `sofia_edit_more` | sem assinatura | W:3009 (HEAD:2952) | ATIVO | 2 | ASSIN, sem exemplo | "✏️ *Digite outra correção:*⏎⏎📋 {lista numerada}" |
| 81 | `alim.edit.sessao_expirada` | estado `awaiting_food_edit` vencido | sem assinatura | W:867 | ATIVO | 1 | TEC ASSIN | "❌ Sessão expirada. Envie uma nova foto de refeição!" |
| 82 | `alim.edit.pronto` | "pronto" na edição | sem assinatura | W:899-905 | ATIVO | 2 | OPC (pede SIM/NÃO; no resto é 1 e 3) | "✅ *Edição finalizada!*⏎⏎Lista final:…⏎✅ *SIM* para confirmar⏎❌ *NÃO* para cancelar" |
| 83 | `alim.edit.lista_atualizada` | correção aplicada no estado | Sirlene | W:946-955 | ATIVO | 3 | ASSIN ("Sirlene 🥗" no rodapé) | "{mensagem \|\| ✅ Correção aplicada!}⏎⏎Lista atualizada:…⏎Continue editando ou clique em Pronto." |
| 84 | `alim.edit.nao_entendi_estado` | correção ilegível no estado | sem assinatura | W:959-970 | ATIVO | 2 | FALSO ("clique em um botão") | "🤔 Não entendi a correção. Tente:…⏎Ou clique em um botão abaixo." |
| 85 | `alim.edit.registro_nao_encontrado` | registro sumiu | sem assinatura | W:983 | ATIVO | 1 | TEC | "❌ Registro não encontrado. Envie uma nova foto de refeição!" |
| 86 | `alim.cancel.ok` | botão cancelar ou "3" | Sirlene | W:4526-4531 (HEAD:4433) | ATIVO | 2 | SEMNOME ASSIN EMOJI(❌) | "❌ *Refeição cancelada!*⏎⏎Nenhum alimento foi registrado no seu diário.…" |
| 87 | `alim.cancel.sem_pendencia` | cancelar sem pendência | sem assinatura | W:4535 (HEAD:4443) | ATIVO | 1 | ASSIN SEMNOME | "❓ Não encontrei análise pendente para cancelar." |
| 88 | `alim.texto.ia` | texto livre de refeição | Sirlene (IA) | AI:700-732 e prompt AI:1429-1457 | ATIVO | 2 | INVENT (300 kcal padrão quando falha) FALSO (grava sem perguntar) ASSIN (`_Sirlene 💚_`) | ferramenta: "✅ Refeição registrada: {lista} (~{kcal} kcal)" + texto da IA |
| 89 | `alim.texto.fallback_refeicao` | IA sem resposta e texto com alimento | Sirlene | AI:973 | ATIVO | 0 | FALSO ("Já estou guardando os dados", sem gravar) | "Opa, {nome}! 📝 Entendi que você fez essa refeição: "{texto}". Já estou guardando os dados…" |
| 90 | `alim.texto.fallback_outros` | IA sem resposta (saudação, ajuda, genérico) | Sirlene | AI:975-1060 | ATIVO | 2 | ASSIN | "{saudação}, {nome}! 😊⏎⏎Como posso te ajudar hoje?…⏎_Sirlene 💚_" |
| 91 | `alim.audio.ouvi` | áudio transcrito | Sirlene | W:1720 (HEAD:1684) | ATIVO | 3 | SEMNOME | "🎙️ *Ouvi seu áudio!*⏎⏎{resposta}" |
| 92 | `alim.audio.nao_ouvi` | áudio sem transcrição | Sirlene | W:1559 (HEAD:1529) | ATIVO | 3 | ASSIN SEMNOME | "Oi! Não consegui ouvir seu áudio com nitidez dessa vez 🎧…⏎⏎_Sirlene, sua nutricionista virtual 🥗_" |
| 93 | `alim.audio.instabilidade` | erro ao baixar áudio | Sirlene | W:1564 (HEAD:1534) | ATIVO | 3 | ASSIN | "Oi! Tive uma instabilidade ao carregar seu áudio. Poderia me enviar novamente? 🙏…" |
| 94 | `alim.video.recebido` | aluno manda vídeo | sem personagem | W:1240 | ATIVO | 1 | FALSO (pergunta sem opção) ASSIN | "🎬 Vídeo recebido com sucesso! O que você gostaria de fazer com ele?" |
| 95 | `alim.video.erro` | falha no vídeo | sem personagem | W:1243, 1247 | ATIVO | 1 | TEC EMOJI(❌) ASSIN | "❌ Houve um erro ao processar seu vídeo. Por favor, tente novamente." |
| 96 | `foto.galeria.sem_conta` | foto que não é comida nem exame, sem conta | Rafael (rodapé) | W:2537 | ATIVO | 1 | ASSIN | "📸 Foto recebida! Crie sua conta no app para guardar suas memórias de treino." |
| 97 | `foto.galeria.classificar` | foto salva na galeria | Rafael | W:2590 | ATIVO | 1 | PERS (rodapé fixo "Rafael 🏃" para todos) OPC | "📸 *Foto salva na sua galeria!*⏎⏎Qual o tipo dessa foto?…" |
| 98 | `foto.galeria.onde_guardar` | opção "Outra" | Rafael | W:2653 | ATIVO | 1 | PERS OPC | "📷 *Outra foto*⏎⏎Onde quer guardar?…" |
| 99 | `foto.galeria.salva` | escolha feita | sem assinatura | W:2642, 2647, 2727, 2733, 2738 | ATIVO | 2 | ASSIN | "🏃 *Registro de atividade salvo!*⏎⏎Veja sua galeria de memórias no app! 📱" |
| 100 | `foto.galeria.erros` | falha ao salvar ou classificar | sem assinatura | W:2580, 2604, 2630, 2690, 2721, 2765 | ATIVO | 1 | TEC ("Usuário não encontrado") | "❌ Houve um erro ao salvar sua foto. Por favor, tente novamente." |
| 101 | `nutri.cardapio_enviado` | app manda o cardápio | Sirlene | SMP:117-133 | ATIVO | 1 | MARCA (`https://maxnutrition.app/...`) CAIXA PONTO ASSIN ("Sirlene Nutricional • eLiving Private Health") | "🌿 *ELIVING CONCIERGE • CARDÁPIO {SEMANAL 360°\|DO DIA}* 🌿⏎⏎Olá, *{nome}*!…" |
| 102 | `nutri.cardapio_imagem_legenda` | imagem do cardápio | sem assinatura | SMP:76 | ATIVO | 3 | NOMEC ASSIN | "🍽️ Cardápio de {nome}" |
| 103 | `nutri.cardapio_botao` (6 botões) | `menu_meal_plan`, `meal_accept`, `meal_change`, `meal_recipe`, `meal_shopping` | Sirlene | BH:849-960, acionados em W:2812-2966 | ATIVO | 0 | FALSO (cardápio igual para todos; "Salvei" sem salvar) | "✅ Cardápio Salvo!⏎Ótimo! Salvei essa sugestão de cardápio para você.…" |
| 104 | `nutri.dicas` | `sofia_tips`, `menu_tips` | Sirlene | BH:817 | ATIVO | 2 | ASSIN, genérico | "💡 Dicas Nutricionais⏎Aqui vão algumas dicas para você:…" |
| 105 | `nutri.lista_compras_app` | botão "Abrir no WhatsApp" | Sirlene | `src/lib/shopping-list/share-format.ts:26-95` | APP | 2 | REG CAIXA ASSIN | "🛒 *LISTA DE MERCADO · SIRLENE*⏎━━━━━━━━━━━━━━━━━━━━⏎📋 *{título}*…✨ _Sirlene Nutricional · eLiving_" |
| 106 | `nutri.receita_app` | compartilhar receita | sem assinatura | `RecipeSharePremiumModal.tsx:59-71` | APP | 3 | ASSIN | "🍽️ *{título}*⏎{descrição}⏎⏱️ {n} min · 🔥 {n} kcal⏎⏎Veja a receita completa…" |
| 107 | `nutri.convite_app` | convite da página Nutrição | eLiving | `NutritionDossierPage.tsx:414` | APP | 3 | — | "Conheça as ferramentas de alimentação da Sirlene no eLiving." |
| 108 | `nutri.oi_sirlene_app` | botão "Falar com a Sirlene" | aluno | `SirlenePrimaryAction.tsx:37` | APP | 3 | — | "Oi Sirlene, quero registrar minha alimentação." |
| 109 | `alim.app.resultado_job` | análise gravada no job e no chat do app | Sirlene | SI:2668-2672 (HEAD:2639) | APP | 2 | NOMEC 2AST PONTO | "Oi {nome}! 😊⏎⏎📸 **Analisei sua refeição e identifiquei:**…🤔 Esses alimentos estão corretos?" |
| 110 | `alim.app.sem_comida` (3 textos) | análise sem comida | Sirlene | SI:2468, 2483-2490, 2673 | APP | 1 | 2AST, "amor", "querido(a)" | "Oi {nome}! 😊 Não consegui ver claramente os alimentos…💡 **Dicas para uma melhor análise:**…" |
| 111 | `alim.app.falha_leitura` (3) | falha da leitura | sem assinatura | `foto-prato-leitura.ts:21-24` | WT | 3 | SEMNOME ASSIN | "Não consegui ler sua foto agora. Tente de novo em alguns minutos ou me diga o que comeu." |
| 112 | `alim.app.excecao` | exceção em SI | sem assinatura | SI:2873 (HEAD:2844) | APP | 2 | ASSIN | "Ops! Não consegui analisar sua foto agora. Pode me contar o que você está comendo? 📸😊" |

### 3.3 Registros: legado e código sem chamador

| # | id | Gatilho | Fala | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 113 | `legado.alim.createSofia` (9 modelos) | botões antigos | Sirlene | IT:191-475 (`createSofiaAnalysisComplete`, `PostConfirm`, `EditPrompt`, `EditMenu`, `AddFoodPrompt`, `RemoveFoodMenu`, `ChangeQuantityMenu`, `EditSuccess`, `Details`) | MORTO | 0 | INVENT ("Score nutricional /100" com 🔴) | — |
| 114 | `legado.alim.createErrorMessage` | — | — | IT:923 | MORTO | 0 | — | — |
| 115 | `legado.vps.webhook` | se a Evolution apontar para a VPS | eLiving | `vps-backend/src/routes/whatsapp.js:374-624` | INCERTO | 0 | FALSO ("📊 Funcionalidade em desenvolvimento!") | "✅ Refeição confirmada e registrada!" / "Peso registrado: …" |

### 3.4 Registros: banco (categorias `sofia-alimentacao` e `Sofia - Alimentação`, 16 linhas, todas BANCO)

| # | id | template_key | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|
| 116 | `alim.banco.analysis_complete` | `sofia_analysis_complete` | 2 | SOFIA INVENT PONTO | H "🍽️ Análise Nutricional" B "✅ *Refeição analisada!*⏎⏎🍽️ *{{foods}}*…" F "🌿 Sofia" |
| 117 | `alim.banco.post_confirm` | `sofia_post_confirm` | 2 | SOFIA | "✅ *Refeição registrada!*⏎⏎🍽️ *{{mealType}}* salv{{genderSuffix}} com sucesso!…" |
| 118 | `alim.banco.edit_prompt` | `sofia_edit_prompt` | 3 | SOFIA | "✏️ *Vamos corrigir!*⏎⏎Me conte o que está diferente na sua refeição.…" |
| 119 | `alim.banco.details` | `sofia_details` | 2 | SOFIA INVENT (sódio e potássio que ninguém calcula) | H "📊 Detalhes Nutricionais" B "🍽️ *{{foods}}*⏎⏎*Macronutrientes:*…" |
| 120 | `alim.banco.waiting_image` | `sofia_waiting_image` | 3 | SOFIA | "📸 *Envie uma foto da sua refeição!*⏎⏎Posso analisar:…" |
| 121 | `alim.banco.error_no_food` | `sofia_error_no_food` | 3 | SOFIA | "🤔 *Hmm, não consegui identificar alimentos nessa imagem.*…" |
| 122 | `alim.banco.meal_confirmed` | `sofia_meal_confirmed` | 2 | SOFIA CAIXA | "✅ *Refeição Registrada!* 💚⏎⏎📊 *NUTRIENTES:*…⏎_Sofia 💚_" |
| 123 | `alim.banco.meal_cancelled` | `sofia_meal_cancelled` | 3 | SOFIA | "❌ *Registro cancelado!*⏎⏎Tudo bem!…⏎_Sofia 💚_" |
| 124 | `alim.banco.edit_mode` | `sofia_edit_mode` | 2 | SOFIA | "✏️ *Modo edição* 💚⏎⏎📋 *Itens detectados:*…" |
| 125 | `alim.banco.food_added` | `sofia_food_added` | 2 | SOFIA | "✅ *Adicionado!* 💚⏎⏎📋 *Lista atualizada:*…" |
| 126 | `alim.banco.food_removed` | `sofia_food_removed` | 2 | SOFIA | "🗑️ *Removido!* 💚…" |
| 127 | `alim.banco.food_replaced` | `sofia_food_replaced` | 2 | SOFIA | "🔄 *Trocado!* 💚…" |
| 128 | `alim.banco.pending_reminder` | `sofia_pending_reminder` | 2 | CULPA ("⚠️ Pendência ativa") | "⚠️ *Pendência ativa* 💚⏎⏎Você ainda tem uma refeição aguardando confirmação:…" |
| 129 | `alim.banco.photo_error` | `sofia_photo_error` | 2 | SOFIA EMOJI(❌ 😔) | "❌ *Não consegui analisar esta foto* 😔…" |
| 130 | `alim.banco.no_food_detected` | `sofia_no_food_detected` | 3 | SOFIA | "🤔 *Não consegui identificar alimentos nesta foto*…" |
| 131 | `alim.banco.ambiguous` | `sofia_ambiguous` | 2 | botões com id `sofia_*` | "🤔 *Não entendi o que você quer fazer...*⏎⏎Escolha uma opção:" |

### 3.5 Já no padrão premium, ainda desligado (`_shared/whatsapp/foto-prato-mensagens.ts`, WT)

Estas 9 mensagens seguem o padrão. Só valem depois de ligadas no webhook, no worker (cópia em `vps-backend/src/ai-worker/src/utils/fotoPratoMensagens.ts`) e na fila de reserva. Elas substituem as linhas 50 a 87 que tratam da foto.

| # | id | Função | Substitui | Nota |
|---|---|---|---|---|
| 132 | `alim.v2.recebimento` | `mensagemRecebimento` | #50 | 5 |
| 133 | `alim.v2.aviso_demora` | `mensagemAvisoDemora` | (novo) | 5 |
| 134 | `alim.v2.resultado` (completo e "itens a confirmar") | `mensagemResultado` / `montarResultadoPrato` | #52, #60, #64, #77 | 5 |
| 135 | `alim.v2.corrigir` | `mensagemCorrigir` | #72, #75 | 5 |
| 136 | `alim.v2.salvo` (com meta, sem meta, parcial) | `mensagemSalvo` | #67, #71 | 5 |
| 137 | `alim.v2.descartado` | `mensagemDescartado` | #73, #86 | 5 |
| 138 | `alim.v2.falha_ao_salvar` | `mensagemFalhaAoSalvar` | #69, #74 | 5 |
| 139 | `alim.v2.falha_leitura` (cota, sem alimento, imagem inválida) | `mensagemFalhaLeitura` | #53 a #59, #61 a #63, #65 | 5 |
| 140 | `alim.v2.botoes` | `botoesDoModo` | rótulos 1, 2 e 3 de #52 e #77 | 5 |

---

## 4. Acompanhamento: água, sono, humor, exercício, peso e resumo do dia

### 4.1 Do início ao fim (como o aluno vê hoje)

- **Água por botão:** o consumo é gravado. A confirmação `agua.confirmacao` é barrada (G15), então o aluno não recebe nada.
- **Água por texto ("bebi 500ml"):** a IA grava só em `advanced_daily_tracking` e responde com `agua.texto_ia`.
- **Sono, humor e exercício:**
  - os lembretes proativos estão desligados;
  - se o aluno toca num botão antigo, recebe só os textos simples do HT (`sono.vou_dormir_agora`, `humor.nota_*`, `exercicio.nao_fiz`);
  - os modelos completos não chegam (G3).
- **Peso:** "Registrar peso" chama `peso.pedir_peso`, que é barrado. Mesmo que chegasse, o número digitado não tem leitor (G10). Por texto, a IA grava e responde `peso.texto_ia`.
- **Resumo do dia e lembrete de refeição:** desligados.

### 4.2 Registros

| # | id | Gatilho | Fala [correto] | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 141 | `agua.confirmacao` | botão +250 ou +500 ml | Sirlene | IT:1000, chamado em W:4641 com `goal: 2500` | BARRADO | 3 | INVENT (meta fixa) PONTO OPC ASSIN CAIXA ("*PARABÉNS!*") | "✅ *+{n}ml registrado!*⏎⏎💧 *Total hoje:* {t}ml / {g}ml⏎{barra} {pct}%…" |
| 142 | `agua.ainda_nao` | botão "Ainda não" | Sirlene | IT:1037, chamado em W:4675 | BARRADO | 1 | FALSO ("Vou te lembrar novamente em breve") | "⏰ *Tudo bem!*⏎⏎Vou te lembrar novamente em breve.…" |
| 143 | `agua.semana` | botão "Ver semana" | Sirlene | IT:1059, chamado em W:4730 | BARRADO | 2 | INVENT CULPA (🔴) PONTO | "📊 *Consumo da Semana:*⏎⏎{✅/🟡/🔴} {Dia}: {n}ml ({pct}%)…" |
| 144 | `agua.pos_exercicio` | exercício concluído | Sirlene | IT:1098 | QUEBRADO | 0 | INVENT ("500ml nas próximas 2 horas") | "💪 Ótimo Treino!… 💧 *Não esqueça de se hidratar!*…" |
| 145 | `agua.texto_ia` | "bebi 500ml" | Sirlene (IA) | AI:497-514 | ATIVO | 2 | PONTO ASSIN; grava fora da RPC atômica | "💧 Água registrada: +{n}ml (Total: {t}ml)" + texto da IA |
| 146 | `agua.lembrete` | cron (scheduler, 9, 11, 14, 16 e 19 h) | Sirlene | IT:967, chamado em SCH:383-392 | DESLIGADO | 2 | NOMEC OPC EMOJI(❌ "Ainda não") ASSIN | "💧 Hora de Hidratar!" / "{full_name}, já bebeu água? 💦…" |
| 147 | `agua.lembrete_vps` | cron da VPS | Sirlene | `vps-backend/src/services/cron.js:122` e `whatsapp.js` (`waterReminder`) | DESLIGADO | 1 | INVENT ASSIN | "💧 Olá {nome}!⏎⏎Você bebeu {n}ml de água hoje.⏎Meta: {n}ml⏎⏎Bora hidratar? 🚰" |
| 148 | `agua.lembrete_smart` | SR `type=water` | Sirlene | SR:134-146 | DESLIGADO | 3 | PONTO ("1.5L") INVENT ("Metabolismo ativo") ASSIN | "*{nome}*, um lembrete com carinho! 💧⏎⏎Você bebeu {x}L de água hoje.…" |
| 149 | `agua.hidratacao_manha` | SR `morning-hydration` | Sirlene | SR:257 | DESLIGADO | 1 | LONGO? INVENT ("7 a 8 horas", "400 a 500ml", "gasto calórico basal") | "Bom dia, *{nome}*! ☀️🌿⏎⏎Seu corpo passou 7 a 8 horas em repouso…" |
| 150 | `nutri.lanche_tarde` | SR `afternoon-craving` | Sirlene | SR:239 | DESLIGADO | 1 | CULPA ("Seu objetivo vale muito mais que 2 minutos de doce") INVENT | "*{nome}*, passou das 15h e bateu aquela vontade de beliscar? 🍏✨…" |
| 151 | `sono.desacelerar` | SR `evening-winddown` | Sirlene [Rafael] | SR:276 | DESLIGADO | 1 | PERS INVENT ("queima de gordura", "acalma o cortisol") | "Boa noite, *{nome}*! 🌙✨⏎⏎O dia foi produtivo e você deu o seu melhor.…" |
| 152 | `sono.lembrete_deitar` | cron do scheduler | Dr. Vital [Rafael] | IT:1123 | DESLIGADO | 2 | PERS NOMEC EMOJI | "😴 Hora de Dormir!" / "{nome}, está na hora de pensar em descansar! 😴…" |
| 153 | `sono.bom_dia` | 30 min depois do horário de acordar | Dr. Vital [Rafael] | IT:1168 | DESLIGADO | 2 | PERS NOMEC OPC | "Bom dia, {nome}! ☀️⏎⏎Você registrou que foi dormir às {bedtime}.…" |
| 154 | `sono.qualidade_prompt` | botão de sono | Dr. Vital [Rafael] | IT:1201 | QUEBRADO | 0 | PERS | — |
| 155 | `sono.qualidade_confirma` | qualidade escolhida | Dr. Vital [Rafael] | IT:1248 | QUEBRADO | 0 | PERS | — |
| 156 | `sono.semana` | "ver semana" | Dr. Vital [Rafael] | IT:1295 | QUEBRADO | 0 | CULPA ("Pior noite", "Sono abaixo do recomendado") | — |
| 157 | `sono.dicas` | botão "Dicas de sono" | Dr. Vital [Rafael] | IT:1373 | QUEBRADO | 0 | PERS | — |
| 158 | `sono.depois` | botão "Mais tarde" | Dr. Vital [Rafael] | IT:1411 | QUEBRADO | 0 | PERS | — |
| 159 | `sono.vou_dormir_agora` | botão "Vou dormir agora" | sem assinatura | HT:76 | ATIVO | 3 | FALSO ("Amanhã te pergunto", com o proativo desligado) ASSIN | "✅ Boa noite! Registrei que você vai dormir às {HH:MM}. Amanhã te pergunto que horas acordou! 😴" |
| 160 | `sono.sem_registro` | atualizar sono sem registro | sem assinatura | HT:122, 184 | ATIVO | 2 | TEC EMOJI(❌) | "❌ Não encontrei um registro de sono para atualizar. Você registrou que foi dormir?" |
| 161 | `humor.checkin` | cron | Dr. Vital [Rafael] | IT:1441 | DESLIGADO | 2 | PERS NOMEC OPC | "😊 Check-in Diário" / "{nome}, como você está se sentindo hoje? 😊…" |
| 162 | `humor.resposta_positiva` | humor bom | Dr. Vital [Rafael] | IT:1478 | QUEBRADO | 0 | PERS | — |
| 163 | `humor.resposta_negativa` | humor baixo | Dr. Vital [Rafael] | IT:1517 | QUEBRADO | 0 | PERS, tom clínico ("Você está assim há N dias seguidos") | — |
| 164 | `humor.resposta_padrao` | outro humor | Dr. Vital [Rafael] | IT:1566 | QUEBRADO | 0 | PERS | — |
| 165 | `humor.nota_pedir` | botão "escrever nota" | sem assinatura | HT:333 | ATIVO | 3 | ASSIN | "📝 Pode escrever! Me conte como você está se sentindo..." |
| 166 | `humor.nota_registrada` | nota enviada | sem assinatura | HT:758 | ATIVO | 3 | ASSIN | "✅ Nota registrada! Obrigado por compartilhar. Estou aqui se precisar conversar. 💙" |
| 167 | `humor.checkin_diario` | `templateType:'daily_checkin'` | eLiving [Rafael] | IT:677 (`createDailyCheckin`) | BARRADO e DESLIGADO | 3 | NOMEC OPC ASSIN | "☀️ Bom dia, {nome}!" / "Como você está se sentindo hoje?…" |
| 168 | `exercicio.checkin` | cron | Dr. Vital [Alex] | IT:1595 | DESLIGADO | 1 | PERS NOMEC EMOJI(❌ "Não fiz") | "💪 Exercício Hoje?" / "{nome}, fez exercício hoje? 💪⏎⏎Me conta como foi:" |
| 169 | `exercicio.intensidade` | "Sim, fiz" | Dr. Vital [Alex] | IT:1625 | QUEBRADO | 0 | PERS | — |
| 170 | `exercicio.duracao` | intensidade escolhida | Dr. Vital [Alex] | IT:1650 | QUEBRADO | 0 | PERS | — |
| 171 | `exercicio.completo` | duração informada | Dr. Vital [Alex] | IT:1681 | QUEBRADO | 0 | PERS | — |
| 172 | `exercicio.semana` | "ver semana" | Dr. Vital [Alex] | IT:1734 | QUEBRADO | 0 | CULPA ("Que tal começar esta semana?") | — |
| 173 | `exercicio.nao_fiz` | botão "Não fiz" | sem assinatura | HT:383 | ATIVO | 3 | ASSIN | "👍 Tudo bem! Descanso também é importante. Amanhã é um novo dia! 💪" |
| 174 | `exercicio.duracao_invalida` | duração ilegível | sem assinatura | HT:617 | ATIVO | 2 | EMOJI(❌) ASSIN | "❌ Não consegui entender a duração. Por favor, digite apenas o número de minutos (ex: 30)…" |
| 175 | `exercicio.dicas` | `menu_health_tips` | Dr. Vital [Alex] | BH:1116 | ATIVO | 2 | PERS ASSIN | "💪 Motivação & Dicas⏎🏃 *Por que se exercitar?*…" |
| 176 | `saude.lembrete_medicacao` | — | Dr. Vital | IT:1798 (`createMedicationReminder`) | MORTO | 2 | opção "Não vou tomar" sem cuidado | "💊 Hora do Medicamento!" / "⏰ *Lembrete de medicação*…" |
| 177 | `peso.lembrete_semanal` | botão ou cron | Dr. Vital [Sirlene] | IT:2075, chamado em W:4846; VPS `cron.js:171` | BARRADO e DESLIGADO | 2 | CULPA ("Há N dias") NOMEC PERS PONTO | "⚖️ Hora da Pesagem Semanal!" / "{nome}, é dia de atualizar seus dados! 📊…" |
| 178 | `peso.pedir_peso` | "Registrar peso" | Dr. Vital [Sirlene] | IT:2115, chamado em W:4789 | BARRADO | 1 | PONTO ("72.5"); a resposta não tem leitor (G10) | "⚖️ *Qual seu peso atual?*⏎⏎Digite apenas o número em kg.…• 72.5…" |
| 179 | `peso.pedir_cintura` | depois do peso | Dr. Vital [Sirlene] | IT (`weighing_prompt_waist`), `whatsapp-send-interactive:203` | ATIVO depois do L6 (o leitor do peso existe, G10) | 2 | PERS | — |
| 180 | `peso.registrado` | peso informado | Dr. Vital [Sirlene] | IT (`weighing_complete`), `whatsapp-send-interactive:212` | ATIVO depois do L6 (o leitor do peso existe, G10) | 2 | PONTO | — |
| 181 | `peso.depois` | "Lembrar amanhã" | Dr. Vital [Sirlene] | IT:2256, chamado em W:4812 | BARRADO | 1 | FALSO ("Vou te lembrar amanhã", sem agendamento) | — |
| 182 | `peso.evolucao` | "Ver evolução" | Dr. Vital [Sirlene] | IT:2210, chamado em W:4872 | BARRADO | 2 | CULPA ("ganhou N kg", "Vamos ajustar a estratégia?") PONTO | — |
| 183 | `peso.texto_ia` | "peso 72" | Sirlene (IA) | AI:489 | ATIVO | 2 | PONTO ("72kg") | "✅ Peso registrado: 72kg" + texto da IA |
| 184 | `peso.lembrete_smart` | SR `type=weighing` | Sirlene | SR:112 | DESLIGADO | 3 | EMOJI ASSIN | "*{nome}*, é dia de pesagem! ⚖️⏎⏎Sua pesagem semanal está esperando por você! 💚…" |
| 185 | `nutri.lembrete_refeicao` (4 refeições) | cron NC | Sirlene | NC:12-37 e NC:222-232 | DESLIGADO | 3 | ASSIN ("Com carinho,⏎Sirlene 💚⏎_eLiving_") CULPA leve ("Já tomou café da manhã?") | "*{nome}*, {Bom dia\|Boa tarde\|E aí\|Boa noite}! {emoji}⏎⏎{pergunta}…" |
| 186 | `nutri.resumo_dia` | cron NDS | Sirlene | NDS:163-193 (envio direto em NDS:198, fora do guarda) | DESLIGADO | 1 | INVENT (2.000 kcal e 2.000 ml padrão; lógica de déficit invertida) PONTO CULPA ("⚠️", "Lembre-se de me contar") | "*{nome}*, seu dia alimentar! 📊⏎⏎☕ Café: {n} kcal…" |

### 4.3 Registros: banco (categorias `agua`, `humor`, `exercicio`, `sono`, `peso`, 19 linhas, todas BANCO e com rodapé "🌿 Sofia")

| # | id | template_key | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|
| 187 | `agua.banco.goal_reached` | `water_goal_reached` | 2 | SOFIA CAIXA | "💧 *META ATINGIDA!* 🎉⏎⏎{{userName}}, você bebeu {{totalToday}}ml hoje!…" |
| 188 | `agua.banco.reminder` | `water_reminder` | 2 | SOFIA, rótulos diferentes do código | "{{userName}}, já bebeu água? 💦⏎⏎📊 *Seu progresso hoje:*…" |
| 189 | `agua.banco.confirmation` | `water_confirmation` | 3 | SOFIA | "💧 *+{{amount}}ml registrado!*…" |
| 190 | `agua.banco.weekly` | `water_weekly` | 3 | SOFIA | "💧 *Sua hidratação esta semana:*…" |
| 191 | `humor.banco.positive` | `mood_positive_response` | 2 | SOFIA, empurra tarefas | "😊 *Que ótimo, {{userName}}!*…" |
| 192 | `humor.banco.negative` | `mood_negative_response` | 3 | SOFIA | "💚 *Entendo, {{userName}}.*⏎⏎Todos temos dias assim.…" |
| 193 | `humor.banco.checkin` | `mood_daily_checkin` | 3 | SOFIA | "{{userName}}, como está se sentindo agora?…" |
| 194 | `exercicio.banco.complete` | `exercise_complete` | 2 | SOFIA PERS INVENT | "💪 *Treino salvo!*⏎⏎🏃 {{exerciseType}}…🔥 ~{{caloriesBurned}} kcal queimadas…" |
| 195 | `exercicio.banco.start` | `exercise_start` | 2 | SOFIA PERS | "{{userName}}, fez algum exercício hoje? 🏃…" |
| 196 | `exercicio.banco.intensity` | `exercise_intensity_prompt` | 3 | SOFIA PERS | "Legal! Qual foi a intensidade do seu treino?…" |
| 197 | `exercicio.banco.duration` | `exercise_duration_prompt` | 3 | SOFIA PERS | "Ótimo! Por quanto tempo você se exercitou?" |
| 198 | `exercicio.banco.motivation` | `exercise_motivation` | 3 | SOFIA PERS | "💪 *Sem problemas, {{userName}}!*…" |
| 199 | `sono.banco.bedtime` | `sleep_bedtime` | 2 | SOFIA PERS | "{{userName}}, está na hora de preparar para dormir! 😴…" |
| 200 | `sono.banco.morning` | `sleep_morning_check` | 3 | SOFIA PERS | "{{userName}}, como foi seu sono? 😊…" |
| 201 | `sono.banco.quality_confirm` | `sleep_quality_confirm` | 3 | SOFIA PERS | "✅ *Sono registrado!*…" |
| 202 | `sono.banco.weekly` | `sleep_weekly` | 2 | SOFIA CULPA ("Noites boas: x/7") | "😴 *Resumo do sono:*…" |
| 203 | `peso.banco.reminder` | `weighing_reminder` | 3 | SOFIA | "{{userName}}, é dia de acompanhar seu progresso! 📊…" |
| 204 | `peso.banco.complete` | `weighing_complete` | 2 | SOFIA PONTO | "⚖️ *Peso registrado!*⏎⏎📊 Hoje: {{currentWeight}}kg…" |
| 205 | `peso.banco.evolution` | `weighing_evolution` | 3 | SOFIA | "⚖️ *Histórico de peso:*…" |

---

## 5. Exames (Dr. Vital)

### 5.1 Do início ao fim (como o aluno vê hoje)

**Foto de exame (caminho vivo)**
1. Duas mensagens chegam quase juntas: `alim.foto.recebido` (`_eLiving_`) e `exame.recebimento.primeira_foto` (`_Dr. Vital 🩺_`).
2. O aluno manda mais fotos. Doze segundos depois chega `exame.lote.pergunta_tipo_botoes`. O cron pode repetir a pergunta com `exame.lote.pergunta_tipo_cron`, em que a opção 2 tem outro significado.
3. As respostas possíveis:
   - "1 Exame": `exame.senha.pedir_botao`, depois `exame.senha.gerada` ou `exame.senha.pedir_texto` e `exame.analise.iniciada`;
   - "2 Receita": `exame.receita.recebida`;
   - "3 Cancelar": `exame.lote.cancelado`.
4. Resultado (worker da VPS):
   - `exame.resultado.laudo_pronto`, com link e senha no mesmo texto;
   - ou `exame.receita.pronta`;
   - ou `exame.erro.relatorio_nao_gerado`.
5. Não há resumo, alerta de valor crítico nem pergunta de acompanhamento. O botão "Perguntar" não tem resposta (`exame.pos.pergunta_prompt`).

**PDF:** chega `exame.recebimento.documento_pdf`. O PDF não passa por senha, mas o laudo final diz "Use a senha de 6 dígitos que você criou".

**Pelo app (`whatsapp-medical-handler`):** sai `exame.handler.analise_iniciada`, seguido de `exame.handler.laudo_pronto` (WT, a versão mais segura, com a senha fora do texto) ou de `exame.handler.erro`.

**Texto livre de saúde:** a IA responde como Dr. Vital (`exame.conversa.resposta_ia`).

### 5.2 Registros

| # | id | Gatilho | Fala | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 206 | `exame.recebimento.primeira_foto` | 1.ª foto do lote classificada como exame | Dr. Vital | W:5761 | ATIVO | 2 | ASSIN SEMNOME EMOJI; duplica #50 | "🩺 *Recebi sua foto!*⏎⏎📸 Envie mais fotos se tiver (exame ou receita).…⏎_Dr. Vital 🩺_" |
| 207 | `exame.recebimento.documento_pdf` | PDF ou documento | Dr. Vital | W:1175 (HEAD:1150) | ATIVO | 2 | ASSIN SEMNOME FALSO (depois pede senha que não existe) | "📄 *Recebi seu documento!* Estou analisando com cuidado. 🔬…" |
| 208 | `exame.erro.documento` | falha ao enfileirar PDF | Dr. Vital | W:1168, 1184 | ATIVO | 2 | TEC ASSIN | "❌ Erro ao processar o documento. Tente novamente em instantes.⏎⏎_Dr. Vital 🩺_" |
| 209 | `exame.erro.imagem_lote` | falha ao criar lote (limite de 1 a cada 60 s) | Dr. Vital | W:5745 | ATIVO | 2 | TEC ASSIN | "❌ Erro ao processar imagem. Tente novamente.⏎⏎_Dr. Vital 🩺_" |
| 210 | `exame.lote.pergunta_tipo_botoes` | 12 s sem nova foto | Dr. Vital | W:5863-5871 | ATIVO | 3 | OPC ASSIN SEMNOME | "*🩺 Documentos recebidos*⏎⏎📋 *3 fotos recebidas*⏎⏎O que você enviou?⏎⏎Responda com o número:⏎1. 📊 Exame⏎2. 📋 Receita⏎3. ❌ Cancelar" |
| 211 | `exame.lote.pergunta_tipo_texto` | botões falham | Dr. Vital | W:5878 | ATIVO (reserva) | 1 | OPC (o "2 Receita" é lido como "mais fotos") CAIXA ASSIN | "📋 *N fotos recebidas*⏎⏎*O que você enviou?*⏎⏎1️⃣ *EXAME*…2️⃣ *RECEITA*…3️⃣ *ENVIAR MAIS* fotos" |
| 212 | `exame.lote.pergunta_tipo_cron` | lote parado há mais de 30 s | Dr. Vital | `medical-batch-timeout/index.ts:221-229` | ATIVO se o cron existir | 1 | OPC FALSO (chama de exame antes de perguntar), duplica #210 | "📋 *N foto de exame recebida*⏎⏎📋 *O que você enviou?*…" |
| 213 | `exame.lote.mais_fotos_botao` | botão "enviar mais" | Dr. Vital | W:5347 | ATIVO | 2,5 | ASSIN SEMNOME | "📸 *Continue enviando!*⏎⏎Envie mais fotos (exame ou receita).…" |
| 214 | `exame.lote.mais_fotos_texto` | texto "2" | Dr. Vital | W:5538 | ATIVO | 2 | FALSO ("me avise", mas o sistema pergunta sozinho) | "📸 *Ok! Continue enviando as fotos.*⏎⏎Quando terminar, me avise!…" |
| 215 | `exame.lote.cancelado` | cancelar | Dr. Vital | W:5375, 5554 | ATIVO | 2,5 | EMOJI(❌) SEMNOME ASSIN | "❌ *Análise cancelada*⏎⏎Quando quiser, envie novas fotos!⏎⏎_Dr. Vital 🩺_" |
| 216 | `exame.lote.sem_pendente` | botão sem lote | Dr. Vital | W:5241, 5302 | ATIVO | 2,5 | ASSIN | "❓ Não encontrei documentos pendentes.⏎⏎Envie uma nova foto para começar." |
| 217 | `exame.erro.usuario_nao_encontrado` | perfil não achado | Dr. Vital | W:5224, 5286, 5331, 5359 | ATIVO | 1 | TEC | "❌ Usuário não encontrado.⏎⏎_Dr. Vital 🩺_" |
| 218 | `exame.senha.pedir_botao` | escolheu Exame | Dr. Vital | W:5261, 5504 | ATIVO | 2,5 | OPC (uma opção só), TEC ("LGPD") SEMNOME | "🔐 *Segurança do Relatório*⏎⏎📋 N imagens prontas para análise.…" botão "🔐 Gerar senha automática" |
| 219 | `exame.senha.pedir_texto` | botões falham | Dr. Vital | W:5270, 5513; cópia em BH:320, 2391 | ATIVO | 3 | REG SEMNOME ("123456" solto parece a senha) | "*Senha do laudo*⏎⏎N imagens prontas.⏎⏎━━━━━━━━━━━━━━━━⏎⏎Digite 6 números.…_Dr. Vital · eLiving_" |
| 220 | `exame.senha.gerada` | "Gerar senha automática" | Dr. Vital | W:5408 | ATIVO | 3,5 | SEMNOME | "*Senha do laudo*⏎⏎{6 dígitos}⏎⏎Copie os 6 números e guarde.⏎O laudo chega em alguns minutos.⏎⏎_Dr. Vital · eLiving_" |
| 221 | `exame.senha.invalida` | senha fora do formato | Dr. Vital | W:5470 | ATIVO | 2,5 | EMOJI(❌) ASSIN | "❌ *Senha inválida*⏎⏎Digite *exatamente 6 dígitos* (apenas números).…" |
| 222 | `exame.analise.iniciada` | senha válida | Dr. Vital | W:5454 | ATIVO | 3 | ASSIN SEMNOME; prazo diferente das outras ("2-5 minutos") | "🩺 *Dr. Vital está analisando...*⏎⏎⏱️ Pode levar 2-5 minutos.…" |
| 223 | `exame.receita.recebida` | escolheu Receita | Dr. Vital | W:5318 | ATIVO | 3,5 | SEMNOME | "*Receita recebida*⏎⏎Estou organizando o documento.⏎Não precisa de senha.…⏎_Dr. Vital · eLiving_" |
| 224 | `exame.erro.sem_senha_pendente` | botão sem lote aguardando senha | Dr. Vital | W:5389 | ATIVO | 2 | EMOJI(❌) ASSIN | "❌ Não encontrei relatório aguardando senha.…" |
| 225 | `exame.resultado.laudo_pronto` | worker termina o exame | Dr. Vital | WC:296-301 (código em ~284) | ATIVO | 2,5 | REG SEMNOME; senha junto do link; sem resumo; FALSO para PDF | "🩺 *Laudo pronto*⏎⏎━━━━━━━━━━━━━━━━⏎⏎{publicUrl}⏎⏎*Código para abrir o laudo*⏎{6 dígitos}…" |
| 226 | `exame.receita.pronta` | worker termina a receita | Dr. Vital | WC:288-294 | ATIVO (WT difere) | 3 | REG SEMNOME | WT: "📄 *Receita pronta*⏎⏎━━━━━━━━━━━━━━━━⏎⏎📲 Para ver, entre no app eLiving:…"; HEAD: "…Abra o link. Não precisa de senha." |
| 227 | `exame.erro.relatorio_nao_gerado` | worker sem `publicUrl` | Dr. Vital | WC:325-330 | ATIVO | 2,5 | ASSIN, voz plural | "⚠️ *Ops! Houve um problema.*⏎⏎Não conseguimos gerar o relatório do seu exame.…" |
| 228 | `exame.resultado.laudo_cache` | cache de `enqueue-analysis` | Dr. Vital | W:6010-6018 (HEAD:5915) | quase MORTO (`useCache:false`) | 1,5 | REG CAIXA FALSO ("Laudo de Luxo Certificado", "link permanente") | "🩺 *LAUDO MÉDICO CONCIERGE — DR. VITAL*⏎━━━…" |
| 229 | `exame.erro.enfileirar` | falha na fila | Dr. Vital | W:6042 | ATIVO | 2 | CULPA (culpa a foto) ASSIN | "❌ *Erro na análise*⏎⏎Tente enviar fotos mais nítidas.…" |
| 230 | `exame.handler.analise_iniciada` | app chama `process_exam` | sem personagem | `whatsapp-medical-handler/index.ts:68-70` (HEAD:66) | ATIVO | 2 | FALSO ("alguns segundos") ASSIN | "🔬 *Analisando seu exame...*⏎⏎Isso pode levar alguns segundos. Aguarde!" |
| 231 | `exame.handler.laudo_pronto` | fim da análise pelo app | Dr. Vital | `laudo-protegido.ts` (WT), enviado em `whatsapp-medical-handler/index.ts:319` | WT (o HEAD usa o texto "CONCIERGE" + PDF) | 3 | REG SEMNOME ASSIN (`•`) | "🩺 *Seu laudo do Dr. Vital está pronto*⏎━━━⏎📋 *Exame:* {tipo}…" |
| 232 | `exame.handler.erro` | falha | sem personagem | `whatsapp-medical-handler/index.ts:342-345` (HEAD:399) | ATIVO | 2 | ASSIN TEC ("plataforma", "entre em contato" sem canal) | "❌ *Ops! Houve um problema.*⏎⏎Não consegui processar seu exame.…" |
| 233 | `exame.pos.entendi` | botão `vital_understood` | Dr. Vital | BH:975 | MORTO na prática (o botão nunca é enviado) | 2,5 | ASSIN | "✅ Ótimo!" / "Fico feliz que você entendeu!…" |
| 234 | `exame.pos.relatorio_completo` | botão `vital_full_report` | Dr. Vital | BH:1021-1040 | MORTO na prática | 2 | TEC ("Análise não disponível") | "📋 *Relatório Completo*⏎⏎{summary}…" |
| 235 | `exame.pos.pergunta_prompt` | botão "Perguntar" | Dr. Vital | BH:995; o webhook chama `askQuestion` (W:4551), que não envia nada | QUEBRADO | 2 | o aluno fica sem resposta | "❓ *Pode fazer sua pergunta!*…" |
| 236 | `exame.pos.compartilhar` | `vital_share` | Dr. Vital | BH:1055 | MORTO | 2,5 | ASSIN | "📤 *Compartilhar Relatório*…" |
| 237 | `exame.legado.analise_manual` (grupo) | roteador interno do BH | Dr. Vital | BH:320, 425, 455, 463, 489, 517, 545, 566, 592, 678, 2391 e link em BH:2461 | MORTO | 1,5 | MARCA (`https://maxnutrition.com.br/relatorio/...` em BH:2461) ASSIN FALSO ("Digite PRONTO") | "🩺 *Análise concluída!* ✅⏎⏎🔐 Use sua senha para acessar:⏎📊 *Relatório:* {url}…" |
| 238 | `exame.conversa.resposta_ia` | texto de saúde | Dr. Vital (IA) | AI: prompt 1342-1425, assinatura em 958 e 1418 | ATIVO | 2,5 | ASSIN (3 assinaturas) EMOJI (o prompt manda "usar emojis") | assinatura: "_Dr. Vital, seu mentor de saúde e longevidade 🩺_" |
| 239 | `exame.conversa.reserva` | IA falha em conversa de saúde | Dr. Vital | W:1737 | ATIVO | 3 | ASSIN ("seu doutor virtual") | "Olá {nome}! Aqui é o Dr. Vital. Recebi sua mensagem sobre saúde clínica e exames.…" |
| 240 | `exame.conversa.pendentes` (4) | ferramenta `manage_medical_exams` | Dr. Vital (IA) | AI:766, 783, 788, 794, 804 | ATIVO | 2,5 | ASSIN SEMNOME TEC ("Travado") | "📋 *Exames Pendentes:*⏎1. N foto(s) - 📥 Coletando…" |
| 241 | `exame.notificacao.dr_vital` | cron `dr-vital-notifications` | Dr. Vital | `dr-vital-notifications/index.ts:368` | DESLIGADO (vai só para o app) | 1,5 | CULPA ("Volte e mantenha seu streak!") ASSIN | "*🌟 Sentimos sua falta!*⏎⏎Faz alguns dias que você não completa uma missão.…" |
| 242 | `legado.exame.fallback_responses` (6) | — | Dr. Vital | `_shared/ai/fallback-responses.ts:93-125` | MORTO | 2 | ASSIN | — |
| 243 | `legado.exame.interactive_templates` (7, inclui o alerta crítico) | — | Dr. Vital | IT:478-660, 2316, 2343; `post-analysis-flows.ts` | MORTO | 1 | CULPA (alerta alarmista "🚨 *ATENÇÃO - Valores Críticos Detectados*") | — |

### 5.3 Registros: banco (categorias `drvital-exames` e `Dr. Vital - Exames`, 12 linhas, BANCO, sem "Sofia")

| # | id | template_key | Nota | Problemas |
|---|---|---|---|---|
| 244 | `exame.banco.analysis_complete` | `vital_analysis_complete` | 2 | ASSIN (`_Dr. Vital 💚_` ou `🩺 Dr. Vital`) |
| 245 | `exame.banco.full_report` | `vital_full_report` | 2 | ASSIN |
| 246 | `exame.banco.question_prompt` | `vital_question_prompt` | 2 | ASSIN |
| 247 | `exame.banco.first_exam` | `vital_first_exam` | 2 | FALSO ("dados 100% privados e criptografados") |
| 248 | `exame.banco.critical_alert` | `vital_critical_alert` | 2 | CULPA ("ATENÇÃO", 🚨) CAIXA |
| 249 | `exame.banco.photos_batch` | `vital_photos_batch` | 2 | ASSIN |
| 250 | `exame.banco.analysis_prompt` | `vital_analysis_prompt` | 2 | ASSIN |
| 251 | `exame.banco.analyzing` | `vital_analyzing` | 2 | "Tempo estimado: {{time}}" |
| 252 | `exame.banco.analysis_error` | `vital_analysis_error` | 2 | EMOJI (❌ 😔) |
| 253 | `exame.banco.cancelled` | `vital_cancelled` | 2 | EMOJI (❌ 😔) |
| 254 | `exame.banco.complete` | `vital_complete` | 2 | ASSIN |
| 255 | `exame.banco.pending_reminder` | `vital_pending_reminder` | 2 | ASSIN |

---

## 6. Missões, lembretes, motivação e celebração

### 6.1 Do início ao fim (como o aluno vê hoje)

- **Missões:**
  - o envio diário está desligado e barrado;
  - **[corrigido no L7:]** o `whatsapp-webhook-unified` só trata os botões `mission_*`; o texto "missão" não chega ao tratador (só ao webhook antigo da nutrição). Os botões abrem `mission-handlers.ts` com `kind:'reply'`. Saem então `missao.resposta.convite`, depois `missao.resposta.pergunta` (7 vezes), `missao.resposta.registrada` e `missao.resposta.concluida`;
  - `missao.resposta.ativada` e `missao.resposta.status` prometem envio automático que não acontece.
- **Motivação, metas, lembretes inteligentes, celebração e missão completa:** desligados. A celebração e a missão completa viram só aviso no app.

### 6.2 Registros

| # | id | Gatilho | Fala [correto] | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 256 | `motivacao.bom_dia` | cron das 7 h | Sirlene [Rafael] | `whatsapp-daily-motivation/index.ts:25` (prompt) e `:267-288` (reserva) | DESLIGADO | 3 | PERS ASSIN, "streak" | "*{nome}*, bom dia! ☀️…🔥 {n} dias de streak! Você está arrasando!…" |
| 257 | `missao.envio.agua` | cron do sender | sem assinatura [Rafael] | `whatsapp-daily-mission-sender/index.ts:22` | DESLIGADO e BARRADO | 2 | OPC ASSIN ("Pouca") | "*💧 Missão do Dia (1/7)*⏎⏎Olá, {Nome}! *Bebeu água suficiente hoje?*…" |
| 258 | `missao.envio.sono` | idem | [Rafael] | `:34` | DESLIGADO e BARRADO | 2 | OPC ASSIN | "Quantas horas dormiu ontem?" |
| 259 | `missao.envio.atividade` | idem | [Rafael] | `:46` | DESLIGADO e BARRADO | 2 | OPC EMOJI(❌) | "Fez alguma atividade física hoje?" |
| 260 | `missao.envio.estresse` | idem | [Rafael] | `:58` | DESLIGADO e BARRADO | 2 | OPC | "Como está seu nível de estresse hoje?" |
| 261 | `missao.envio.energia` | idem | [Rafael] | `:70` | DESLIGADO e BARRADO | 2 | OPC | "Como está sua energia hoje?" |
| 262 | `missao.envio.humor` | idem | [Rafael] | `:82` | DESLIGADO e BARRADO | 2 | OPC | "Como foi seu humor hoje?" |
| 263 | `missao.envio.gratidao` | idem | [Rafael] | `:94` | DESLIGADO e BARRADO | 2 | GEN ("grato") OPC | "Pelo que você é grato hoje?" |
| 264 | `meta.lembrete` | cron diário | Sirlene [Rafael] | `whatsapp-goal-reminders/index.ts:249` | DESLIGADO | 3 | PERS EMOJI ASSIN | "*{nome}*, lembrete da sua meta! 🎯⏎⏎📌 *{título}*⏎▓▓▓░░░░░░░…" |
| 265 | `lembrete.missoes.andamento` | SR | Sirlene [Rafael] | SR:169 | DESLIGADO | 3 | PERS, "streak", "missão(ões)" | "*{nome}*, você está quase lá! 🎯…" |
| 266 | `lembrete.missoes.nova` | SR | Sirlene [Rafael] | SR:182 | DESLIGADO | 3 | PERS, "Sei que nem sempre é fácil" | "*{nome}*, suas missões estão te esperando! 🎯…" |
| 267 | `lembrete.sequencia.risco` | SR `streak_risk` | Sirlene [Rafael] | SR:221 | DESLIGADO | 1 | CULPA ("Seria uma pena perder esse progresso lindo") CAIXA | "*{nome}*, um carinho especial pra você! 🔥…" |
| 268 | `missao.it.boas_vindas` | pedido do aluno (legado) | eLiving [Rafael] | IT:2804 (`createMissionWelcome`) | MORTO na prática | 2 | INVENT ("até 175 XP"; o real é 180) | "Olá, {nome}! 👋⏎⏎Hora de completar sua *Missão do Dia*!…" |
| 269 | `missao.it.completa` | — | eLiving [Rafael] | IT:2828 | MORTO na prática | 2 | CAIXA EMOJI | "🎉 MISSÃO COMPLETA!" / "Parabéns, {nome}! 🏆…" |
| 270 | `missao.it.lembrete` | — | eLiving [Rafael] | IT:2858 | MORTO na prática | 1 | CULPA ("Você ainda não completou…") | "⏰ Lembrete de Missão" / "Ei, {nome}! 👋⏎⏎Você ainda não completou sua *Missão do Dia*!…" |
| 271 | `missao.it.convite` | — | eLiving [Rafael] | IT:2886 | MORTO na prática | 1 | FALSO (oferece envio pelo zap) | "*Quer receber as Missões do Dia pelo WhatsApp?*…" |
| 272 | `missao.it.horario` | — | [Rafael] | IT:2912 | MORTO na prática | 2 | FALSO | "*Quando você prefere receber as missões?*…" |
| 273 | `missao.it.ativada` | — | Sirlene [Rafael] | IT:2931 | MORTO na prática | 1 | FALSO INVENT ("até 200 XP") | "✅ *Missões do Dia Ativadas!*⏎⏎📅 Você receberá suas missões às *{hora}*…" |
| 274 | `missao.it.pausada` | — | Sirlene [Rafael] | IT:2940 | MORTO na prática | 2 | ASSIN | "⏸️ *Missões do Dia Pausadas*…" |
| 275 | `missao.it.recusada` | — | Sirlene [Rafael] | IT:2950 | MORTO na prática | 3 | ASSIN | "👍 *Sem problemas!*⏎⏎Se mudar de ideia, é só digitar *missão*…" |
| 276 | `missao.it.status` | — | Sirlene [Rafael] | IT:2956 | MORTO na prática | 2 | ASSIN | "🎯 *Status das Missões do Dia*…" |
| 277 | `missao.resposta.convite` | "missão" | Dr. Vital e Sirlene [Rafael] | `mission-handlers.ts:734` | ATIVO | 3 | ASSIN (dupla) | "🎯 Construindo seu futuro" / "*{nome}*, você está construindo o seu futuro a cada escolha.…" |
| 278 | `missao.resposta.horario` | escolher horário | [Rafael] | `:251` | ATIVO | 2 | FALSO (envio desligado) | "Quando você prefere receber suas missões diárias?…" |
| 279 | `missao.resposta.ativada` | horário escolhido | eLiving [Rafael] | `:161` | ATIVO | 2 | FALSO ("Você receberá suas missões diárias às…") | "🎉 Missões Ativadas!" / "Perfeito! Você receberá suas missões diárias às {🌅 Manhã (9h)}.…" |
| 280 | `missao.resposta.pausada` | "missão off" | eLiving [Rafael] | `:172` | ATIVO | 3 | ASSIN | "⏸️ *Missões Pausadas*…" |
| 281 | `missao.resposta.recusada` | "Depois" | Dr. Vital e Sirlene [Rafael] | `:200` | ATIVO | 2 | ASSIN ("_Dr. Vital 🩺 \| Sirlene 🥗_") | "😊 *Tudo bem!*…" |
| 282 | `missao.resposta.nunca` | "Não pedir mais" | Dr. Vital e Sirlene [Rafael] | `:232` | ATIVO | 3 | ASSIN | "✅ *Entendido.*⏎⏎Não vou mais te enviar convites de missões diárias.…" |
| 283 | `missao.resposta.pergunta` (7) | missão em andamento | eLiving [Rafael] | `:344` | ATIVO | 2 | OPC, rótulos diferentes do sender e do banco | "🎯 Missão {n}/7" / "▓▓░░░░░⏎💧 Como foi sua hidratação hoje?…" |
| 284 | `missao.resposta.registrada` | resposta dada | eLiving [Rafael] | `:451` | ATIVO | 3 | ASSIN; o `setTimeout` de 2 s pode se perder | "{emoji} *Resposta registrada.*⏎▓▓░░░░░ n/7⏎_Próxima pergunta em 2s..._" |
| 285 | `missao.resposta.concluida` | 7.ª resposta | Dr. Vital [Rafael] | `:521` | ATIVO | 2 | PERS TEC ("mapeado", "construindo seu perfil") | "🩺 Dr. Vital te conhece melhor" / "🎉 *Tudo registrado!* 🎉…" |
| 286 | `missao.resposta.status` | "missão status" | eLiving [Rafael] | `:683` | ATIVO | 2 | FALSO ("Próxima missão será enviada automaticamente!") | "✅ *Missões Ativas*…" |
| 287 | `missao.resposta.erros` (5) | falhas | eLiving | `:182, 297, 353, 466, 712` | ATIVO | 2 | TEC EMOJI(❌) | "❌ *Erro ao configurar missões.*…⏎_eLiving ✨_" |
| 288 | `missao.resposta.ja_feita` | missão já feita ou expirada | eLiving | `:283, 396` | ATIVO | 3 | ASSIN | "⏰ *Essa pergunta já foi respondida ou expirou.*" |
| 289 | `missao.resposta.pular` | "Depois" no convite | Dr. Vital e Sirlene [Rafael] | `:792` | ATIVO | 3 | ASSIN | "⏰ *Ok!* Quando quiser, digite *missão* para começar." |
| 290 | `missao.completa.texto` | app, missão terminada | Sirlene (IA) [Rafael] | `whatsapp-mission-complete/index.ts:131` | DESLIGADO (só app) | 3 | ASSIN ("Com orgulho, Sirlene 💚") | gerado pela IA |
| 291 | `missao.completa.imagem` | idem | Sirlene | `whatsapp-mission-complete/index.ts:100` e SVG em `:150` | DESLIGADO | 1 | SVG enviado como JPEG (não abre); nome sem escape | legenda "Resumo do dia de {nome}" |
| 292 | `missao.completa.aviso_app` | interruptor desligado | eLiving | `whatsapp-mission-complete` | APP | 3 | — | "🎯 Missão completa" / "Mandou bem! {n} pontos. Continua no app amanhã." |
| 293 | `celebracao.conquista` | app, conquista | Sirlene [Rafael] | `whatsapp-celebration/index.ts:108` | DESLIGADO e BARRADO | 3 | CAIXA ("VOCÊ CONSEGUIU!") CULPA leve ("Eu sabia que você conseguiria") | "*{nome}*, VOCÊ CONSEGUIU! 🏆…" |
| 294 | `celebracao.peso` | app, marco de peso | Sirlene [Rafael] | `:122` | DESLIGADO e BARRADO | 1 | FALSO (`Math.abs`: ganho vira "perdeu"; "O Dr. Vital também mandou parabéns") PONTO CULPA ("velhos hábitos") | "*{nome}*, que notícia maravilhosa! ⚖️⏎⏎Você perdeu *{x.x}kg*! 📉…" |
| 295 | `celebracao.sequencia` | app, sequência | Sirlene [Rafael] | `:156` | DESLIGADO e BARRADO | 2 | CAIXA CULPA ("Não pare agora!") | "*{nome}*, {emoji} *{n} DIAS DE STREAK!*…" |
| 296 | `celebracao.meta` | app, meta batida | Sirlene [Rafael] | `:171` | DESLIGADO e BARRADO | 3 | CAIXA, "ainda maiores" | "*{nome}*, PARABÉNS! 🎯🎊🏆…" |
| 297 | `celebracao.padrao` | outro tipo | Sirlene [Rafael] | `:188` | DESLIGADO e BARRADO | 3 | CAIXA | "*{nome}*, PARABÉNS! 🎉…" |

### 6.3 Registros: banco (categoria `missoes`, 9 linhas, BANCO, rodapé "🌿 Sofia")

| # | id | template_key | Nota | Problemas |
|---|---|---|---|---|
| 298 | `missao.banco.start` | `mission_start` | 3 | SOFIA |
| 299 | `missao.banco.water` | `mission_water_prompt` | 2 | SOFIA, rótulos em copos (no código são litros) |
| 300 | `missao.banco.sleep` | `mission_sleep_prompt` | 2 | SOFIA, qualidade (no código são horas) |
| 301 | `missao.banco.activity` | `mission_activity_prompt` | 2 | SOFIA EMOJI(❌) |
| 302 | `missao.banco.stress` | `mission_stress_prompt` | 2 | SOFIA |
| 303 | `missao.banco.energy` | `mission_energy_prompt` | 2 | SOFIA |
| 304 | `missao.banco.mood` | `mission_mood_prompt` | 2 | SOFIA |
| 305 | `missao.banco.gratitude` | `mission_gratitude_prompt` | 3 | SOFIA (é a única que trata gênero) |
| 306 | `missao.banco.complete` | `mission_complete` | 2 | SOFIA CAIXA |

---

## 7. Relatórios

### 7.1 Do início ao fim (como o aluno vê hoje)

- Os relatórios pedidos pelo Admin (`send-whatsapp-report`) saem como "não solicitados" e são barrados.
- O relatório semanal premium está desligado.
- O relatório do n8n depende de um fluxo externo que não está neste repositório.
- Sabotadores e análise de hábitos são pedidos pelo aluno no app e também são barrados.
- Resultado: hoje o aluno não recebe relatório pelo WhatsApp.

### 7.2 Registros

| # | id | Gatilho | Fala [correto] | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 307 | `relatorio.semanal.premium` | cron de sexta às 9 h | Dr. Vital e Sirlene | `whatsapp-weekly-report/index.ts:484` (`formatReportMessage`) | DESLIGADO | 1 | REG (3) CAIXA LONGO (1.800 a 2.600 caracteres) PONTO INVENT (score 50 sem dado) ASSIN ("eLiving • Longevity & Performance") | "🏆 *RELATÓRIO SEMANAL PREMIUM*⏎━━━━━━━━━━━━━━━━━━━━⏎Olá, *{nome}*! 👋…" |
| 308 | `relatorio.semanal.avulso` | Admin | Sirlene | `send-whatsapp-report/index.ts:140` | BARRADO | 2 | NOMEC PONTO ASSIN | "📊 *Relatório Semanal* - {nome}⏎⏎🗓️ *Resumo da Semana*…" |
| 309 | `relatorio.mensal` | Admin | Sirlene | `:160` | BARRADO | 3 | REG NOMEC | "*Relatório do mês*⏎{nome}⏎⏎━━━━━━━━━━━━━━━━⏎⏎*Treinos*  n…⏎_Sirlene · eLiving_" |
| 310 | `relatorio.diario` | Admin | Sirlene | `:171` | BARRADO | 2 | NOMEC ASSIN | "☀️ *Resumo do Dia* - {nome}⏎⏎📋 *Hoje você:*…" |
| 311 | `relatorio.laudo` | Admin (`IntelligentReports`, `MonthlyReportManager`) | Dr. Vital | `:190-200` | BARRADO | 2,5 | REG NOMEC; senha junto do link | "*Laudo*⏎{nome}⏎⏎━━━━━━━━━━━━━━━━⏎⏎{summary}⏎⏎*Código*⏎{código}…_Dr. Vital · eLiving_" |
| 312 | `relatorio.nutricional` | Admin | Sirlene | `:203` | BARRADO | 2 | NOMEC ASSIN | "🥗 *Relatório Nutricional* - {nome}…" |
| 313 | `relatorio.treino` | Admin | Sirlene [Alex] | `:223` | BARRADO | 2 | PERS NOMEC ASSIN, "Performance" | "💪 *Relatório de Treinos* - {nome}…" |
| 314 | `relatorio.padrao` | Admin, outro tipo | sem personagem | `:119` | BARRADO | 1 | ASSIN NOMEC | "Olá {nome}! Seu relatório está disponível." |
| 315 | `relatorio.semanal.n8n` | n8n externo | "Dr. Vita" (nome errado) | `n8n-weekly-whatsapp-report/index.ts:178` | INCERTO | 0 | PERS ("DR. VITA") NOMEC ASSIN CAIXA LONGO PONTO FALSO ("Parâmetros sob controle") CULPA | "🏥 *DR. VITA - RELATÓRIO SEMANAL*⏎⏎Olá, {nome completo}! 👋…" |
| 316 | `relatorio.semanal.nutricao` | `createWeeklyReport` | eLiving [Sirlene] | IT:874 | MORTO na prática | 2 | CULPA (🔴 na pontuação) INVENT NOMEC | "📅 Sua Semana" / "📊 *Relatório Semanal*⏎👤 {nome}…" |
| 317 | `sabotadores.resultado` | aluno no app (`SaboteurTest.tsx:941`) | Dr. Vital (IA) [Rafael] | `whatsapp-saboteur-result/index.ts:81` | BARRADO | 3 | PERS ASSIN ("Com respeito e dedicação,⏎Dr. Vital 🩺⏎_eLiving_") INVENT (afirmações clínicas) | "*{nome}*, …" (gerado) |
| 318 | `sabotadores.legenda` | idem | Dr. Vital [Rafael] | `:171` | BARRADO | 2 | ASSIN SEMNOME | "📊 Seu Relatório Completo de Sabotadores Mentais - Dr. Vital" |
| 319 | `habitos.analise.legenda` | aluno compartilha | Dr. Vital [Rafael] | `whatsapp-habits-analysis/index.ts:233` | BARRADO | 3 | PERS ASSIN ("— *eLiving* 💚") | "🩺 *Dr. Vital - Análise Personalizada*⏎⏎✨ +{n} pontos hoje!…" |

---

## 8. Admin, broadcast e consentimento

### 8.1 Do início ao fim

1. O admin digita um comunicado livre em `WhatsAppBroadcast.tsx`.
2. Ele sai por `whatsapp-admin-send` ou `evolution-admin`, só para quem consentiu.
3. O texto ganha no fim o rodapé `marketing.rodape_sair`.
4. Se o aluno responde "SAIR", recebe `marketing.sair_confirmacao`.
5. O envio depende de `EVOLUTION_ALLOW_UNSOLICITED=true`. O `sendText` do `evolution-admin` chama a Evolution direto.

### 8.2 Registros

| # | id | Gatilho | Fala | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 320 | `admin.broadcast` | admin envia comunicado | texto livre | `WhatsAppBroadcast.tsx`, `whatsapp-admin-send/index.ts:242`, `evolution-admin/index.ts:85` | depende do env | — (texto do admin) | o painel mostra "Instância: maxnutrition"; sem validação de padrão | (livre) |
| 321 | `marketing.rodape_sair` | todo marketing | sem assinatura | `marketing-consent.ts:1` (`withMarketingOptOut`) | ATIVO | 3 | ASSIN, sem itálico | "Para não receber mais, responda SAIR" |
| 322 | `marketing.sair_confirmacao` | aluno responde "sair" | sem assinatura | `marketing-consent.ts:27`, chamado em W:212 | ATIVO | 3 | ASSIN | "Pronto, você não receberá mais novidades pelo WhatsApp. Pode continuar usando o acompanhamento normalmente." |
| 323 | `admin.teste_conexao` | botão de teste no Admin | eLiving | `EvolutionConnectionCard.tsx:51`, `WhapiConfigPanel.tsx:47` | ATIVO (admin) | 2 | "Sirlene IA / eLiving" misturado | "Olá! Este é um teste da Sirlene IA / eLiving via Evolution API." |
| 324 | `admin.teste_interativo` | teste de modelos | Sirlene e Dr. Vital | `WhatsAppInteractiveTest.tsx` (3.ª cópia dos modelos) | ATIVO (admin) | 2 | ASSIN (`🌿 Sirlene - eLiving`, `🩺 Dr. Vital - eLiving`) | — |
| 325 | `admin.gerador_modelos` (2 prompts) | editor de modelos | Sirlene e Dr. Vital (IA) | `whatsapp-generate-template/index.ts:57` e `:88` | ATIVO, sem `requireAdmin` | 2 | ASSIN EMOJI ("livremente"); qualquer pessoa pode chamar | prompt: "…NUNCA use culpa, ameaça ou medo…" |

---

## 9. Erros, limites e contingência (fora dos fluxos acima)

| # | id | Gatilho | Fala | Onde mora | Estado | Nota | Problemas | Início do texto |
|---|---|---|---|---|---|---|---|---|
| 326 | `erro.limite_envio` | mais de 8 mensagens por minuto | — | `evolution-outbound-guard.ts` (fila silenciosa) | sem mensagem | — | correto: não manda bronca | — |
| 327 | `erro.falha_geral_texto` | exceção no tratamento do texto | Sirlene | W:1747 (HEAD:1712) | ATIVO | 3 | ASSIN SEMNOME | "Ops! Tive uma pequena oscilação aqui. Pode me mandar de novo? 🙏⏎⏎_Sirlene, sua nutricionista virtual 🥗_" |
| 328 | `erro.ia_indisponivel` (Sirlene e Alex) | IA falha, reserva do webhook | Sirlene e Alex | W:1730-1744 | ATIVO | 2 | ASSIN; "Olá Usuário!" quando falta nome | "Olá {nome}! Recebi sua mensagem! Tive uma oscilação momentânea…" / "Olá {nome}! Aqui é o Alex, seu personal virtual. Bora pra cima!…" |
| 329 | `erro.assistente_contingencia` (4) | follow-up da IA falha | Sirlene | AI:109, 174, 181, 183, 1776 | ATIVO | 2 | ASSIN, "Anotei aqui" vago | "✅ Feito! Anotei aqui. 💚⏎⏎_Sirlene 💚_" / "Ops! Tive um probleminha agora. Pode tentar de novo? 🙏" |
| 330 | `erro.orcamento_ia` | flag `ai_budget_enforced` | Sirlene | AI:1670 | ATIVO se a flag estiver ligada | 2 | CULPA ("hoje já conversamos bastante") | "{nome}, hoje já conversamos bastante! 💚 Amanhã eu volto com energia total.…" |
| 331 | `erro.banco.not_understood` | — | Sofia | banco `error_not_understood` | BANCO | 2 | SOFIA | "🤔 *Não entendi sua mensagem.*…" F "🌿 Sofia" |
| 332 | `erro.banco.rate_limit` | — | Sofia | banco `error_rate_limit` | BANCO | 0 | SOFIA CULPA ("Calma aí! Você está enviando muitas mensagens") | "⏳ *Calma aí!*…" |
| 333 | `erro.banco.processing` | — | Sofia | banco `error_processing` | BANCO | 1 | SOFIA FALSO ("equipe notificada") | "😔 *Ops! Algo deu errado.*…" |
| 334 | `erro.banco.image_unclear` | — | Sofia | banco `error_image_unclear` | BANCO | 1 | SOFIA | "😕 *Não consegui analisar bem essa imagem.*…" |
| 335 | `erro.banco.technical` | — | Sofia | banco `error_technical` | BANCO | 2 | SOFIA | "Oi *{{userName}}*! 👋 💚⏎⏎Tive um pequeno probleminha técnico…" |
| 336 | `erro.banco.video_received` | — | Sofia | banco `error_video_received` | BANCO | 1 | SOFIA | "📹 *Vídeo recebido!*…" |
| 337 | `erro.banco.audio_received` | — | Sofia | banco `error_audio_received` | BANCO | 0 | SOFIA FALSO (diz que não trabalha com áudio) | "🎤 *Áudio recebido!*⏎⏎No momento, trabalho apenas com *fotos* e *texto*.…" |
| 338 | `erro.banco.image_unknown` | — | sem assinatura | banco `error_image_unknown` | BANCO | 2 | ASSIN | "📸 *Recebi sua foto!*⏎⏎Não consegui identificar automaticamente o tipo.…" |
| 339 | `erro.banco.confirm_no_pending` | — | Sofia | banco `error_confirm_no_pending` | BANCO | 1 | SOFIA | "✅ *Entendi!*⏎⏎Não tenho nenhuma refeição pendente para confirmar.…" |

---

## 10. Voz da IA (prompts que geram respostas livres) e legado do command router

| # | id | Fala | Onde mora | Estado | Nota | Problemas |
|---|---|---|---|---|---|---|
| 340 | `ia.prompt.sirlene` | Sirlene | AI:1393-1430 (`buildSystemPrompt`) | ATIVO | 2 | ASSIN ("Assine sempre: _Sirlene 💚_"); "SEMPRE pareça humana"; cita o modelo "Gemini 2.5 Pro"; "Use o nome frequentemente" (pode ser o nome completo); não proíbe `**`, régua nem culpa; tem regra de tela ("home Hoje") que não serve ao WhatsApp |
| 341 | `ia.prompt.dr_vital` | Dr. Vital | AI:1342-1391 | ATIVO | 3 | ASSIN (3 versões); falta regra de tom sem culpa |
| 342 | `ia.prompt.reserva_gpt` | Sirlene | AI:119 (`FALLBACK_SOFIA_SYSTEM`) | ATIVO | 2 | ASSIN (duas permitidas) |
| 343 | `ia.persona_audio` | Sirlene | `_shared/audio-keyword-matrix.ts:178-185` e `:350-352` | ATIVO | 2 | GEN ("bem-vindo"), "Oi, amor!" para desconhecido |
| 344 | `ia.prompt.registry` (4 especialistas) | todos | `_shared/agents/registry.ts:98-160` (`signature`) | ATIVO quando `prompts_from_registry` está ligada | 3 | assinaturas `_Sirlene 💚_`, `_Dr. Vital 🩺_`, `_Alex 🏋️_`, `_Rafael 🧭_` sem "eLiving" |
| 345 | `legado.router.saudacao` | Sirlene | `whatsapp-command-router/index.ts:243-257` | MORTO na prática | 2 | FALSO ("Lembretes" no zap) ASSIN |
| 346 | `legado.router.exame` | Sirlene | `:259-269` | MORTO na prática | 2 | PERS ASSIN |
| 347 | `legado.router.nao_entendi` | Sirlene | `:271-285` | MORTO na prática | 2 | PONTO ("Peso 74.5") FALSO ("Lembrar vitamina 8h") |
| 348 | `legado.router.ajuda` | Sirlene | `handlers/query-handler.ts:301-328` | MORTO na prática | 2 | PONTO FALSO ASSIN |
| 349 | `legado.router.maxchef` | Sirlene | `handlers/nutrition-handler.ts:322` e `:380` | MORTO na prática | 0 | MARCA ('2️⃣ Vá em "MaxChef"') |
| 350 | `legado.router.generico` | Sirlene | `:406` | MORTO na prática | 2 | ASSIN |
| 351 | `legado.router.handlers` (peso, lembrete, meta, saúde, exercício, gamificação, social, refeição) | Sirlene | `handlers/*.ts` (réguas em `exercise-handler.ts:277, 291` e `nutrition-handler.ts:199, 204`) | MORTO na prática | 2 | REG PONTO |

---

## 11. Resumo em números

Contagem por registro. Cada linha das tabelas é uma mensagem; variantes sorteadas e modelos agrupados contam como 1.

| Indicador | Número |
|---|---|
| Mensagens catalogadas (linhas 1 a 351) | **351** |
| Mensagens com texto real, sem os 3 itens que não têm texto fixo (#320 broadcast livre, #326 limite silencioso, #325 gerador) | 348 |
| No padrão antigo (código, app e banco) | 339 |
| No módulo premium novo, desligado (#132 a #140) | 9 |
| **Premium (nota 4 ou mais)** | **9**, todas do módulo novo e desligadas |
| Premium que chegam hoje ao aluno | **0** |
| Melhor nota de uma mensagem que chega hoje | 3,5 (`exame.senha.gerada`, `exame.receita.recebida`) |
| Chegam hoje ao aluno pelo WhatsApp (ATIVO 130 + RESERVA 7) | 137 |
| Prontas só no working tree, ainda não publicadas (WT) | 8 |
| Montadas no app (APP) | 9 |
| Barradas pelo guarda de envio (G15) | 20 |
| Desligadas (proativo) | 34 |
| Quebradas (nunca chegam por defeito) | 15 |
| Mortas (sem chamador) | 32 |
| Só no banco (BANCO) | 83 |
| Dependem de configuração externa (INCERTO) | 2 |
| **Com marca antiga visível** | **8** (#10, #13, #33, #39, #49 no banco; #101, #237, #349 no código), mais a página do laudo (`finalize-medical-document:797`) |
| **Com "Sofia"** | **67 linhas do banco** em texto visível (69 se contar a chave interna `sofia_*`); 0 no código visível |
| Com "coach" ou "Instituto dos Sonhos" visível | 0 |
| **Lugares diferentes onde mensagens moram** | **51** (seção 1) |
| Assinaturas diferentes em uso | 14 |

Os estados somam 351 junto com as 9 do módulo novo e os 3 itens sem texto fixo. Linhas com dois estados, como "DESLIGADO e BARRADO", contam pelo primeiro.
