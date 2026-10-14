# DEC-031 — Runtime dos agentes: Hermes agora, EVE depois

- **Data:** 14/10/2026
- **Número:** PROVISÓRIO. O Supabase é a fonte dos números; antes de usar este número, conferir lá (só leitura) que ele está livre.
- **Quem decidiu:** o fundador, respondendo na sessão do Claude Code de 14/10/2026.

## O que foi decidido
- **Agora:** todos os agentes rodam no **Hermes**, com a assinatura do ChatGPT (`HELENA_V2_EXECUTOR` vazio = `hermes`). Nada muda no `models.yaml`.
- **Depois:** a **EVE** (Vercel) pode entrar. O adaptador já existe e está pronto para conectar, mas não está aprovado (`motor/executor/executor_helena/adaptador_eve.py`).
- **Direção para quando a EVE entrar:** os dois runtimes trabalham juntos, com papéis separados, nas palavras do fundador: "1 comandando e outro gerenciando e aplicando".

## Por quê
- A EVE em servidor exige chave de API paga, porque a assinatura do ChatGPT só roda em `eve dev` (eve 0.79.0, `agent-config.md`). Hoje a regra é nunca usar API paga (`helena-v2/models.yaml`).
- O Hermes é o único runtime aprovado para produção.

## O que muda
Hoje, nada no código: só fica registrado.

Para os dois runtimes trabalharem juntos ainda falta:

1. **Escolher o runtime por papel**, e não um só para tudo. Hoje `HELENA_V2_EXECUTOR` vale para todas as execuções (NÃO FEITO). Uma forma seria um runtime por papel da ficha: COORDENACAO, AUTOR ou REVISOR.
2. **Decidir a chave paga** para a parte que rodar na EVE.
3. **Fazer o dia de prova da EVE**, com cada garantia provada antes de ela sair de `EM_HOMOLOGACAO`.

Na v2, o processo é comandado pelo **motor**, que é código: o banco manda, o motor executa e o agente só escreve conteúdo (`docs/plano/PLANO-HELENA-V3.md`). Por isso, "comandar" aqui quer dizer a **coordenação da Helena** (planejar, revisar, encaminhar), e não o controle do processo.

## Fonte
Esta conversa. Manual de conexão: `docs/manual/conectar-runtimes.md`.
