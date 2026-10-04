# Logo fixo — aplicado em 03/10/2026

Pedido do fundador: posição e tamanho definidos em código para novas composições.

- Renderer instalado: official-logo-fixed-v3, em /data/helena-runtime/hermes_visual.py.
- SHA-256: e0cff7323ef15f9955c6ea7e5a2dd1d53696eec3082cd568d1de548941095472.
- Backup: /data/helena-runtime/fixed-logo-backup-20261003T073337Z.
- Recibo: /data/helena-runtime/fixed-logo-install.json.
- Identidade BIZ-003: campo logo_rules atualizado e aprovado na interface.

## Aplicação

Canvas final de 1080px de largura. Logo no canto superior esquerdo, x=64px. Post: y=64px. Stories 1, 2 e 3: y=250px. Caixa máxima 360x120px, proporcional. Reserva criativa de 24px ao redor. Bordas totalmente transparentes são descontadas, preservando desenho e slogan. Não adicionar rodapé nem placa ao logo. Para a marca atual, a direção orienta fundo claro na reserva; contraste e legibilidade continuam sujeitos à revisão visual.

O código aplica o arquivo oficial uma única vez e recusa coordenadas alternativas na recomposição. A geração recebe a reserva antes de criar a arte, com instrução de não desenhar outra assinatura. Isso não é detecção automática de logos que o gerador eventualmente invente: a revisão independente continua necessária.

## Validação e limites

15 testes passaram no Linux do Hermes, sem skips, com provedores e uploads simulados; nenhuma chamada paga. Incluem preservação de pixels fora do logo, alfa, padding transparente, ancoragem, bloqueio de deslocamento e recuperação de upload sem nova geração. O renderer anterior permanece apenas para conferir procedência de fontes históricas na recomposição.

Não foram regeneradas campanhas existentes. Arquivos reutilizados permanecem byte a byte iguais: não recebem alteração visual silenciosa. Processos MCP já carregados podem conservar o módulo anterior até nova inicialização; novas execuções devem conferir renderer.version em check_visual_runtime antes de gerar. Não declarar homologação de uma campanha com base somente nesses testes.
