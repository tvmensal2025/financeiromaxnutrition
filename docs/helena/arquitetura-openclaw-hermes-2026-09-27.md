# Helena: escolha de executor e reconstrução por etapas

Data da análise: 27/09/2026, America/Sao_Paulo. Status: proposta técnica, sem instalação ou migração de produção. A preferência de orçamento do fundador é comparar os custos antes de definir um teto.

## Decisão recomendada

O detalhamento de implantação no Hermes está em [hermes/PLANO-DE-IMPLANTACAO.md](hermes/PLANO-DE-IMPLANTACAO.md), acompanhado de [mapeamento.json](hermes/mapeamento.json). Esse mapa atribui destino ao inventário atual, sem executar a migração.

Adotar **Hermes Agent, da Nous Research, como primeiro candidato ao executor da Helena**, com Supabase como registro oficial e a página Helena-HUB como interface de gestão. Validar a decisão em um piloto pequeno. OpenClaw permanece como alternativa se apresentar melhor integração ou custo por entrega aceita no mesmo teste.

Reavaliação em 27/09/2026: a primeira recomendação favorecia OpenClaw pelo encaixe com o Gateway atual. Esse critério recebeu peso excessivo, pois o fundador pediu reconstrução da estrutura. A prioridade é uma equipe de especialistas persistentes, com tarefas encadeadas, revisão e trabalho com planilhas. A combinação documentada de Bots, Kanban e Google Workspace do Hermes justifica testá-lo primeiro. Isso é uma mudança explícita de ponderação dos requisitos, não evidência nova de desempenho superior nem validação de consenso público.

É uma conclusão de adequação ao projeto, não um resultado de benchmark. Nenhum dos dois foi instalado ou testado executando os nossos agentes nesta análise. “Tudo dentro” deve significar uma experiência de gestão integrada; dados empresariais e decisões precisam continuar recuperáveis independentemente do executor.

O código existente usa TypeScript/React, um Gateway Node e contratos de tarefas no Supabase. Preservar esses contratos e acrescentar um adaptador reduz a dependência de qualquer plataforma. Recomeçar a execução não exige apagar o histórico ou reescrever o painel inteiro.

## O que foi verificado na operação existente

Consulta de leitura ao projeto oficial `ecosistemadossonhos`, ref `wxkgrykduqtsgmjkzlou`, e inspeção do código local. Estes números são uma fotografia de 27/09/2026, não contadores em tempo real.

- **JÁ EXISTE:** 69 tabelas base públicas, 21 agentes cadastrados e 51 tarefas no total.
- **JÁ EXISTE:** 23 tarefas de Humano Digital/BIZ-003: 21 não iniciadas, uma em execução e uma cancelada. A tarefa TSK-0008 aparece em execução; preservar esse estado e identificar seu responsável real antes do corte.
- **PARCIAL:** 28 jobs, sendo 23 READY e cinco COMPLETED. Os cinco registros concluídos não provam funcionamento do novo fluxo.
- **BLOQUEIO CONFIRMADO:** o piloto de Pedro, job `JOB-20260927043930112-AC7353`, vinculado a TSK-0007, continua READY, sem aceite, início ou conclusão registrados.
- **PARCIAL:** o Gateway tem operações de fila e de progresso, mas `record_dispatch` registra DISPATCHED e o webhook registra WAKE_SIGNAL. Esses trechos, sozinhos, não iniciam o bot externo. Referência: `services/helena-gateway/src/server.mjs`.
- **CHECKPOINT REQUER SINCRONIZAÇÃO:** CP-20260926-V012 ainda descreve a arquitetura anterior. O foco FOC-004 continua em homologação técnica. A nova direção precisa virar decisão versionada, e depois refletir no checkpoint.
- **NÃO CONFIRMADO:** sincronização de planilhas reais. Drive, Gmail e Calendar constam como PLANEJADAS; campos `source_sheet` e `linha_planilha` representam referências, não evidência de conexão funcionando. Não foram encontrados arquivos de planilha para validar fórmulas nesta análise.
- **A RECONCILIAR:** Helena Gateway consta PLANEJADA no cadastro; isso precisa ser reconciliado com os serviços implantados. Um health check bem-sucedido não equivale a operação homologada.
- **A REVISAR NA MIGRAÇÃO:** o bridge de voz contém empresa padrão BIZ-001. Toda entrada empresarial deve resolver uma empresa autorizada antes de iniciar a execução, evitando atribuição silenciosa por padrão.

Não tratar arquivos ou relatórios anteriores como estado atual sem consultar novamente as fontes. Há diversas alterações locais anteriores a este estudo; consolidá-las sem sobrescrever trabalho existente.

## Comparação aplicada à Helena

**OpenClaw.** O roteamento por contas de canais e agentes com estado próprio favorece a nossa central de atendimento. O Workboard opcional consegue iniciar execuções e vinculá-las aos cartões; TaskFlow oferece fluxos persistidos. Continua sendo uma alternativa forte, sobretudo se o piloto demonstrar que a integração dos canais é o fator dominante. [Multi-agent](https://docs.openclaw.ai/concepts/multi-agent), [Workboard](https://docs.openclaw.ai/plugins/workboard), [TaskFlow](https://docs.openclaw.ai/automation/taskflow).

Há uma distinção crítica: criar um registro TaskFlow ou vincular um run não inicia necessariamente uma execução. Precisamos usar e testar o caminho que realmente dispara o agente. O histórico operacional do runtime também tem retenção própria; evidências empresariais devem ser copiadas ao registro durável. [TaskFlow](https://docs.openclaw.ai/automation/taskflow), [Tasks](https://docs.openclaw.ai/automation/tasks).

**Hermes Agent.** Bots persistentes com perfis próprios e integração documentada com Google Workspace tornam a opção atraente para trabalho interno e planilhas. O Kanban possui dispatcher, dependências e recuperação de workers, mas o quadro compartilhado é projetado para um único host. Seus limites de paralelismo devem ser configurados explicitamente. Isso atende um piloto; não constitui, por si só, uma fila empresarial distribuída. [Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode), [Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban), [Google Workspace](https://hermes-agent.nousresearch.com/docs/user-guide/skills/google-workspace).

**Agendamento e custo.** Ambos documentam execução agendada de scripts sem inferência. Assim, verificar se a fila tem novidades não exige despertar uma IA a cada 30 segundos. Usar IA quando houver material a analisar é uma decisão nossa de implementação. [OpenClaw payloads](https://docs.openclaw.ai/automation/cron-jobs/payloads), [Hermes cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron).

**Separação de empresas.** Perfis, pastas e rótulos tenant ajudam na organização; não substituem autorização por empresa. O modelo de confiança do Gateway OpenClaw e o modelo local do Hermes exigem isolamento adicional para usuários ou empresas com acessos diferentes. Usar credenciais limitadas, autorização no servidor e isolamento de processos conforme o risco. [OpenClaw security](https://docs.openclaw.ai/gateway/security), [Hermes security](https://hermes-agent.nousresearch.com/docs/user-guide/security).

**Manutenção.** Ambos possuem licença MIT nos repositórios examinados. As releases estáveis identificadas foram OpenClaw v2026.9.6 e Hermes v2026.9.24 / versão 0.21.5. Isso não comprova qualidade operacional. Fixar versão e dependências, testar atualização em ambiente separado e manter retorno à versão anterior. [OpenClaw release](https://github.com/openclaw/openclaw/releases/tag/v2026.9.6), [Hermes release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.9.24).

Não começar mantendo dois executores ativos para as mesmas tarefas. A comparação deve usar uma amostra isolada e o mesmo contrato de entrada e saída.

## Arquitetura proposta

1. **Página e canais:** recebem a intenção e exibem empresa, tarefa, responsável, próximos passos e evidências. A tela consulta dados; não é ela que mantém os agentes vivos.
2. **Supabase:** preserva empresas, autorizações, tarefas, decisões, atividade, resultados e referências dos arquivos. Memória de negócio e conciliação financeira continuam aqui.
3. **Adaptador Helena:** valida identidade/empresa, dependências, versão, orçamento e propriedade da execução. Oferece operações limitadas ao agente; não entrega uma chave administrativa geral.
4. **Executor Hermes:** recebe um trabalho autorizado; seu dispatcher inicia o perfil responsável e informa aceite, execução, falha e resultado. O Kanban é uma representação operacional ligada à tarefa oficial, com um quadro por empresa no piloto e permissões reforçadas fora do prompt.
5. **Revisão:** checagens determinísticas validam campos, documentos e regras. Helena analisa exceções e revisa o lote pertinente. Trabalho terminado pelo executor só vira entrega aceita depois dos critérios de conclusão.
6. **Comunicação:** resumo no painel e WhatsApp apenas para críticos, conforme preferência do fundador. Haverá registro de tentativa, confirmação e falha de entrega; gravar um alerta não significa enviá-lo.

### Uma única autoridade para despachar

O registro empresarial da tarefa permanece no Supabase. O adaptador libera o job elegível e cria uma única representação no Kanban, vinculada pelo job_id. O dispatcher do Hermes assume a responsabilidade de iniciar o processo e controlar suas tentativas dentro dos limites. O adaptador reconcilia esses eventos com o registro oficial. Não permitir que um agendador do Supabase também inicie o mesmo processo por um caminho independente.

Usar uma saída transacional de eventos — outbox — para que “tarefa salva” e “pedido de execução pendente” sejam recuperáveis após falhas. Um evento pode ser entregue novamente; a operação deve reconhecer sua chave e não duplicar o efeito.

O primeiro adaptador terá operações equivalentes a iniciar, consultar, cancelar e coletar resultado. O mapeamento concreto para a versão do runtime deverá ser homologado no piloto; esses nomes descrevem o contrato desejado, não endpoints já implementados.

### Contrato mínimo de uma execução

- Identidade: empresa autorizada, tarefa, agente, job, tentativa e identificador real do executor.
- Intenção: objetivo, motivo, entradas permitidas, entrega esperada, critérios de aceite e próximo destinatário.
- Controle: versão da tarefa, versão do procedimento, chave de repetição, validade da posse do job e limite de uso.
- Tempo: criado, aceito, iniciado, último sinal, encerrado e revisado, com data, hora e segundos. Armazenar tempo em UTC e mostrar America/Sao_Paulo na página.
- Resultado: estado, resumo factual, evidências, impedimento quando houver e custo observado/estimado claramente diferenciados.

Datas não impedem sobrescrita por si só. Preservar a checagem de versão já existente; rejeitar gravação desatualizada e impedir um worker cuja posse expirou de concluir a execução de outro. Registrar a ordem e o horário do recebimento dos eventos além do horário informado pelo executor.

Estados visíveis: **planejada → pronta → aceita → executando → revisão → concluída**. Aguardando, bloqueada, falhou e cancelada devem informar motivo e próximo responsável. Falta de aceite após o prazo vira pendência explícita. Não converter READY em execução apenas porque enviamos um sinal.

### Autonomia com responsabilidade

Manter 21 papéis registrados não implica 21 processos pensando continuamente. No piloto, propor dois trabalhos simultâneos no total e um por empresa; os demais aguardam sem chamadas de IA. Aumentar somente após medir vazão e custo.

Helena supervisiona decisões e exceções; Marina organiza dependências e distribuição; especialistas executam sua entrega. Iniciar com Helena, Marina, Pedro e Camila, respeitando as dependências existentes. As tarefas já atribuídas aos outros agentes permanecem registradas para ativação gradual.

Cada agente pode sugerir melhorias explicando o problema, a mudança e o benefício. Pode escolher o método dentro do objetivo aprovado. Não pode elevar o próprio limite de gasto, ampliar acesso a empresas ou trocar regras de conclusão. Alterações de procedimento ganham versão e validação antes de substituir a vigente.

Revisão da Helena proposta: uma ou duas janelas por dia, somente com mudanças relevantes, mais acionamento por exceção crítica. Não criar uma IA supervisora de outra IA em um ciclo permanente. O monitor de vida e o alerta de worker parado são código comum.

### Continuidade entre conversas

A nova sessão deve carregar um pacote curto: identidade, função, empresa autorizada, decisões vigentes, objetivos, tarefas abertas, bloqueios, cursores e versões. Depois consulta apenas o detalhe necessário. Não reenviar as 69 tabelas e o histórico integral em cada chamada.

Memórias locais do runtime funcionam como apoio e cache. Fatos de empresa e decisões duráveis ficam no Supabase. Ao trocar de conversa, registrar qual versão foi lida; antes de escrever, comparar a versão atual. Acesso por chat web dependerá de um conector autenticado e validado, não da lembrança da conversa anterior.

## Planilhas: migração sem disputas de edição

O próximo inventário precisa identificar cada arquivo e aba, dono, empresa, chave de registro, fórmulas, datas, moedas, anexos, permissões e última versão. Referências em tabelas não substituem acesso aos arquivos originais.

1. Preservar os originais e registrar versão/hash, sem alterar fórmulas na origem.
2. Importar para uma área de conferência, convertendo formatos explicitamente.
3. Validar chaves, duplicidades, relacionamentos, totais e fórmulas relevantes com amostras verificáveis.
4. Reconciliar a importação antes de promover dados ao cadastro oficial; erros vão para uma fila visível.
5. Definir a autoridade de cada campo. Preferência: Supabase oficial, planilha como entrada controlada ou relatório/exportação. Se houver edição pela planilha, passar por validação, versão e trilha de auditoria.
6. Comprovar que importar novamente o mesmo arquivo não duplica registros e que uma exportação corresponde à versão identificada.

Não manter sincronização bidirecional irrestrita entre planilha, chat e banco. Fórmulas financeiras devem ser reproduzidas por código verificável quando precisarem virar regra do sistema; o agente não substitui a conciliação.

## Comparação de custo

Não há taxa de licença MIT do executor. Ainda há servidor, modelo, banco, armazenamento, ferramentas externas, canais, voz, manutenção e consumo eventual de navegação. Não está confirmado quanto dos serviços existentes já atende a essa estrutura.

Usando o mesmo modelo, as mesmas quantidades de tokens e as mesmas ferramentas, o preço nominal de inferência independe do executor. A quantidade efetivamente consumida pode diferir por instruções, recuperação de contexto, decomposição e tentativas. Essa diferença precisa ser medida.

Referência de preço consultada em 27/09/2026: Claude Haiku 4.5, US$ 1 por milhão de tokens de entrada e US$ 5 por milhão de saída; Claude Sonnet 5, US$ 2 e US$ 10 respectivamente. São referências para cálculo, não uma escolha de modelo nem equivalência de qualidade. [Preços oficiais](https://platform.claude.com/docs/en/about-claude/pricing).

Fórmula: tarefas por mês × chamadas por tarefa × [(tokens de entrada por chamada × preço de entrada) + (tokens de saída por chamada × preço de saída)] ÷ 1.000.000.

Simulações de 300 tarefas/mês, com volume hipotético, chamadas totais incluindo revisões e tentativas:

- **Contexto curto:** quatro chamadas/tarefa, 6.000 tokens de entrada e 1.000 de saída por chamada. Inferência: US$ 13,20 no preço Haiku; US$ 26,40 no preço Sonnet.
- **Trabalho intermediário:** oito chamadas, 12.000 tokens de entrada e 2.000 de saída. US$ 52,80 ou US$ 105,60.
- **Contexto longo:** 12 chamadas, 24.000 tokens de entrada e 3.000 de saída. US$ 140,40 ou US$ 280,80.

Não são previsões de desempenho ou faturas. Não incluem servidor, Supabase, canais, voz, impostos, câmbio, ferramentas pagas, caches, descontos ou cobranças especiais. As quantidades de tokens não devem ser presumidas iguais para o mesmo texto em modelos diferentes. O simulador permite substituir as tarifas e o volume.

Para servidor, proponho inicialmente um pequeno ambiente Linux persistente, dimensionado pelo piloto. Sua função é manter serviços e executar ferramentas; não hospedar um modelo grande local. Não recomendo comprar GPU ou contratar capacidade para 21 agentes simultâneos antes de medir. Cotar máquina, região, backup e armazenamento na implantação.

Migrar para OpenClaw ou Hermes não transfere automaticamente a cota semanal do Grok/Cursor, nem resolve cobrança ou bloqueio de conta existente. O provedor e a modalidade de acesso precisam ser suportados e contratados de forma compatível. Não foi diagnosticada a causa do bloqueio do Cursor neste estudo.

### Controle de gasto que precisa ser aplicado, não só escrito

- Toda chamada paga passa pelo controle central, incluindo agentes auxiliares, tentativas, revisões e ferramentas com custo.
- Reservar orçamento antes de iniciar a chamada considerando entrada, limite de saída e chamadas em andamento. Conciliar com o uso devolvido pelo provedor.
- Definir teto por tarefa, empresa e período, além de limite de chamadas, tempo e concorrência. Valores monetários ficam pendentes da escolha do fundador.
- Bloquear novas chamadas quando o limite reservado for alcançado; não assumir que cancelar uma execução devolve valores já consumidos.
- Configurar o modelo explicitamente e impedir troca automática para opção mais cara sem regra aprovada. Validar os caminhos de botões, automações e agentes auxiliares.
- Limitar tentativas e bloquear erros permanentes. Proposta: uma tentativa inicial; no máximo uma repetição para falha transitória que cumpra a regra.
- Medir custo por **entrega aceita**, não apenas tokens por chamada. Uma resposta barata que gera retrabalho pode sair mais cara.

## Ordem de construção e critérios de saída

### 1. Fechar o inventário e a continuidade

Preservar código, banco, documentos e decisões; verificar restauração em ambiente isolado. Reconciliar foco, checkpoint e direção aprovada. Mapear cada fonte de planilha e integração como existente, parcial ou não confirmada. Aceite: inventário com origem e responsável, restauração verificada, sem considerar planos como integração em operação.

### 2. Montar o piloto isolado de execução

Fixar a versão do executor e criar o adaptador mínimo. Usar uma cópia identificada da tarefa de Pedro com dados permitidos e sem disparos externos. Primeiro provar aceite, início, evidência e revisão; não colocar toda a fila no novo executor. Aceite: resultado aparece no painel ligado à empresa, tarefa, agente e run corretos.

### 3. Provar recuperação e controles

Executar cenários de webhook repetido, queda após aceite, perda de comunicação, cancelamento, resposta atrasada, duas gravações concorrentes e falta de saldo autorizado. Usar duas empresas sintéticas para testar separação, sem criar dez empresas fictícias na operação. Aceite: nenhum efeito empresarial duplicado nos testes; gravação velha rejeitada; falha visível; custo e histórico preservados; acesso cruzado negado.

### 4. Homologar a amostra e as planilhas

Usar amostra proposta de 20 tarefas representativas com critérios objetivos, incluindo revisão e falhas simuladas. Medir custo total/entregas aceitas, tempo, intervenções e recuperação. Importar uma planilha conhecida e reconciliar o resultado. Se o Hermes não atender, comparar OpenClaw com o mesmo contrato e amostra isolada. Não precisa pagar os dois continuamente.

### 5. Liberar gradualmente a operação

Ativar os papéis iniciais e canais já homologados. Fazer o corte com o despachante antigo controladamente suspenso para os jobs migrados, preservando histórico e retorno possível. Aceite: os novos trabalhos têm um único executor responsável, alertas críticos chegam ao destino autorizado e tarefas restantes continuam visíveis.

### 6. Expandir com demanda real

Ativar outros especialistas e empresas conforme carga e resultados. Separar serviços ou hosts quando a medição ou o isolamento exigirem. Fazer revisão periódica de permissões, retenção, restauração e atualizações. Não prometer disponibilidade total ou faturamento como consequência da troca de plataforma.

## O que esta análise entrega e o que permanece pendente

Entregue: recomendação condicionada ao piloto, evidências atuais, desenho de responsabilidades, estratégia para planilhas, simulação de custo e critérios de migração. Este arquivo e a comparação visual são documentos locais da proposta.

Pendente de execução: instalar/homologar runtime, implementar adaptador, reconciliar as decisões no banco, publicar checkpoint atualizado, definir teto financeiro, acessar planilhas originais e realizar o piloto. Nada disso deve aparecer como concluído ou sincronizado apenas porque está descrito aqui.
