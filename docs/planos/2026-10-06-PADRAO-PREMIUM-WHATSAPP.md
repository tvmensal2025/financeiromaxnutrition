# Padrão premium das mensagens de WhatsApp (eLiving)

Versão 1, de 06/10/2026. Vale para toda mensagem que o eLiving manda pelo WhatsApp: texto fixo, modelo, mensagem de cron, relatório e prompt de IA.

- **Origem:** o padrão nasceu na foto do prato (`docs/foto-prato/ANALISE_CONVERSA_WHATSAPP_PREMIUM_20261006.md`, seção 2) e foi estendido para todos os fluxos.
- **Onde cada mensagem mora hoje:** `docs/whatsapp/CATALOGO_MENSAGENS_WHATSAPP_20261006.md`.
- **Como chegar a este padrão:** `docs/whatsapp/PLANO_MIGRACAO_MENSAGENS.md`.

Quem valida este padrão são os testes guardiões, não a revisão manual. Uma regra que não tem teste ainda não vale.

---

## 1. Esqueleto de toda mensagem

```
{emoji} *{Título curto, com o primeiro nome quando couber}*

{Corpo: 1 a 4 linhas curtas, uma ideia por mensagem}

{Bloco de ação, se houver:}
*Pergunta?*
*1*  Opção
*2*  Opção
*3*  Opção

_{Personagem} · eLiving_
```

- **Uma ideia por mensagem.** Pergunta e opções vão no mesmo envio, para não gastar o teto de 8 mensagens por minuto do chip.
- **Linha em branco entre blocos.** Nunca use régua.
- **Assinatura sempre na última linha.** Ela vem sozinha e em itálico.

---

## 2. Formatação do WhatsApp

| Regra | Certo | Errado |
|---|---|---|
| Negrito com **um** asterisco | `*Laudo pronto*` | `**Laudo pronto**` |
| Itálico com sublinhado | `_Estimativa pela foto_` | `*_texto_*` misturado sem necessidade |
| Sem régua | linha em branco | `━━━━━━`, `───────`, `---` |
| Sem Markdown de site | link solto numa linha própria | `[clique aqui](url)`, `# Título` |
| Título curto, em caixa normal | `*Almoço salvo, Rafael*` | `*RELATÓRIO SEMANAL PREMIUM*` |
| Lista com `•` ou com emoji do item | `• Arroz branco cozido` | `-`, `*` no início da linha |
| Dois negritos inline seguidos | só um por linha no bloco de ação, ou o segundo sem negrito | `*1* Confirmar⏎✏️ *2*`, que o conversor antigo corrompia |
| Monoespaçado | não usar | ```` ```texto``` ```` |

O conversor `formatEvolutionWhatsAppText` (`_shared/whatsapp/text-format.ts`) é rede de segurança, não licença. Hoje ele transforma `---` em régua. O texto já deve nascer certo.

---

## 3. Personagens, voz e assinatura

Cada assunto tem um dono, conforme `_shared/agents/registry.ts`. Uma mensagem tem uma voz só. É proibido assinar com duas pessoas.

| Personagem | Assuntos | Voz | Assinatura única |
|---|---|---|---|
| **Sirlene** | foto do prato, refeição, cardápio, receita, mercado, água, peso (registro) | calorosa e prática; fala de comida sem julgar; oferece o próximo passo | `_Sirlene · eLiving_` |
| **Dr. Vital** | exame, laudo, receita médica, sintoma, remédio, GLP-1, prevenção | calmo, claro e sem alarme; explica em palavras simples; lembra o médico do aluno quando há achado; mentor de saúde, **nunca** "médico especialista" | `_Dr. Vital · eLiving_` |
| **Rafael** (mentor) | hábito, missão, sono (como hábito), humor, motivação, metas, sabotadores, celebração | presença de mentor; reconhece sem cobrar; pergunta mais do que afirma | `_Rafael · eLiving_` |
| **Alex** | treino, exercício, passos, corrida | energia leve; "seu personal virtual"; **nunca** "coach" | `_Alex · eLiving_` |
| **eLiving** (sistema, sem personagem) | recebimento neutro (antes de saber o assunto), SAIR, consentimento, conta e telefone, aviso técnico geral | neutro e curto | `_eLiving_` |

Regras de voz:
- **Primeira pessoa do singular** ("Não consegui ler"), nunca "nós conseguimos".
- **Um personagem não fala pelo outro.** Frases como "O Dr. Vital também mandou parabéns" são proibidas.
- **Nada de fingir ser gente.** A personagem não diz "estou super bem" nem "SEMPRE pareça humana". Quando perguntarem, ela diz que é a assistente virtual do eLiving.
- **Proibido "nutricionista" ou "médico" como título profissional da persona.** Use "cuido da sua alimentação no eLiving" e "seu mentor de saúde".
- **Assinaturas aposentadas:** `_Sirlene 💚_`, `_Sirlene 🥗_`, `_Sirlene, sua nutricionista virtual 🥗_`, `Com carinho,⏎Sirlene 💚⏎_eLiving_`, `Com amor…`, `Com orgulho…`, `🌿 Sirlene - eLiving`, `_Sirlene Nutricional • eLiving Private Health_`, `_Dr. Vital 🩺_`, `_Dr. Vital, seu doutor virtual 🩺_`, `_Dr. Vital, seu mentor de saúde e longevidade 🩺_`, `🩺 Dr. Vital - eLiving`, `_Dr. Vital 🩺 | Sirlene 🥗_`, `— *eLiving* 💚`, `_eLiving ✨_` e qualquer assinatura com "Sofia".

---

## 4. Emojis

**Limite.** No máximo 1 emoji no título e no máximo 3 na mensagem toda, sem contar os emojis que identificam itens de lista do prato.

| Tipo de mensagem | Emoji permitido |
|---|---|
| Recebimento | 📸 (foto), 📄 (documento) |
| Resultado de refeição | emoji do alimento por item, 🔥 só no total de kcal, 💚 só na nota positiva |
| Sucesso / salvo | ✅ |
| Espera / instabilidade | ⏳ |
| Foto ilegível / imagem que não abre | 🔍 / 🖼️ |
| Edição | ✏️ |
| Água | 💧 |
| Sono | 🌙 |
| Treino | 💪 |
| Missão e meta | 🎯 |
| Exame e laudo | 🩺, 📄 (receita), 🔐 (senha) |
| Celebração | 🎉 (um só) |
| Boas-vindas | 👋 |

**Proibidos com o aluno:**
- ❌ numa escolha dele: "Ainda não", "Não fiz", "Cancelar";
- 🚨 e ⚠️ para cobrar;
- 🔴 para julgar dia, noite ou pontuação;
- 😔, 😅 e 😰 como reação da personagem;
- sequências como 🔥🔥🔥 ou 🎯🎊🏆.

---

## 5. Tamanho

- **Máximo:** 1.000 caracteres, contados depois de preencher as variáveis com o caso mais longo. É o `LIMITE_CARACTERES` de `foto-prato-mensagens.ts`.
- **Ideal:** 250 a 600 caracteres. Relatório é a exceção: até 1.000, e o resto fica no app ("Abra o app para ver tudo").
- **Primeiro contato:** no máximo 450 caracteres. Não apresente a equipe inteira.
- **Corte de texto gerado por IA:** nunca corte no meio da frase com `...`. Encurte na origem, com limite no prompt e verificação depois.

---

## 6. Números, datas e unidades (pt-BR)

| Regra | Certo | Errado |
|---|---|---|
| Decimal com vírgula | `32,7 g`, `72,5 kg`, `1,5 L` | `32.7g`, `72.5`, `1.5L` |
| Milhar com ponto | `1.234 kcal` | `1234 kcal`, `toLocaleString()` sem `'pt-BR'` |
| Espaço sem quebra (` `) entre número e unidade | `130 g`, `500 ml` | `130g`, `500ml` |
| Valor desconhecido | `—` | `0` |
| Estimativa | `≈ 741 kcal` e `_Estimativa pela foto_` | número seco que parece medido |
| Meta | só a meta do aluno; sem meta, mostrar só o total | `2500` fixo, `\|\| 2000` |
| Data | `13/10` ou `13 de outubro` | `2026-10-13` |
| Hora | `7h30` ou `07:30` | `7:30 AM` |
| Prazo | `em alguns minutos` (exame), ou o número real (`em cerca de 5 min`) | "segundos" quando leva minutos |

Ao exibir peso, use vírgula. Ao pedir peso, aceite vírgula e ponto.

---

## 7. Nome e gênero

- **Só o primeiro nome**, com `primeiroNome()` de `foto-prato-mensagens.ts`. Nunca o nome completo.
- **Sem nome válido**, a frase sai sem nome e sem vírgula solta. Nunca escreva "Usuário", "Olá Usuário!" ou `{nome}` vazio.
- **Nome com moderação:** no título ou na primeira frase, uma vez por mensagem.
- **Gênero:** use `getGenderedTerms` e `isFeminine` de `_shared/whatsapp/gender-utils.ts`. Sem gênero, prefira a forma neutra: "Que bom ter você aqui", "Pelo que você agradece hoje?". Proibido "(a)", "querido(a)" e "bem-vindo" fixo.
- **Proibido tratamento íntimo** ("amor", "querido") com qualquer aluno.

---

## 8. Opções numeradas

- Formato `*1*  Rótulo`: número em negrito e dois espaços. Use o `formatBoldChoices` (`_shared/whatsapp/numbered-options.ts`), nunca `1. Rótulo`.
- No máximo 4 opções. A mais provável vem em `*1*`.
- **O mesmo número tem o mesmo sentido** em todo o fluxo. Na refeição, 1 = salvar, 2 = corrigir e 3 = descartar. No exame, 1 = exame, 2 = receita e 3 = cancelar, e isso vale nos botões, no texto de reserva e no cron.
- Toda mensagem com opções **grava o mapeamento** em `whatsapp_user_state`, como faz `sendWhapiButtons`. Opção que o robô não entende é proibida.
- Nunca escreva "clique", "toque no botão" ou "clique em Pronto". No Evolution, o aluno responde com o número.
- Rótulos neutros. Escreva "Agora não" e "Ainda não", nunca "❌ Não fiz".

---

## 9. Honestidade

1. **Estimativa é estimativa:** escreva `_Estimativa pela foto · tabela TACO_` e ponha `≈` quando houver item fora da tabela.
2. **Falha diz o que aconteceu com o dado:** "Não registrei nada" ou "Não salvei". Diga se a falha foi da foto ou do sistema, sem culpar o aluno quando o erro é nosso.
3. **Nunca prometer o que o sistema não faz.** Enquanto `WHATSAPP_PROACTIVE_REMINDERS` estiver desligado, estas frases são proibidas: "vou te lembrar", "você receberá suas missões às 9h", "lembretes automáticos" e "amanhã te pergunto". Os lembretes ficam no app: "Seus lembretes ficam no app eLiving".
4. **Nada de "precisão máxima", "100%", "certificado", "link permanente", "Laudo de Luxo"** nem afirmação fisiológica sem base ("queima de gordura", "acalma o cortisol").
5. **Não diga que salvou** sem ter gravado, nem "Já estou guardando os dados".
6. **Número que depende de dado ausente não aparece.** Isso vale para score base 50, "Parâmetros sob controle" sem dado e "perdeu" quando ganhou.

---

## 10. Tom sem culpa ("emocionar sem envergonhar")

**Proibido:**
- bronca ("Calma aí!", "Você está enviando muitas mensagens");
- perda ou ameaça ("Seria uma pena perder", "Não pare agora!");
- cobrança ("Você ainda não completou", "Há N dias", "Lembre-se de me contar");
- julgamento ("Seu objetivo vale mais que 2 minutos de doce", "não fugir da meta", "vitória sobre velhos hábitos", "Pior noite");
- comparação com outros alunos.

**Permitido:**
- reconhecer ("Boa dose de fibras nesse prato");
- acolher ("Dia difícil acontece");
- convidar ("Quando quiser, me mande a foto").

**Em saúde (Dr. Vital):**
- Achado relevante tem tom calmo e próximo passo concreto: "Vale mostrar ao seu médico nos próximos dias."
- Achado crítico tem a mesma calma e a orientação objetiva: "Procure atendimento hoje." Sem 🚨 e sem caixa alta.

---

## 11. Segurança e privacidade

- **Senha do laudo nunca vai junto com o link.** A senha vai antes, na conversa, e o link vai depois, com validade. Esse caminho já está em `laudo-protegido.ts`.
- **Link de laudo só para página protegida** (`ehLinkDeArquivo` falso). Proibido `/relatorio/:token` aberto.
- **Peso e exame não vão em lembrete sem pedido.** O lembrete convida e não expõe o número.
- **Valor clínico detalhado fica no app.** No WhatsApp vai um resumo curto, sem o laudo inteiro.

---

## 12. Proibições (os testes guardiões barram)

| Proibido | Exemplo | Teste |
|---|---|---|
| Marca antiga | MaxNutrition, Max Nutrition, `maxnutrition.*`, MaxChef, Instituto dos Sonhos, "MAX" como marca | `brand-visible-text.test.ts`, estendido |
| Nome antigo da nutricionista | Sofia | idem |
| "coach" | coach, coaching | idem |
| Negrito duplo | `**` | `padrao-premium.test.ts` |
| Régua | `━`, `─` repetidos, linha `---` | idem |
| Decimal com ponto e unidade colada | `72.5`, `130g` | idem |
| Nome completo | "Maria Souza Lima" | idem (com caso de teste de nome composto) |
| "Usuário" como nome | "Olá Usuário!" | idem |
| Culpa e bronca | lista da seção 10 | idem (lista de frases proibidas) |
| Assinatura fora do padrão ou ausente | seção 3 | idem |
| Mais de 1.000 caracteres | — | idem |
| Opções `1.` ou "clique" | — | idem |
| Promessa de lembrete por WhatsApp | seção 9 | idem |

---

## 13. Três exemplos reais, antes e depois

### Exemplo 1. Primeiro contato de quem não tem conta (`bv.visitante.convite`, AI:1506)

**Antes** (resumido, cerca de 1.200 caracteres): régua, "precisão máxima", "GRÁTIS" em caixa alta, a equipe inteira e assinatura fora do padrão.
```
Olá! 👋 Que prazer falar com você!

Eu sou a *Sirlene*, sua nutricionista virtual! 🥗

Faço parte de uma equipe incrível:
💪 *Alex* - Personal trainer
🩺 *Dr. Vital* - Médico especialista
🎯 *Rafael* - Mentor de bem-estar
🥗 *Sirlene* - Nutricionista (sou eu!)

───────────────

🎁 *Quer fazer um teste GRÁTIS?*
…
Tudo com precisão máxima! 🎯
…
_Sirlene 🥗_
```

**Depois** (cerca de 330 caracteres):
```
👋 *Oi! Aqui é a Sirlene, do eLiving*

Eu cuido da parte de alimentação no app.
Quer testar agora? Mande uma foto do seu prato e eu estimo as calorias e os nutrientes.

Para guardar seu histórico, crie sua conta grátis:
app.eliving.com.br

_Sirlene · eLiving_
```

### Exemplo 2. Laudo pronto (`exame.resultado.laudo_pronto`, `WhatsAppCallback.ts:296-301`)

**Antes:** régua, sem nome e a senha junto com o link.
```
🩺 *Laudo pronto*

━━━━━━━━━━━━━━━━

https://…/laudo/…

*Código para abrir o laudo*
482915

Copie só os 6 números e cole na página.

_Dr. Vital · eLiving_
```

**Depois:** a senha já foi enviada antes, em `exame.senha.gerada`, e não se repete aqui.
```
🩺 *Rafael, seu laudo está pronto*

Abra pelo link abaixo. Ele vale até 13/10.
https://…/laudo/…

Use a senha de 6 números que te mandei antes, aqui na conversa.
Por segurança, ela não vem junto com o link.

_Dr. Vital · eLiving_
```
Para PDF, que não tem senha, a mensagem é outra e abre pelo login do app. Não pode dizer "a senha que você criou".

### Exemplo 3. Aluno escreve "estou com fome" (`conv.fome`, `instant-responses.ts:500`)

**Antes:** vigilância e culpa.
```
🍽️ *Bora matar essa fome com consciência!* 💚

*Como quer registrar?*

📸 *Envie uma foto* da refeição → analiso calorias e nutrientes
✍️ *Descreva* o que vai comer ou comeu → ex: "almocei arroz, feijão e frango"

Assim a gente cuida da sua meta e você não fica no escuro! 🥗
```

**Depois:** acolhe e oferece ajuda, sem cobrar registro.
```
🍽️ *Fome é sinal, Rafael, não é problema*

Quando comer, me mande uma foto do prato ou me conte o que foi.
Eu estimo e você decide se salva.

_Sirlene · eLiving_
```

---

## 14. Lista de conferência antes de publicar uma mensagem nova

1. Tem um `id` no catálogo e mora no módulo de mensagens do fluxo, não solta no handler.
2. Tem um personagem só, o dono do assunto, e termina com a assinatura certa.
3. Usa o primeiro nome (ou nenhum) e a forma neutra quando não há gênero.
4. Usa `*` simples, não tem régua, tem até 1.000 caracteres e até 3 emojis.
5. Números com vírgula e espaço antes da unidade; `—` para desconhecido; `≈` para estimativa.
6. Opções `*1*` com mapeamento gravado, sem "clique".
7. É honesta: não promete lembrete, não diz que salvou sem salvar e explica a falha.
8. Não tem culpa, bronca nem cobrança.
9. Passa em `padrao-premium.test.ts` e `brand-visible-text.test.ts`.
