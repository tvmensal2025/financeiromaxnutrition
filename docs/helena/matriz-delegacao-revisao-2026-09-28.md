# Helena — matriz de delegação, execução e revisão

Auditoria da configuração e do fluxo do Gateway em 28/09/2026. Esta matriz descreve o que está implementado; recomendações são marcadas como **Ajustar**. Não equivale a afirmar que os perfis estão trabalhando automaticamente.

## Regra operacional por tarefa

1. Helena define prioridade, empresa, resultado de negócio e limites. Marina transforma isso em tarefa visível, nomeia o executor, especifica definição de pronto, fonte, prazo, dependências e revisor. Helena ou Marina podem criar e liberar jobs. Só Marina pode registrar o despacho. A liberação coloca o job em `READY`; não prova que o bot assumiu.
2. O executor assume um job da própria empresa, registra marcos relevantes (ação, motivo, evidência e próximo passo), grava memória da tarefa e submete a entrega. Não se autoaprova, não conclui diretamente e não dispara o próximo agente sozinho.
3. O revisor confere objetivo, escopo da empresa, instrução, fonte, evidência real, critério de pronto, riscos e próxima etapa. Aprova com motivo específico ou devolve correções específicas. A aprovação formal cria estado `COMPLETED`; handoff aprovado cria a próxima tarefa em `DRAFT`, ainda dependente de liberação.
4. Helena supervisiona decisões de portfólio, conflitos entre áreas, bloqueios e exceções. Sua capacidade de consultar ou substituir o revisor não equivale a uma revisão automática contínua. O fundador decide gastos, compromissos externos, publicações e escolhas estratégicas reservadas.
5. Em todo comando: oito seções do contrato de briefing, referências existentes, saída verificável e limites explícitos. Antes de gastar créditos, checar empresa, agente, tarefa, versão, briefing e cota. Se fonte não existir, dizer que falta; jamais inventar evidência nem marcar trabalho como executado.

## Quem faz o quê

| Agente | Entrega profissional mínima | Revisor configurado hoje | Conferência essencial / destino normal |
| --- | --- | --- | --- |
| Helena (CEO) | Síntese do portfólio, decisão ou pendência, dono e próxima entrega | Fundador | Validar prioridade e risco; devolver a Marina para execução. **Ajustar:** rota formal do fundador para aprovar job próprio da Helena está incompleta. |
| Laura (fundador) | Padrão observado, prática e evidência de evolução | Fora do fluxo empresarial atual | Escalar impacto em prioridades a Helena; não misturar dados pessoais com empresa. |
| Augusto (estratégia) | Opções, premissas, trade-offs, lacunas e decisão requerida | Helena | Verificar fonte e hipótese; encaminhar a Marina após escolha. |
| Marina (PMO) | Plano, marcos, dono, dependências, bloqueios e definição de pronto | Helena | Conferir se cada tarefa é acionável, sem duplicar a existente. |
| Caio (finanças) | Números com fonte, período, premissas, variação, riscos e decisão | Helena | Separar realizado, previsão e hipótese; escalar gasto ao fundador. |
| Clara (risco/jurídico) | Risco, impacto, controle, evidência e necessidade de profissional humano | Helena | Não afirmar aprovação jurídica sem base; devolver ressalvas ao dono. |
| Bianca (pessoas) | Papéis, capacidade, lacunas e ação de seleção/desempenho | Helena | Checar sobreposição de funções e capacidade; acionar Marina. |
| Daniel (dados/BI) | Métrica, fórmula, fonte, janela, escopo e lacunas | Helena | Não tratar ausência de dados como zero; alimentar decisão da Helena. |
| Theo (tecnologia/IA) | Solução, trade-offs, dependências, riscos e aceite | Bruno (QA) | Testar resultado e evidência antes de aceitar; risco de arquitetura vai a Helena. |
| Nina (produto) | Problema do usuário, hipótese, prioridade e aceite | Helena | Verificar evidência de usuário; passar especificação a Maya/Theo. |
| Ravi (pesquisa) | Hipótese, método, evidência, padrão e implicação | Augusto | Separar opinião, hipótese e conclusão; encaminhar insumo estratégico. |
| Maya (design) | Problema de UX, proposta, usabilidade e handoff | Nina | Validar tarefa do usuário e critérios; passar implementação a Theo. |
| Bruno (QA) | Cenário, esperado, obtido, severidade e prova | Helena | Reproduzir falhas; rejeitar entrega sem cenário verificável. |
| Olívia (operações) | Processo, dono, gatilho, controles, gargalo e melhoria | Marina | Garantir executabilidade e responsável por etapa. |
| Victor (vendas) | Etapas, objeções, conversão e evidência comercial | Helena | Distinguir roteiro interno de venda/receita comprovada; retornar sinais a Augusto/Camila. |
| Camila (marketing) | Canal, hipótese, público, oferta, métrica e teste | Augusto | Checar proposta e promessa; passar oportunidade qualificada a Victor. |
| Isabela (conteúdo) | Mensagem, público, objetivo e versão final | Camila | Conferir alegações e adequação ao canal antes de publicação. |
| Pedro (parcerias) | Parceiro, tese, valor mútuo, estágio, risco e próxima ação | Clara | Checar condições e riscos; passar oportunidade validada a Augusto/Victor. |
| Renata (sucesso) | Estado do cliente, valor, risco, feedback e ação | Helena | Verificar dados do cliente e separar pedido de mudança de produto para Nina. |
| Joana (atendimento) | Solicitação, resposta, resolução, evidência e recorrência | Renata | Conferir resolução real; incidente recorrente segue a Nina/Olívia. |
| Felipe (administração) | Documento/fornecedor, vencimento, dono e próxima ação | Olívia | Conferir registro, prazo e fonte; gasto ou obrigação seguem a Caio/Clara. |

## Resultado da auditoria e lacunas

- Os 21 cadastros têm missão, fontes de leitura, saída, escalonamento e áreas que podem atualizar. Os textos de perfil dos especialistas são curtos; o briefing específico da tarefa é a fonte da execução detalhada. O Gateway já rejeita briefing raso na liberação e no aceite.
- A distribuição é centralizada em Helena/Marina; o revisor é selecionado pela função **na submissão**, não fica claramente fixado no rascunho. **Ajustar:** mostrar revisor esperado desde a criação, preservando verificação server-side no envio.
- Dois jobs recentes de Pedro/Victor passaram por revisão com justificativa. Essa amostra não comprova revisão automática para os demais. **Ajustar:** piloto controlado por função, sem rodar 21 modelos ao mesmo tempo.
- `approval_status=APPROVED` também aparece em job liberado ou falho, antes da revisão de qualidade. **Ajustar:** separar autorização para executar de aceitação da entrega na leitura do painel e, depois, no contrato do banco; até lá, só contar `COMPLETED` com `reviewed_by` como entrega aprovada.
- Para a própria Helena, o revisor designado é `FOUNDER`, mas a rota de revisão via perfil Hermes exige identidade de agente e proíbe autoaprovação. **Ajustar:** criar caminho de aprovação do fundador com identidade humana verificada; não liberar autoaprovação.
- O registro `pode_atualizar` lista CRM, financeiro, produto e outras áreas, mas as ferramentas Hermes homologadas hoje escrevem sobretudo tarefa, job, progresso, memória e handoff. **Ajustar:** habilitar escritores específicos de domínio com escopo de empresa e trilha de auditoria antes de afirmar que cada agente alimenta sua tabela.
- A Helena pode consultar e intervir, mas o sistema ainda não faz inspeção periódica automática de todas as entregas. Para controlar custo, primeiro usar verificações determinísticas e uma revisão da Helena em lote ou por exceção; envolver modelo só onde houver conflito, risco ou decisão.
- Perfis e bindings configurados não provam acionamento: no momento da auditoria não havia jobs `READY`, `CLAIMED` nem `RUNNING`. Não ativar campanha ampla antes de um ciclo barato e verificável, do rascunho ao painel.

## Critério de aceitação do próximo nível

Uma tarefa só pode ser chamada de concluída quando: empresa e agente estão corretos; briefing passou contrato profissional; o bot realmente assumiu; o progresso e a memória são rastreáveis; a evidência pertence à tarefa; o revisor adequado conferiu a entrega e justificou aprovação; o resultado está visível no painel; o próximo responsável recebeu handoff em rascunho; e bloqueios não foram tratados como sucesso. A Helena recebe um resumo de exceções e decisões, não cada passo de baixo risco.
