# Helena-HUB — continuidade local

## Escopo

Estas orientações valem para todo o projeto. Responder em português e seguir as instruções mais recentes do fundador.

## Fonte canônica

- Supabase oficial: `ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou`.
- Confirmar identidade do projeto antes de consultar dados.
- Ao carregar contexto, começar por `public.checkpoint_mestre_atual`; nunca fixar uma versão.
- Executar o procedimento de `docs/manual/comando-mestre.txt` quando solicitado o carregamento/validação.
- Sem conexão autorizada, informar: `SUPABASE NÃO CONECTADO — não é possível carregar o Sistema Helena com segurança.`

## Leitura e alterações

- O comando de carregamento é somente leitura. Usar transações `READ ONLY` nas consultas SQL da auditoria.
- Durante o carregamento, não alterar tabelas, tarefas, handoffs ou decisões; não criar checkpoint, executar jobs, reativar recorrências, aplicar migrations ou rotacionar credenciais.
- Alterações no banco exigem autorização explícita do fundador; não pedir novamente se já concedida para a mesma ação.
- O comando de sincronização só cria nova versão quando existe mudança material, preservando histórico.
- Na divergência, informar `CHECKPOINT REQUER SINCRONIZAÇÃO`; não corrigir silenciosamente.

## Precedência e evidência

1. Estado real atual do Supabase/produção.
2. Decisões vigentes e Estado Mestre.
3. Checkpoint Mestre ativo.
4. Memória Mestre e handoffs.
5. Arquivos, relatórios e conversas históricas.

- Antes de propor criação ou retrabalho, consultar o existente: JÁ EXISTE / PARCIAL / AUSENTE / DIVERGENTE. Sem verificação suficiente: NÃO CONFIRMADO.
- Respeitar WIP executivo = 1 na esteira autônoma de agentes. Comandos diretos do Fundador para criar empresas, contas ou entidades têm precedência soberana (DEC-022) e devem ser materializados imediatamente na tabela de destino (public.portfolio para empresas, etc.).
- Marca Oficial eLiving™ (DEC-023): A empresa é formalmente eLiving™ (com "e" minúsculo e "L" maiúsculo, sem hífen, jamais "E-living" ou "Iliving"). Slogan: "Onde sua evolução ganha direção." Posicionamento inegociável: inteligência pessoal de evolução, nunca app fitness comum ou contador de calorias. Quatro pilares obrigatórios: Sirlene (Nutrição), Doutor Vital (Saúde), Alex (Movimento) e Rafael (Hábitos). Consultar `docs/manual/eliving/comando-master-eliving.md`.
- CONNECTED não comprova OPERATIONAL; CONFIGURADA não comprova homologação.
- Não copiar valores de senhas, tokens, chaves, secrets ou códigos de recuperação. Usar nomes, locais e metadados.
- Relatórios locais são fotografias datadas, nunca substitutos da consulta atual.
- Esta pasta é a base local de colaboração. Não reconstruir nem duplicar aplicativos existentes sem verificar o código e o escopo solicitado.
- A v1 está parada (DEC-032). Em 17/10/2026, o fundador pediu preservar a construção existente, conectar suas partes e documentar o encaminhamento para a IA. Essa instrução autoriza reaproveitar a interface preservada como referência e adaptar componentes ao fluxo e às permissões da v2. A visão geral da v2 fica em `/`; os cards ficam em `/cards`, conservando links antigos `/?card=...`. Não restaurar em bloco a aplicação v1 nem ligar seus serviços por inferência. `services/`, `scripts/` e `supabase/migrations/` mantêm a proteção da DEC-028.
- Ao retomar, leia `docs/manual/mapa-do-sistema.md` e `docs/manual/mapa-de-reaproveitamento.md`, além de `onde-estamos.md`. Eles indicam destinos, contratos e trabalho preservado; não substituem a consulta atual ao banco nem comprovam implantação. A orientação incluída no contexto da triagem fica em `motor/orquestrador/orquestrador/mapa_operacional.py` e usa a revisão realmente capturada pelo motor.

## TypeSafe / Jev

- Em tarefas de análise, desenho ou integração de TypeSafe/Jev, ler primeiro `.agents/skills/typesafe-ai/SKILL.md` e conferir a documentação oficial atual indicada pela skill.
- A skill orienta o agente de desenvolvimento; sua presença não significa que Jev esteja conectado ao runtime, ao Hermes, ao Gateway ou ao Supabase.
- Manter regras, permissões, cálculos, estado e transições no código. Tratar resultados Jev como sinais tipados, avaliar a incerteza e nunca usá-los isoladamente para aprovar ações financeiras, externas ou de publicação.

## Economia de modelos neste chat Codex

- Para trabalho neste repositório, classificar a tarefa antes de delegar: **Luna** para edição pequena, extração e verificação bem delimitada; **Sol** para implementação e revisão que exigem julgamento; **Astra** para mudanças amplas, ambíguas ou de alto risco, quando a capacidade extra se justifica.
- Se houver ferramenta de subagente e a delegação estiver autorizada, escolher explicitamente `gpt-6-luna`, `gpt-6-sol` ou `gpt-6-astra` para uma parte independente e delimitada. Dar contexto mínimo, arquivos, resultado esperado e critérios de aceite. Coordenar alterações concorrentes e revisar o resultado antes de declarar conclusão.
- Resolver localmente passos urgentes ou dependentes. Não criar subagente apenas para classificar, repetir leitura ou encaminhar tarefa trivial: a delegação também consome cota. Não repetir chamadas pagas sem diagnóstico e não elevar para Astra automaticamente após uma falha.
- O modelo da conversa principal é definido pelo Codex e não muda só por esta regra. Informar isso com clareza; nunca alegar que Jev mudou o modelo do chat. O Jev do Gateway avalia briefings em modo consultivo; só usá-lo para roteamento deste chat após integração específica, com custo e dados enviados explícitos.
- Para uma delegação relevante e independente, se `TYPESAFE_API_KEY` estiver disponível **localmente**, consultar `node scripts/jev-model-router.mjs` com JSON curto via entrada padrão (`task` e `context`, sem dados pessoais ou segredos). Ler `suggested_subagent_model` e `status`; seguir a sugestão apenas em `ADVICE`. Em `REVIEW_REQUIRED`, indisponibilidade ou ausência da chave, decidir pelo escopo e explicar a limitação. Essa consulta é opcional e paga; não executá-la por mensagem, por pergunta simples nem para mudar o modelo principal.
