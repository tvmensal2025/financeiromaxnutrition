# Revisão diária da Helena no ChatGPT

## Estado atual — 26/09/2026

O fundador escolheu o ChatGPT web, podendo trocar de chat, sem API separada. A agenda local do Codex foi **pausada**: `helena-checkpoint-di-rio-de-supervis-o`. AUTO-0006, INT-0011 e REC-0001 preservam esse histórico. Nenhuma substituta foi ativada no ChatGPT nesta alteração.

O navegador disponível estava sem login. Ainda é necessário verificar tarefas agendadas e acesso ao Supabase nessa conta. A TSK-0031 concentra a implantação; não foi aberta outra frente executiva.

## Funcionamento previsto

1. Uma tarefa do ChatGPT revisa o lote diário, carregando a identidade, regras, foco e mudanças relevantes do Supabase. A cadência proposta continua uma janela às 18h de São Paulo.
2. Havendo mudança relevante, grava um parecer idempotente em `auditoria`, com `acao=CHECKPOINT_SUPERVISAO_LOTE`. A aba Supervisão já lê esses pareceres.
3. O resultado é entregue pela tarefa do ChatGPT. Ela não envia automaticamente para qualquer conversa que o fundador abrir.
4. Em outro chat autorizado, basta pedir que Helena carregue o checkpoint ativo e o último parecer. A memória vem do Supabase; a autenticação e as ferramentas precisam estar disponíveis nesse chat.

Gmail e WhatsApp não fazem parte desta configuração.

## Ativação e homologação

Usar [as instruções prontas](./prompt-revisao-chatgpt.txt), também preservadas no Supabase em `MEM-SUPERVISAO-CHAT-20260926`.

Entrar no ChatGPT, verificar a disponibilidade da tarefa e da conexão, testar leitura real e confirmar permissão para gravar o parecer durante a execução agendada. Registrar o identificador real da nova agenda, vinculá-la ao controle de supervisão e manter a agenda Codex pausada.

Homologar somente após uma execução agendada produzir um parecer no Supabase, aparecer no painel e entregar o resultado no ChatGPT. `AUD-HCP-20260926-BASE` é uma revisão assistida histórica, não uma execução agendada comprovada. TSK-0032 a TSK-0034 permanecem canceladas.

## Custo e limites

Uma análise compacta por janela, sem IA por tarefa nem por atualização da página. Sem mudança relevante, não repetir parecer ou mensagem. A checagem ainda pode consumir uso do plano ChatGPT; silêncio não significa consumo zero.

Nenhuma API paga separada é necessária para a opção escolhida, desde que o recurso esteja disponível no plano. Não recriar uma agenda local como alternativa nem ativar uma segunda janela ou serviço pago sem nova escolha do fundador.

Conexões do Codex não comprovam acesso no ChatGPT. Falta de conexão deve ser informada, sem preencher lacunas com memória antiga.

Referência: [documentação oficial OpenAI — tarefas agendadas](https://learn.chatgpt.com/docs/automations), consultada em 26/09/2026. Disponibilidade depende do plano e das configurações da conta.
