# Piloto Augusto — diagnóstico de implantação

Data: 28/09/2026. Escopo: uma execução da tarefa existente TSK-HD-20260927-03, sem duplicação e sem repetição automática.

## Evidência observada

- O chat Marina na Hostinger está autenticado, em GPT-6 Luna. A resposta do agente confirmou o job DRAFT, a versão da tarefa e o despachante `/data/helena-runtime/hermes_dispatch_once.py`. Esse estado foi relatado pelo perfil; não foi reconfirmado por conexão direta ao Supabase nesta etapa.
- A checagem pelo Terminal do agente informou Hermes ausente no PATH; a busca adicional terminou com PermissionError. Não há prova de que o Hermes esteja ausente da instalação. Uma restrição do ambiente de ferramentas pode impedir subprocessos; não ampliar privilégios nem desativar restrições como tentativa de correção.
- O console administrativo do serviço `hermes-agent` no EasyPanel respondeu diretamente: diretório `/opt/hermes`, executável `/opt/hermes/bin/hermes`, também `/opt/hermes/.venv/bin/hermes`. Os caminhos `/data/profiles` e `/data/helena-runtime` não foram encontrados nesse contêiner. Portanto esse ambiente não está comprovado como o runtime da Hostinger; nenhuma configuração dele foi alterada.
- O hPanel da Hostinger redirecionou para login. É necessário acesso administrativo à instalação correta para confirmar caminho, usuário, permissão e forma suportada de despacho.

## Correção preparada, ainda não instalada no runtime Hostinger

O despachante agora procura o executável no PATH e, se ele não estiver configurado explicitamente, nos caminhos padrão `/opt/hermes/bin/hermes` e `/opt/hermes/.venv/bin/hermes`. Uma escolha explícita em HERMES_BIN nunca é substituída por outra instalação. Só aceita arquivo executável, não altera PATH, não instala pacotes e não contorna erros de permissão.

Validação local: 23 testes do despachante passaram, sem rede ou modelo. A publicação deste arquivo no runtime correto continua pendente. Publicar apenas o Gateway não atualiza esse arquivo no host Hermes.

## Próxima etapa

Depois do login administrativo: confirmar a instalação e a restrição real; fazer backup do despachante anterior; instalar a versão validada no runtime correto; executar preflight sem modelo; só então liberar e despachar uma única tarefa. Consultar entrega, evidência e revisão, e verificar o resultado no painel. Parar ao final do piloto e informar resultado e pendências. Não chamar um agente para corrigir infraestrutura nem repetir tentativa paga sem diagnóstico.
