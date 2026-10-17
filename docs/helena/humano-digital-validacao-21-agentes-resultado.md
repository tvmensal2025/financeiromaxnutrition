# Validação rápida do Humano Digital

**Lote:** `HD-VALIDACAO-21-AGENTES-20260929`  
**Empresa:** `BIZ-003 · Humano Digital`  
**Modo executado:** validação estrutural sem chamadas de modelo e sem ação externa.

## Resultado

- Cadastro canônico conferido: **21 agentes**.
- Funções e nomes conferidos contra `docs/helena/dados-v1/agentes.json` (antes `src/lib/agentes.json`): **21/21**.
- Sequência de handoff: **21 etapas, 21 IDs únicos**.
- Campos obrigatórios do lote vazios: **0**.
- Despacho: **Marina (AGT-04)**.
- Revisão estrutural de cada checkpoint: **Bruno (AGT-13)**.
- Gate de decisão e exceções: **Helena (AGT-01)**.
- Ações externas permitidas neste teste: **não**.
- Chamadas de modelo realizadas: **0**.

## Ordem do teste

Helena define o limite → Augusto estrutura a hipótese → Ravi separa fatos e hipóteses → Bianca define os papéis humanos → Clara aponta riscos → Pedro define parceiros → Victor define o pipeline → Camila desenha o funil → Isabela prepara a copy → Maya especifica o post/story → Nina organiza a jornada → Daniel define os eventos → Caio fecha o controle financeiro → Marina transforma em checklist → Theo confere o fluxo técnico → Bruno valida qualidade → Renata define ativação → Joana define atendimento → Felipe define os registros → Olívia transforma em rotina → Laura resume para o fundador → Helena decide o próximo lote.

## Regra contra entrega vazia

Uma entrega só pode avançar com resumo, evidência e payload. Para imagens, o Gateway agora recusa PNG corrompido, transparente, uniforme ou sem variação visual, além de exigir as dimensões do slot. Assim, uma imagem “gerada” sem conteúdo não pode ser registrada como pronta.

## Limite desta validação

Este resultado comprova o cadastro, o contrato e as travas locais. Ele **não** comprova que os 21 perfis externos executaram uma chamada real. O despacho real deve começar com este lote em `DRAFT`, passar por `READY → CLAIMED → RUNNING`, registrar cada evento no Supabase e só aceitar `COMPLETED` após evidência e revisão. Nenhuma tarefa foi liberada automaticamente nesta etapa, para evitar consumo de créditos e efeitos externos antes do contrato passar.
