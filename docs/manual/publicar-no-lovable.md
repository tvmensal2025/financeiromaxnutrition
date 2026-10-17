# Publicar o site da Helena v2 no Lovable a partir da `main`

Passos curtos para o **fundador**. Escritos em 17/10/2026 sem acesso ao projeto Lovable: os nomes dos botões do Lovable podem diferir (NÃO CONFIRMADO); o que vale é a ordem e o que conferir. O checkout não traz projeto Lovable nem workflow de publicação, só `lovable-tagger` no `package.json`; **o domínio de produção é NÃO CONFIRMADO**.

## Antes de começar

1. O merge na `main` já foi feito no GitHub (repositório `tvmensal2025/financeiromaxnutrition`). O site é um app React/Vite (`npm run build`); não há servidor próprio.
2. Você precisa entrar no site com a conta de **fundador** (as telas `/comando` e `/configuracoes` são só dele).
3. Nunca cole chave, senha ou token no chat. Abaixo só aparecem **nomes** de variáveis.

## Passos

1. No Lovable, abra o projeto da Helena e vá em configurações de **GitHub / Conexão com o GitHub**. Confirme que ele aponta para `tvmensal2025/financeiromaxnutrition` e para a branch **`main`** (não para `claude/…` nem `codex/…`).
2. Sincronize: traga as mudanças do GitHub para o Lovable (pull / sync). Espere o Lovable terminar de ler o código e compilar. Se aparecer erro de build, pare e mande a mensagem para a Claude.
3. Confira as **variáveis do projeto** (ambiente / secrets do Lovable), só os nomes:
   - `VITE_SUPABASE_URL` = `https://wxkgrykduqtsgmjkzlou.supabase.co` (é público; projeto `ecosistemadossonhos`).
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = a chave **pública** (publishable/anon) do mesmo projeto. Pegue no painel do Supabase em **Settings → API**, direto no navegador, e cole **no campo do Lovable**, nunca em chat. Nunca use a `service_role` nem a chave secreta.
   - Se as duas ficarem vazias, o app usa os valores embutidos em `src/lib/supabase.ts` (a mesma URL e uma chave publishable). Funciona, mas valores errados definidos no Lovable têm prioridade sobre os embutidos: confira que a URL termina em `wxkgrykduqtsgmjkzlou.supabase.co`.
   - Não defina `VITE_MODO_TESTE_SEM_SENHA`, `VITE_TESTE_EMAIL` nem `VITE_TESTE_SENHA` na publicação (são só para teste local).
4. Clique em **Publish / Update** (publicar ou atualizar). Anote o endereço que o Lovable mostrar e a hora.
5. Abra o endereço publicado numa janela anônima e faça as conferências abaixo.

## Conferir as quatro telas

- `/login`: abre a tela "Entrar na Central"; entrar com e-mail e senha do fundador leva ao painel (`/`).
- `/comando`: "Governança" (só fundador): mostra o checkpoint mestre atual, decisões recentes e a configuração v2 ativa. Esta é a tela que prova que o site lê o Supabase certo.
- `/cards`: "Quadro de cards"; o fundador também vê o campo para registrar pedido em texto livre.
- `/configuracoes`: "Configuração e revisões" (só fundador): lista as revisões; confira qual está ATIVA.

Links antigos `/?card=...` continuam levando ao card em `/cards`. Se um endereço direto (por exemplo `/cards`) der página em branco ou 404 ao recarregar, é a regra de rotas do hospedeiro (NÃO CONFIRMADO); avise a Claude.

## O que NÃO é prova

- **CONNECTED não é OPERATIONAL.** A tela abrir, o Lovable dizer "publicado" ou a integração do GitHub aparecer "conectada" não prova que o motor, o Hermes, o Telegram ou a VPS estejam funcionando.
- A tela de login abrir não prova que o Supabase responde: só entrar com a conta do fundador prova.
- O build do Lovable passar não prova a versão certa: confira o SHA sincronizado e a hora da publicação (itens 1 e 7 da lista).
- `/configuracoes` mostrar revisão ativa não prova que o despachante da VPS esteja ligado (isso é `bash /root/instalar-motor.sh estado`, ver [vps-atualizar-e-corrigir-login.md](vps-atualizar-e-corrigir-login.md)).
- Testes locais e o relato da Claude não substituem olhar o site publicado.
- Uma chave configurada não prova homologação (CONFIGURADA não é homologada).

## Lista de verificação pós-publicação (10 itens)

1. O Lovable aponta para `main` e o último commit sincronizado é o do merge (compare o SHA curto).
2. Não há erro de build no Lovable.
3. `VITE_SUPABASE_URL` termina em `wxkgrykduqtsgmjkzlou.supabase.co`.
4. `VITE_SUPABASE_PUBLISHABLE_KEY` existe e é a chave pública, não a secreta (só confirme o nome e a origem; não leia o valor em voz alta nem em chat).
5. `/login` abre, sem erro, em janela anônima e no celular.
6. Entrar como fundador funciona e cai no painel `/`.
7. `/comando` mostra o checkpoint mestre atual e a configuração ativa (sem erro de leitura nem "0" no lugar de falha).
8. `/cards` abre o quadro; um card existente abre o detalhe, sem rolagem horizontal no celular.
9. `/configuracoes` lista as revisões e mostra qual está ATIVA.
10. Entrar com uma conta que **não** é fundador mostra mensagem de acesso restrito ao fundador em `/configuracoes` e `/comando`, sem dados do fundador.

Se qualquer item falhar, não afirme "publicado". Anote o item e a mensagem e mande para a Claude.
