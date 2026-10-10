# Decisões do fundador — 10/10/2026

Registro das decisões tomadas por ele nesta sessão. Valem até ele mudar. Não precisam ser perguntadas de novo.
Decidir não é executar: toda mudança no banco, no servidor ou no ar continua exigindo a frase exata dele para aquela ação.

| # | Decisão | Escolha | O que muda no plano |
|---|---|---|---|
| 1 | Motor | **DBOS** | O plano v3.1 mantém o DBOS. O estado do card continua em tabelas nossas e a tabela de passagens continua neutra (dá para trocar o motor um dia). A trava única do motor ser liberada quando ele cai vira teste que bloqueia. |
| 2 | Troca das chaves de acesso ao banco | **No fim dos testes** (combinado antigo; já adiado pela DEC-019) | A fase 0a NÃO inclui a troca das chaves. Risco aceito e escrito no plano: até a troca, a chave de acesso total continua valendo, e ela está em 9 arquivos rastreados do repositório (mais 2 com a chave pública). Por isso: o repositório fica privado, nenhum arquivo novo pode ter chave (varredura de segredos a cada envio), e os arquivos com chave são trocados para ler de variável de ambiente já agora, sem trocar o valor. A troca fica como item do portão final dos testes, com data de revisão. |
| 3 | Central da v1 (URA de clientes no WhatsApp e ligações de saída por IA) | **Desligar** | Decisão registrada. Desligar de verdade mexe no ar: só com a frase exata dele e com os clientes avisados antes. Antes de desligar, fazer o inventário só de leitura do que a central faz hoje. O agente nunca liga nem responde cliente sozinho. |
| 4 | Códigos das empresas | Descobertos nos documentos (só leitura) | BIZ-001 iGreen, BIZ-002 Ecossistema de Saúde, BIZ-003 Humano Digital, BIZ-004 eLiving™. Fontes: checkpoints mestre de 01/10, 04/10 e 07/10. |

## Pendências que continuam abertas (dele)

- Hostinger: conferir no painel o que vence em 27/10/2026. Sem recomendação até ele conferir.
- Se a voz da v1 usa a API paga da OpenAI (exceção à DEC-014): resolvido junto com o inventário da central.
- Pesquisa jurídica sobre recrutar pessoas para Mimix e Hub (pirâmide / marketing multinível, LGPD): fontes oficiais aprovadas por ele antes do plano da meta.
- Aprovação final, depois da conferência cruzada: "aprovo o plano v3.1 e o roteiro das 10 pessoas, com o motor DBOS".
