"""Shared bounded recovery policy; does not grant new write permissions."""
MARKER = '## AUTONOMIA_OPERACIONAL_V1'
RULE = '''
## AUTONOMIA_OPERACIONAL_V1
Dentro do pedido autorizado, resolva falhas previsiveis sem devolver trabalho interno ao fundador.
Antes de create_task_job/handoff_task use helena_contracts.check_task_brief com instruction,
objective, definition_of_done, for_design e protected_texts contendo a copy literal que deve sobreviver.
Exija TECHNICAL_CHECK_PASSED; Gateway e permissoes continuam soberanos. Alvo 7000, teto 8000
unidades UTF-16 incluindo JSON/copy. Comprima repeticao e contexto ja referenciado, nunca corte
copy, marca, restricoes, fontes, oito secoes, revisao, entregaveis ou criterios. Preserve direcao-arte.
Se nao couber, referencie evidencia acessivel ou solicite coordenacao para dividir etapas autorizadas;
nao remova requisitos silenciosamente nem crie campanhas extras. Valide novamente antes de enviar.
Recusa de parametro: consulte esquema uma vez, corrija causa e valide localmente. Uma nova tentativa
somente com parametros corrigidos; se continuar recusado, registre causa e proximo responsavel.
Nao repita chamada identica que foi definitivamente recusada. Nao troque chave para duplicar tarefa.
Timeout/conexao perdida: releia manifesto, eventos e chave. Se confirmado, continue da etapa gravada;
se incerto, registre reconciliacao pendente. Nao repetir IA, geracao ou escrita cegamente.
Versao desatualizada: releia manifesto e somente secoes alteradas; atualize versao e revalide insumos.
WIP ocupado: aguarde a fila persistida; nao iniciar outro job, criar worker ou gastar IA por polling.
Permissao negada: confira empresa, papel e alias autorizado; encaminhe ao dono correto, sem elevar acesso.
Ferramenta/credencial ausente: preflight sem IA, registrar bloqueio tecnico e responsavel; nao fabricar entrega.
REQUEST_CHANGES: executor recebe achado por peca, fonte, acao e aceite. Corrija no fluxo autorizado,
preserve historico/limites e submeta ao revisor independente; nao autoaprovar nem reiniciar esgotados.
APPROVE interno: encaminhe proxima etapa explicitamente autorizada, com IDs e insumos. Nunca equipare
parecer a campanha pronta. Pacote final exige arquivos, copy/publication e revisao das mesmas referencias.
Reserve chamadas para escrita e confirmacao; pare de reler secoes inalteradas. Conferir pixels e conjunto.
Pergunte ao fundador somente sobre informacao comercial ausente, destino CTA, decisao reservada,
gasto/compromisso ou ampliacao de escopo. Nao invente esses dados. Nao publicar/mensagear sem autorizacao.
Registre no Gateway permitido: causa, tentativa corrigida, resultado confirmado, job/versao, proximo dono.
Este protocolo nao liga cron, nao garante execucao apos queda, nem muda permissoes ou limite de tentativas.
'''
