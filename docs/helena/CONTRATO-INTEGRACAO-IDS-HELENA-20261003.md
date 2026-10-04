# Contrato de integração IDS-Max ↔ Helena-HUB

## Estado verificado em 03/10/2026

O frontend validado está em `C:\Users\plata\financeiromaxnutrition` e o núcleo de continuidade e despacho está em `C:\Users\plata\Documents\Codex\Helena-HUB`.

Os dois projetos usam o projeto Supabase `wxkgrykduqtsgmjkzlou` (`ecosistemadossonhos`). O frontend consulta as tabelas canônicas por `@supabase/supabase-js`; o Gateway Hermes usa o mesmo estado canônico por suas credenciais de perfil.

## Regra de acesso

As tabelas `agentes`, `tarefas`, `agent_jobs`, `agent_job_events`, `handoffs` e `checkpoint_mestre_atual` não devem ser abertas para `anon`. A leitura anônima retorna `42501`, o que confirma a barreira de RLS. A aplicação deve ler depois de autenticar o usuário e deve exibir erro de sessão quando a leitura autenticada não estiver disponível.

O teste correto é:

1. conferir URL e chave publicável sem imprimir o valor;
2. confirmar que o endpoint Supabase responde;
3. aceitar `42501` no teste anônimo como `AUTH_REQUIRED`;
4. validar a sessão autenticada no navegador;
5. ler empresa, tarefa, job e eventos com o mesmo `business_id`;
6. impedir que a interface transforme cadastro de agente em execução comprovada;
7. encerrar a validação somente com entrega, revisão e evidência persistidas.

## Resultado atual

- Testes locais do IDS-Max: 24 suítes, 142 testes aprovados.
- Build local do IDS-Max: aprovado.
- Conectividade pública do Supabase: confirmada.
- Acesso anônimo às tabelas: corretamente bloqueado por RLS.
- Leitura autenticada do Hermes: já foi comprovada em contexto de trabalho, mas a homologação individual dos 21 agentes permanece pendente.
- Não houve escrita neste diagnóstico.

## Verificação reproduzível

Na raiz do IDS-Max, execute:

```text
node scripts/verificar-conexao-helena.mjs
```

O resultado esperado sem sessão é `SUPABASE_REACHABLE_AUTH_REQUIRED`. Isso é uma condição segura e esperada. O resultado não autoriza declarar os agentes operacionais; essa conclusão exige a leitura autenticada e o ciclo real de cada job.
