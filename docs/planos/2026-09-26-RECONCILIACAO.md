# Reconciliação de continuidade — 26/09/2026

Resultado: `CP-20260926-V010` ATIVO, anterior `CP-20260926-V009`. Cadeia histórica preservada. Fonte: Supabase `ecosistemadossonhos`, `wxkgrykduqtsgmjkzlou`. Esta é uma fotografia da validação, não uma garantia permanente de ausência de divergências.

## Correções aplicadas no Supabase

- Estado Mestre: vínculo de foco corrigido para FOC-004; instruções antigas de criar V1/V2 substituídas pelo protocolo de versão ativa; integrações e fonte canônica reconciliadas.
- REC-0001 ligada à agenda existente AUTO-0006 / INT-0011, diariamente às 18h de São Paulo. Materialização paralela pelo executor antigo desabilitada no cadastro. Primeira execução automática continua não homologada.
- Identidade, contrato dos 21 agentes, planejamento, supervisão, fontes de retomada e pendências incluídos no checkpoint. Plano detalhado e mapeamento multiempresa persistidos em `memoria_mestre`, ID `MEM-PLANO-20260926`.
- Privilégios TRUNCATE, TRIGGER e REFERENCES removidos de anon/authenticated nas tabelas públicas; defaults de postgres ajustados.
- Escrita global de agentes, conexões e integrações restrita ao fundador. Cadastro de empresas: fundador administra, membro lê somente as empresas concedidas.
- Inventário de app_access legível pelo fundador; membros continuam vendo apenas sua própria linha. Isso elimina a falsa divergência de contagem 1/3 na auditoria da página.

## Evidência de validação

- 70 fontes: 69 tabelas e uma view; 1.489/1.489 campos mapeados, sem campos obsoletos ou duplicados.
- 68 contagens comparadas; checkpoint e view atual excluídos da contagem autorreferente.
- 20 projeções comparadas com os registros atuais, incluindo tarefas, agentes, decisões, estado, integrações, automações, recorrências e histórico de tarefas.
- Cadeia de versões, um único checkpoint ativo, WIP executivo igual a 1, planejamento e vínculo da agenda conferidos.
- Testes RLS com membro e fundador em transações revertidas. Auditoria executada também com papel authenticated/fundador, reproduzindo a permissão da página.
- Resultado das comparações: zero divergências no escopo acima. Sete verificações de vínculos sem inconsistências. Os 27 jobs sem task_id continuam explicitamente classificados como lacuna histórica, não como execução rastreada.
- Aplicação: 108 testes e build passaram. Gateway: 45 testes unitários, 11 verificações de servidor e 29 de segurança passaram, com rede externa simulada.

## Código local

GitHub incorporado até `83f2ab4`, sem conflitos remanescentes e com o trabalho local preservado. O stash de segurança da atualização foi mantido. Alterações locais não foram publicadas ou implantadas nesta reconciliação.

Configuração de voz persiste campos permitidos, provedor e voz no Supabase; recupera a configuração legada mais recente; não devolve credenciais à página; não encaminha chave de um provedor de IA a outro. Kokoro permanece padrão conforme cadastro oficial, ElevenLabs disponível como opção. Callbacks de fala/silêncio exigem autenticação. Falhas de testes do servidor agora retornam código de erro, e seus timers encerram com o servidor.

Plano de evolução da sala de comando usa o snapshot quando disponível à sessão; se estiver inacessível, identifica expressamente a proposta local. A página foi conferida na sessão existente do membro Theo, sem trocar de conta nem ampliar suas permissões. Essa sessão não confirma a leitura do checkpoint global do fundador.

## Pendências reais preservadas

Publicação/homologação externa do Gateway; identidade dos bots; vínculos dos jobs; canal por empresa antes de ampliar vendas; primeira janela agendada de TSK-0031; persistência do histórico detalhado de voz; aceite estruturado das decisões; validação dos sincronizadores externos. RSK-0007 continua aberto; a rotação permanece adiada conforme DEC-019.

O Supabase ainda aponta a [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Os dois avisos de [funções SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) correspondem aos helpers de RLS `is_founder` e `user_has_business_access`, que verificam o usuário autenticado e o cadastro ativo. Não foram removidos porque são usados pelas políticas de acesso.

## Reproduzir e retomar

`scripts/validar-checkpoint-continuidade.sql` compara a versão ativa com as fontes e falha se encontrar divergência. Os scripts de sincronização são separados dos de leitura e preservam o histórico.

Em outra conversa com acesso autorizado ao mesmo Supabase: “Helena, carregue o Checkpoint Mestre e valide contra o estado atual.” A agenda local do Codex não é transferida automaticamente para a nova conversa e não deve ser duplicada.
