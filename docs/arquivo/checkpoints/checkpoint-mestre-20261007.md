# Checkpoint Mestre V036 — 07/10/2026

## Resumo
Hermes migrado para o VPS (EasyPanel) com 21 perfis; Supabase sem laço infinito; agentes atendem as 4 empresas com web e visão por função; financeiro delegado ao Caio; EM_RESOLUÇÃO (replanejamento/escalada) e ferramentas de coordenação (nota, correção de rascunho, encaminhamento enxuto); legado encerrado; cadeia real plano PMO → pesquisa web D1 → estratégia D2 aprovada.

## Mudanças desde V035
- Supabase: conflito de versão retorna PT409 (fim do laço infinito de 40001)
- Hermes migrado para o VPS EasyPanel (21 perfis); Hostinger pausada como reserva até 27/10
- Pacote de contexto 120 mil caracteres; texto 600 s; falha de infraestrutura não consome tentativa
- Skills por função e QA do Bruno; web/visão por função (sem terminal, arquivos ou código); ferramentas nativas nomeadas no prompt
- Agentes atendem as 4 empresas: helena_agent_serves + agent_business_scopes (19 agentes × 4 empresas CONFIRMED)
- Financeiro: Helena recebe e delega; Caio usa registrar_lancamento (conta deve existir; contas_financeiras ainda vazia)
- EM_RESOLUÇÃO: fase REPLAN, replan_job (substituir até 2 vezes ou escalar ao Fundador)
- Coordenação: record_coordination_note, revise_draft_brief, HANDOFF_CLOSED e encaminhamento sem resumo anexado
- Legado encerrado com autorização: 38 missões, 31 tarefas, 45 encaminhamentos, 10 execuções (histórico preservado)
- Cadeia real aprovada: plano PMO da Marina, pesquisa web D1 do Ravi, estratégia D2 do Augusto; coordenação da Marina liberada
- Backup diário do volume do Hermes no VPS (03:30, retenção 7 dias)

## Pendências
- Trocar as chaves expostas no chat em 07/10 (SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, Google, R2, ElevenLabs, Evolution, TypeSafe, tokens internos)
- Porta 9119 do painel Hermes publicada no IP público (/api/status sem autenticação)
- Volume vazio helena-automation_hermes-agent_data (remoção cabe ao Fundador)
- contas_financeiras vazia: cadastrar contas para o Caio lançar
- agent_connections ainda registra GROK/CHATGPT
- Publicar o Gateway com revise_draft_brief (pacote helena-gateway-rascunho.zip)
- 4 testes antigos de política editorial falhando (anteriores a 07/10)

## Próxima ação
Marina executa a coordenação de reuso da estratégia (revisão independente da Helena); depois a coordenação avalia a campanha da Camila. Fundador: trocar as chaves expostas e cadastrar contas financeiras.
