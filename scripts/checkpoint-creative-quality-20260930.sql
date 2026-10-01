begin;
insert into public.memoria_mestre
(id,data_hora,tipo,business_id_area,scope_type,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade)
select 'MEM-CREATIVE-QUALITY-20260930-V2',now()::text,'DIRETRIZ','GRUPO','GROUP','Fundador / Helena','Padrao criativo multiempresa v2: marca unica, composicao integrada e variedade editorial',
$creative$# Padrão criativo multiempresa — versão 2

Decisão do fundador, 30/09/2026. Aplica-se a novos briefings, produção e revisão de campanhas. Não altera automaticamente copy aprovada, arquivos existentes ou limites de execução.

## Aprendizado das quatro peças do Humano Digital

As fotografias e a paleta verde evoluíram, mas o pacote não está aprovado para publicação. O gerador inventou assinaturas “Humano Digital” diferentes em cada imagem; o acabamento acrescentou o logo oficial novamente. A redução da composição para acrescentar 200 px no post e 380 px nos stories produziu barras laterais e um rodapé desconectado. A mesma mulher, pose com mão no queixo, roupa e ambiente se repetiram. As chamadas são abstratas; ressalvas extensas e botões sem destino definido não conduzem uma ação clara.

## Responsabilidades e passagem de trabalho

1. Helena identifica empresa, pedido, objetivo, público, canal e critério de entrega. Consulta o cadastro atual; pergunta apenas pelos dados essenciais ausentes. Marina organiza etapas e dependências conforme o registro vigente de agentes.
2. Pesquisa e estratégia confirmam o que a empresa oferece, fontes, condições reais e referências pertinentes. Exemplos não comprovam vagas, remuneração, depoimentos ou resultados. Entregam fatos e pendências separados.
3. Copy define uma mensagem por peça e uma progressão da sequência. Título preferencialmente até 10 palavras; apoio até 25 por story, com exceção editorial justificada. CTA deve indicar uma ação que exista. Condições relevantes continuam presentes, sem dominar todas as peças. Mudanças de copy aprovada voltam à revisão responsável.
4. Direção de arte entrega um mapa por peça: objetivo, copy exata, imagem protagonista, personagem/objeto, ação, cenário, enquadramento, luz, composição, hierarquia, paleta, fonte, posição do logo e margens. Referências orientam qualidade; não copiar marcas, pessoas ou layouts de terceiros.
5. Maya produz usando esse mapa e o cadastro da empresa. A peça ocupa o formato completo. O logo oficial é aplicado uma única vez; o gerador não desenha assinatura, símbolo ou wordmark. Área de respiro integrada, sem faixa inferior acrescentada. Nenhum texto importante deve ficar sob o logo ou controles do canal.
6. Nina inspeciona os pixels de cada peça e o conjunto. Compara com o pedido, copy, identidade e mapa. Aprova apenas conteúdo utilizável; registra achados específicos e solicita correção quando necessário. Helena supervisiona exceções. Dimensões e hashes não substituem revisão visual.

## Identidade consistente, conteúdo variado

Fixos: logo oficial, paleta, família tipográfica, voz e proposta de marca. Variáveis: pessoa/objeto, pose/ação, cenário, enquadramento, organização gráfica, mensagem e recurso explicativo. Cada peça deve variar ao menos três dimensões visuais em relação à anterior, salvo continuidade narrativa explicitamente justificada. Não inventar uma pessoa diferente apenas para cumprir contagem.

Humano Digital: o fundador permite robôs amigáveis e representação de IA. Alternar pessoas, colaboração humano–IA, robô como personagem ilustrativo, objetos e diagramas editoriais conforme o assunto. O robô não vira automaticamente mascote oficial ou segundo logo. Não repetir a mesma mulher no notebook como padrão de toda campanha.

Exemplo de sequência futura: story 1 apresenta uma dúvida com pessoa em uma situação concreta; story 2 explica uma atividade por composição humano–robô ou processo ilustrado; story 3 mostra próximo passo com outra cena e CTA confirmado. O post sintetiza a proposta com composição própria. Isso é direção editorial, não copy comercial aprovada.

Saúde 360 e demais empresas: consultar negócio e público antes de escolher imagem. Um tema de enfermagem pode exigir um profissional e contexto apropriado; não reutilizar automaticamente robôs, promessas comerciais ou cenas do Humano Digital. Alegações de saúde e técnicas devem ter fontes e revisão pertinente.

## Reprovação obrigatória

- Logo duplicado, inventado, deformado ou de outra empresa.
- Rodapé desconectado, barras largas, excesso de espaço sem função ou cortes de texto.
- Peças quase idênticas sem progressão de conteúdo.
- Copy ilegível, longa demais, vaga, com erro ou CTA sem destino operacional.
- Informação não confirmada, falsa promessa ou remoção de condição material.
- Aprovação baseada apenas em relato, bytes, hash ou dimensões; falta de acesso aos pixels.

## Entrega para o fundador

Mostrar artes, legenda pronta para copiar, estratégia objetiva, instruções de uso e status de revisão. Logs, IDs, hashes, erros e detalhes de ferramentas pertencem ao histórico interno. Não declarar “pronto para publicar” antes da revisão; publicação exige autorização própria.

## Implementação e limites

`creative_quality.py` centraliza as regras e `hermes_execution_context.py` as inclui nos pacotes de execução e revisão. `hermes_visual.py` reforça a marca única e remove o rodapé adicional; exige proporção correta em vez de recortar copy. Um pequeno apoio de contraste fica somente atrás do logo na área planejada. Não há detecção automática confiável de logo inventado: essa condição continua dependente da inspeção visual, que não pode ser dispensada.

A tarefa JOB-HR-c392de57a9b00edb8879f291b077714d gerou quatro arquivos, porém ficou WAITING_HELENA porque a inspeção MCP entregou base64 como texto. Preservar esses arquivos e o histórico. Não relançar geração, não zerar tentativas, não aprovar o pacote criticado. Corrigir transporte de pixels e preparar revisão/direção v2 antes de qualquer nova geração paga.
$creative$,
'Feedback do fundador com quatro PNGs; docs/padrao-criativo-multiempresa.md; creative_quality.py e hermes_visual.py',
'ATIVA','ORIENTACAO EXPLICITA DO FUNDADOR','PADRAO_CRIATIVO','creative-quality-v2',
'Aplicar em novos briefings e revisar pixels antes de aprovar. Nao regenerar nem publicar automaticamente o pacote criticado.',
'Helena / Marina / Maya / Nina','INTERNO'
where not exists(select 1 from public.memoria_mestre where id='MEM-CREATIVE-QUALITY-20260930-V2');
select id,status,length(registro) as caracteres from public.memoria_mestre where id='MEM-CREATIVE-QUALITY-20260930-V2';
commit;