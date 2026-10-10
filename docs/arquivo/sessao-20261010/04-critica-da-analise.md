# Crítica de completude da análise dos especialistas

Data: 10/10/2026. Feita por um agente independente sobre o documento 03-analise-especialistas.md. Os 12 pontos abaixo valem como correções obrigatórias antes de usar as melhorias MEL-01 a MEL-48.

**Crítica de completude: "Sistema Helena: análise dos especialistas e plano de melhoria"**

Esta análise só leu arquivos. Conferi quatro pontos nos arquivos: o ramo atual (`claude/gallant-cray-xrdt0t`), a contagem de migrations, o HANDOFF e o código da URA e das ligações da v1.

**1) O que falta, o que se contradiz e o que fere as restrições**

1. **O documento conta com uma trava que não existe nos workflows do GitHub.** A MEL-05 admite que a sessão de IA entra com o seu login e como administradora, e que você não controla as permissões desse acesso. Mesmo assim, MEL-02, 07, 12, 13, 14, 28 e 46 e o teste 11 continuam dizendo "antes de as sessões perderem a permissão de mudar workflows". Isso nunca vai acontecer. Na prática, todo teste automático (gitleaks, auditoria, conferir_plano, receitas, montagem da imagem) é só um aviso que a própria sessão consegue mudar.
   - **Correção:** escrever no plano que os testes do GitHub protegem contra erro, não contra uma sessão desviada. Tirar do teste 11 a linha "sessões não editam workflows" e pôr no lugar "nenhuma credencial de produção no GitHub". Levar a você, como decisão, a opção de uma conta separada e sem administração para as sessões.

2. **A cópia do banco da fase 0a não tem quem a execute.** As sessões na nuvem recebem 403 ao tentar chegar ao Supabase. No seu PC, o Windows bloqueia o `supabase.exe` (HANDOFF l. 75). E a MEL-01 proíbe pôr senha do banco no GitHub principal. O documento também não diz quem roda o SQL das mudanças da 0a.
   - **Correção:** criar o `helena-backup` já na 0a e usar nele um workflow que você mesmo dispara para fazer a cópia completa criptografada. Para cada passo de SQL da 0a, dizer quem executa: você, no editor SQL, com o script e o caminho de volta prontos.

3. **O portão 0a não tem como passar como está escrito.** São três problemas:
   - Ele exige "segredos de 07/10 trocados", mas o §8 deixa você escolher trocar só "no fim dos testes".
   - Ele exige "checklist da v1 verde", mas a v1 travou, e o ponto de partida pode já estar vermelho.
   - O checklist não testa o caminho da DEC-022 (criar empresa) nem a URA de clientes.
   - **Correção:** o portão passa a depender da sua escolha sobre as chaves. O critério vira "igual ou melhor que antes do passo". O checklist ganha a DEC-022 e a URA.

4. **A v1 tem contato com pessoas de fora que ninguém pesquisou.** O plano (l. 208) e a MEL-01 travam o WhatsApp no seu número. Só que a v1 tem uma URA que responde clientes (menu Vendas e Suporte, resposta automática; `services/helena-gateway/src/whatsapp-ura.mjs`). Ela também faz ligações de saída por IA para qualquer telefone (`integrations/meowcaller.mjs`, rota `/api/integrations/meowcaller/call`). Se o WhatsApp for travado, a URA de clientes para. Se a URA continuar, ela esbarra em "agentes nunca contatam pessoas de fora".
   - **Correção:** fazer um inventário do que a v1 faz com terceiros e um cartão de decisão: desligar a URA (avisando os clientes) ou mantê-la como exceção escrita. Ligações de saída só com o seu toque.

5. **Três regras de qualidade se sobrepõem, como as 7 guardas da v1.** A MEL-26 rebaixa o serviço sozinha a cada escape. A MEL-42 só põe o serviço em observação com 2 escapes em 10 entregas. A MEL-41 suspende o par revisor depois de uma prova de confirmação. E o disjuntor de 3 falhas continua existindo. Um único escape rebaixa ou não?
   - **Correção:** uma tabela só de estados de qualidade, no `passagens.yaml`, com precedência entre as regras e coberta pela prova em camadas.

6. **Três regras suas sobre autorização ficam furadas.**
   - A MEL-44 diz "Sua frase: não", mas grava as 50 mensagens numa tabela do Supabase na fase 4, fora da frase da fase 2, e lê dados da v1, que só o seu PC alcança.
   - A MEL-45 cria a tabela de regras no banco também com "Sua frase: não".
   - A MEL-10 faz a autorização de execução vencer em 7 dias, contra o AGENTS.md ("não pedir novamente se já concedida para a mesma ação").
   - **Correção:** separar "Sua frase" em duas: uma para o texto do plano e outra para a mudança no banco ou servidor. MEL-44 e MEL-45 ficam com "sim" na segunda. A autorização deixa de vencer por data: vale até ser usada e só pede de novo se a versão, o estado ou o escopo mudarem.

7. **Ninguém somou os minutos do GitHub.** Só o que já existe e o que já foi calculado:
   - a v1 gasta cerca de 730 minutos por mês;
   - o cartão de diagnóstico, cerca de 240.

   Ficaram sem conta: o gitleaks e o commits.yml em cada envio (cada job é cobrado como no mínimo 1 minuto, e são cerca de 300 envios por mês), app, especificações, arrumação, auditoria, prévia, banco.yml, imagem, a issue diária, o backup e a restauração. O backup e a restauração gastam a mesma cota da conta, mesmo ficando no `helena-backup`. A meta de 1.200 minutos estoura, e quando a cota acaba o backup para.
   - **Correção:** uma tabela única de minutos na fase 0, antes de ligar qualquer workflow. Juntar as checagens leves num job só por envio. Ligar os workflows por prioridade: backup, diagnóstico, gitleaks.

8. **O risco jurídico e de dados da primeira meta não foi pesquisado.** O documento não diz o que são a Mimix e o Hub, nem se recrutar pessoas para elas traz risco de pirâmide ou marketing multinível (por exemplo, a Lei 1.521/51, art. 2º, IX, e o CDC). Também não trata da base legal (LGPD) para guardar e contatar os recrutados. Tudo fica para o parecer da Clara (E4), sem fontes definidas.
   - **Correção:** um item de pesquisa antes do plano da meta, com fontes oficiais aprovadas por você, e uma linha de LGPD dizendo o que se guarda, por quanto tempo e como se apaga.

**2) Afirmações falsas ou exageradas**

9. **Promessas absolutas.**
   - "Todo card termina, e o histórico dele nunca é apagado" (§2): a MEL-23 só garante que o card termina quando você para de pedir ajustes. E o histórico é apagado, sim: a MEL-16 apaga dados em até 8 semanas (LGPD) e o plano tem limpezas de 7 e de 14 dias.
   - "O que está no ar é exatamente o que foi testado" (MEL-06): a própria verificação diz que isso protege contra acidente, não contra adulteração, porque a sessão controla o teste e a montagem.
   - "Imagem ou script de fora não carrega no app" (MEL-38): a trava libera o R2, o Supabase, as fontes e estilos em linha.
   - "Fecha em dias" (MEL-01).
   - **Correção:** trocar por frases medidas, como "fora da lista de origens" e "o que passou no teste da versão X".

10. **Números e fatos dados como certos sem estarem confirmados.**
    - Vercel Pro a US$ 20: é por membro, mais o uso, e não foi reconferido.
    - Functions "300 ou 800 s": existe o modo estendido de 1.800 s, e esse limite nem é o motivo que decide.
    - GitHub Pro "cerca de US$ 4": NÃO CONFIRMADO.
    - "gh-aw: todos os motores exigem API paga ou Copilot pago": não foi conferido se o Copilot gratuito serve.
    - "9 cópias" e "o procedimento do Bruno é de growth": sem fonte. A verificação fala só da área "cliente".
    - "73 migrations": a main tem 55. As outras 18 estão em ramos que o §7 manda não juntar, e não está confirmado quais rodaram na produção.
    - MEL-05 e MEL-06 dão como certo que o EasyPanel aceita a impressão digital no campo e tem verificação em duas etapas: os dois estão NÃO CONFIRMADOS.
    - Hostinger com "Recomendado: A (renovar)": o checkpoint fala em "pausada como reserva até 27/10". Recomendar pagar antes de saber o que vence é exagero.
    - **Correção:** marcar todos esses como NÃO CONFIRMADO. Para a Hostinger, não recomendar nada até você conferir o painel.

**3) Itens do plano v3 mudados sem justificativa suficiente**

11. **Tirar o DBOS (MEL-20).** No plano, o DBOS já está decidido (LEIA-PRIMEIRO l. 26 e 50), e não existe "decisão nº 1" em aberto. É uma reversão da fonte da verdade. Dos quatro motivos dados, três caem por outras propostas aceitas:
    - "100 retomadas" se configura: o próprio documento oferece "no máximo 3".
    - "Ordem aleatória" some com a fila única da MEL-21.
    - "Fluxos ressuscitados na restauração" some porque a MEL-16 deixa o DBOS fora do backup.

    Sobra só "duas máquinas de estados". MEL-21, 35 e 37 foram verificadas supondo o DBOS: o reenvio de avisos era justamente "um passo do DBOS" e, sem ele, volta a ser escrito à mão. E não está confirmado se a trava pega pelo pooler é liberada quando o motor cai.
    - **Correção:** apresentar como reversão, com os motivos que de fato sobram. O cartão deve listar o que cada opção obriga a escrever à mão. Reescrever MEL-21, 35 e 37 nas duas versões. A liberação da trava vira teste que bloqueia.

12. **Regras do plano alteradas sem aviso.**
    - A MEL-30 afrouxa a regra 4: a Clara, autora da E4, revisa a E5.
    - A MEL-27 muda três regras do plano: "no máximo duas ferramentas", "servidor vazio" e "uma única nova tentativa de formato" (K-13/A-17). A frase "a primeira ação aceita encerra a execução" bate de frente com a l. 96, porque uma execução encerrada antes do fim conta como falha de infraestrutura. E não foi confirmado como o Hermes -z se comporta.
    - A MEL-02 troca "desligar com volta" (l. 213) por "revogar", que não tem volta.
    - **Correção:** listar essas mudanças em "Resposta direta", antes da frase AUT-0001. Manter o canal da v3 até o dia de prova, como diz a MEL-35. Revogar só depois de um período medido sem nenhum uso da chave antiga.

Arquivos citados:
- `/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag/services/helena-gateway/src/whatsapp-ura.mjs`
- `/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag/services/helena-gateway/src/integrations/meowcaller.mjs`
- `/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag/HANDOFF-CLAUDE-CODE.md` (l. 75)
- `/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag/docs/planos/sistema-helena-pacote/01-plano-v3.md` (l. 208)
- `/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag/docs/planos/sistema-helena-pacote/LEIA-PRIMEIRO.md` (l. 26 e 50)