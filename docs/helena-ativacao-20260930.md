# Ativação do contrato de execução e entrega — 30/09/2026

Este registro complementa os checkpoints anteriores. A fonte operacional continua sendo o Supabase e o estado confirmado do runtime Hermes. Configuração disponível não comprova qualidade de uma entrega real.

## Implantado

- Gateway `aa177da`, deploy EasyPanel confirmado às 21:47:30 UTC, saudável e conectado ao Supabase.
- Os 21 perfis passaram na descoberta de ferramentas. São 20 perfis operacionais e Laura com escopo pessoal; a separação foi preservada.
- `submit_work` recebe a entrega profissional e cria a memória durável e as referências reais no Gateway. Reenvio idêntico reaproveita duas operações idempotentes; não há uma transação única nem aprovação automática.
- `get_visual_asset` entrega pixels dos PNGs privados verificados, restritos à tarefa/empresa e aos leitores autorizados. Aprovação visual exige abertura de cada arte pelo revisor atual, além do parecer de qualidade.
- Maya dispõe de `helena_visual.generate_design`, conectado ao provedor nativo Codex autenticado do Hermes. Cada job/slot/versão admite uma solicitação de geração; falha ou resultado incerto exige reconciliação. Upload pode reutilizar o PNG já renderizado.
- A geração usa a identidade aprovada atual, imagem protagonista e copy exata. O adaptador aplica o logo original no canto inferior direito, preserva proporções e reserva área inferior de stories.
- A entrada MCP usa `MCPServer` do SDK Python 2.0.0 instalado no Hermes.
- O renderizador MCP do Hermes convertia pixels em um caminho de arquivo textual. O adaptador `install_native_mcp_pixels.py` preserva o envelope multimodal nativo para PNGs privados verificados do Gateway. Ele atua somente em memória nos processos lançados pelo despachante e pelo consumidor de revisão; a instalação do Hermes permanece intacta. Uma cópia do renderizador original foi guardada para auditoria. Outros servidores e retornos continuam usando o renderizador existente. O preflight detecta ausência ou incompatibilidade antes da execução; atualizações do Hermes exigem reconciliação do adaptador.
- Backups da instalação existem em `/data/helena-runtime/delivery-backup-*`. Relatório dos 21 perfis: `/data/helena-runtime/activation-preflight-20260930.json`.

## Evidência de testes

- Gateway: 267 testes aprovados e 29 verificações adicionais de segurança aprovadas. Inclui UUID válido no recibo VISUAL_ASSET_OPENED; a leitura real encontrou e motivou essa correção.
- Python local: 74 testes, 73 aprovados e um teste Linux de bloqueio de arquivo omitido no Windows. Inclui o lançamento do CLI pela ponte visual.
- Hermes Linux: três testes finais de composição/geração idempotente e dois testes da ponte multimodal aprovados, além dos testes anteriores do instalador. CLI pela ponte inicializou com sucesso sem chamada de modelo.
- Supabase: auditoria das 20 rotas de execução/revisão e dos 21 perfis passou dentro de transação revertida. Nenhuma tarefa de teste permaneceu no banco.
- Descoberta das ferramentas não realizou chamadas aos modelos. Autenticação do provedor de imagens disponível não comprova uma geração real concluída.

## Briefing existente corrigido

Foi revisado o mesmo job `JOB-HR-d4b5b488e4716e749cb7b1392e308424`, sem criar substituto, iniciar modelo ou aumentar tentativas. A tarefa continua DRAFT, com uma tentativa utilizada de duas. A revisão respondeu `task_version=3581`.

O briefing antigo proibia imagens/logo, exigia SVG e citava Helena como revisora. O contrato corrigido exige GENERATED_IMAGE, a identidade BIZ-003 versão 3038, o logo aprovado, um post e três stories na versão 2, a copy fonte já aprovada e Nina/AGT-10 como revisora canônica. Recibo: `/data/helena-runtime/activation-brief-20260930.json`.

## Limites e fechamento pendente

- Ainda é necessário comprovar uma geração real, leitura dos pixels pelo modelo, revisão independente, pacote utilizável e visualização em Entregas. A aprovação técnica anterior de artes vazias não é reutilizada.
- A copy fonte é uma apresentação interna antiga e genérica. Uma campanha comercial atual deve receber copy aprovada compatível com a descrição atual da Humano Digital e destino de CTA confirmado.
- Marina `JOB-HR-6e9e2c7f008a9993f7689e5e0defb53f` esgotou duas tentativas. Não foi reiniciada, duplicada ou liberada.
- Não foi comprovada uma tarefa comercial real por cada um dos 21 perfis nesta rodada. A auditoria de autorização é distinta dessa prova.
- O checkpoint mestre antigo requer sincronização; seu ponteiro não foi sobrescrito.
- Publicações, mensagens a clientes, despesas e aumento de tentativas dependem do escopo específico autorizado.

## Fluxo esperado

Pedido à Helena → briefing completo e tarefa no Supabase → liberação pela coordenação → Gateway/Hermes executa com o perfil correto → `submit_work` registra conteúdo e evidências → revisor independente aprova ou devolve → coordenação encaminha a próxima etapa autorizada → pacote final em Entregas. O painel web Hermes serve para administração; a execução do serviço não exige a aba aberta.
