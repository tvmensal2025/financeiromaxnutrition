# Trava de tamanho dos comandos dos agentes

Regra: `helena-brief-safe-limits-v1`. Escopo: os 21 perfis do Hermes e os novos briefings enviados ao Gateway. Autorização do fundador: impedir que qualquer agente envie comandos acima do limite, com margem de segurança.

## Orçamento de escrita

- `instruction`: alvo 6.000; teto seguro 7.000; transporte histórico 8.000 unidades UTF-16.
- `objective`: alvo 280; teto seguro 350; transporte histórico 400.
- `definition_of_done`: alvo 2.400; teto seguro 3.000; transporte histórico 4.000.
- Outros campos: a ferramenta informa `minLength` e `maxLength` reais; o agente deve planejar até 80% do teto e observar a validação do campo.

O cálculo usa o texto final, incluindo copy, JSON, espaços e emoji. Um emoji fora do plano básico conta como duas unidades, conforme JavaScript e o Gateway.

## Regra para todos os agentes

Antes de criar ou encaminhar uma tarefa, usar `helena_contracts.check_task_brief`. Somente enviar depois de `TECHNICAL_CHECK_PASSED`. A verificação técnica não concede autorização, não valida fatos comerciais e não substitui o revisor.

Se exceder o teto, retirar repetições, organizar o contexto e usar referências recuperáveis. Preservar copy literal aprovada, identidade da empresa, logo oficial, fontes, restrições, entregáveis, critérios, oito seções e direção de arte válida. Nunca cortar texto automaticamente. Se o conteúdo essencial não couber, a coordenação deve dividir as etapas dentro do escopo autorizado ou registrar o bloqueio exato.

Helena/Marina continuam responsáveis por criar, revisar briefing e encaminhar. Especialistas produzem insumos e indicam o próximo responsável. A regra não altera permissões, empresas, revisão independente, limite de tentativas ou autorização de publicação.

## Proteção aplicada

1. Orientação em `SOUL.md` dos 21 perfis.
2. Verificador compartilhado `/data/helena-runtime/brief_preflight.py` com tetos seguros, contagem UTF-16 e indicação do espaço restante; sem IA.
3. Orçamento explícito no comando automático de encaminhamento do runtime.
4. Gateway recusa excesso em `create_task_job`, `handoff_task`, `revise_task_brief` e `adopt_existing_task` antes de qualquer alteração canônica.
5. Descoberta das ferramentas publica os limites reais, inclusive a revisão que anteriormente usava um contrato explícito separado.

Briefings históricos já gravados continuam compatíveis com o transporte anterior. A trava vale para novas escritas; não reescreve o histórico.

## Evidências

- Instalação dos 21 perfis: 2026-10-02T14:17:53.119597+00:00; 25 arquivos; zero chamadas de modelo.
- Backup: `/data/helena-runtime/brief-safe-backup-20261002T141753110624Z`.
- Recibo: `/data/helena-runtime/brief-safe-receipt.json`.
- Teste MCP real: `/data/helena-runtime/brief-safe-native-check.json`; 7.000 aceito, 7.001/7.041/8.873 recusados; zero IA e zero jobs escritos.
- Código Gateway: `e12efdc` e ajuste do contrato remoto `8fbe139`.
- Testes locais finais: 298 testes Node aprovados, zero falhas e zero pulados; 8 testes do verificador Python aprovados; 86 testes do fluxo Python aprovados; 29 testes de integrações com dados simulados aprovados.
- Estado final da publicação e teste remoto: consultar `RECIBO-TRAVA-LIMITES-20261002.json` e `MEM-BRIEF-SAFE-LIMITS-20261002-V1` no Supabase.
- Pacote de instalação verificável: `artifacts/brief-safe-limits-20261002.zip`. Instalar somente após conferir hashes, configuração compartilhada e cópia de segurança; não iniciar agentes durante a instalação.

## Limites desta correção

Esta evidência comprova a proteção de tamanho. Não comprova a conclusão da campanha HD-CASA-20261002-01 nem elimina problemas independentes de timeout, conexão, conteúdo ou autorização. O encaminhamento anteriormente interrompido exige recuperação separada, sem duplicar jobs ou consumir chamadas por repetição cega.
