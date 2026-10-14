export const meta = {
  name: 'helena-plano-v31',
  description: 'Recria o plano único "Sistema Helena: plano v3.1" a partir do v3, das 48 melhorias e da crítica, seção por seção, com ataque adversarial até secar',
  phases: [
    { title: 'Redigir', detail: 'uma equipe por grupo de seções' },
    { title: 'Atacar seções', detail: '2 atacantes por grupo e conserto' },
    { title: 'Montar', detail: 'documento único' },
    { title: 'Atacar documento', detail: 'rodadas até 2 secas' },
    { title: 'Registro', detail: 'registro de furos das rodadas 5 e 6' },
  ],
}

const MAIN = '/home/user/financeiromaxnutrition'
const PAC = `${MAIN}/docs/planos/sistema-helena-pacote`
const V2 = `${MAIN}/helena-v2`
const AG = '/tmp/claude-0/-home-user-financeiromaxnutrition/e6bad39a-0168-57f5-beb5-182463b5f582/scratchpad/ag'

const CTX = `
CONTEXTO. Hoje: 10/10/2026. Escreva SEMPRE em português do Brasil.
Fundador solo, NÃO programador, lê no celular. Quer o plano "sem furo e ainda melhor" que o "Sistema Helena: plano v3, o melhor até agora", e que TODOS os 21 agentes vão de ponta a ponta (não só 5). 4 empresas: iGreen, Saúde, Humano Digital (BIZ-003), eLiving™ (grafia exata).
FONTES (leia as que sua tarefa pede; não invente fatos):
- Plano v3 (base, mantenha estrutura, tom e o que está certo): ${PAC}/01-plano-v3.md
- Registro dos 171 furos: ${PAC}/02-registro-de-furos.md
- Análise dos especialistas, 48 melhorias MEL-01..48 (Vercel, GitHub, agentes, organização): ${PAC}/03-analise-especialistas.md e JSON verificado ${PAC}/pesquisa/rodada-5/melhorias-verificadas.json
- Crítica com 12 correções OBRIGATÓRIAS: ${PAC}/04-critica-da-analise.md
- Conferência das especificações (22 pontos): ${MAIN}/docs/CONFERENCIA-HELENA-V2-X-PLANO-V3.md
- Os 21 agentes (v1): ${MAIN}/docs/AGENTES-SISTEMA-HELENA.md
- Máquina de passagens EM CONSTRUÇÃO (só leitura; pode mudar): ${V2}/maquina/vocabulario.yaml, passagens.yaml, provar.py. Use como referência de nomes e tetos, sem prometer números que não estejam lá.
- Pesquisa anterior: ${PAC}/pesquisa/ (ataques A, B, C, verificação de fontes, contexto).
- Código v1 (para fatos sobre a v1): ${AG}/services/helena-gateway/, ${AG}/HANDOFF-CLAUDE-CODE.md
DECISÕES FIXAS PARA O PLANO v3.1:
1. Motor: o plano RECOMENDA manter o DBOS (decisão já tomada, a crítica ponto 11 mostra que trocar seria reversão sem motivo forte), mas o estado do card vive em tabelas nossas e a tabela de passagens é neutra; a alternativa "motor próprio no Postgres" fica registrada como cartão de decisão com o que cada opção obriga a escrever à mão. A trava única do motor ser liberada quando ele cai vira teste que bloqueia.
2. Publicar: o GitHub NÃO é trava (a sessão de IA usa o login do fundador, como administradora — MEL-05). Publicar = o toque do fundador no EasyPanel, colando a impressão digital (digest) de uma imagem testada. Os testes do GitHub protegem contra ERRO, não contra uma sessão desviada — escrever isso. Nenhuma credencial de produção no GitHub. Marque NÃO CONFIRMADO o que não foi conferido (ex.: EasyPanel aceitar digest, 2FA do EasyPanel).
3. Fase 0 em 0a (estancar: cópia do banco antes de tudo, quem executa cada SQL — o fundador no editor SQL com script e caminho de volta; portas; chaves; acesso público) e 0b (vigiar: backup num repo helena-backup que só ele cria, healthchecks, Telegram, diagnóstico). Portão 0a: "igual ou melhor que antes do passo", depende da escolha dele sobre as chaves; checklist da v1 inclui DEC-022 e a URA.
4. A v1 tem URA de clientes no WhatsApp e ligações de saída por IA (whatsapp-ura.mjs, meowcaller.mjs) e possível uso de API paga na voz: inventário + cartão de decisão (exceção escrita ou desligar); ligação de saída só com o toque dele.
5. Primeira meta: pesquisa jurídica antes (risco de pirâmide/marketing multinível — Lei 1.521/51 art. 2º IX, CDC — e base LGPD de quem é recrutado: o que se guarda, por quanto tempo, como se apaga), com fontes oficiais.
6. Os 21 agentes: um centro de serviços compartilhado pelas 4 empresas (a empresa é contexto do card); catálogo de serviços como dado; cada agente com serviço próprio; sobreposições resolvidas (Marina x motor, Bruno x revisor, Olívia x Felipe, Augusto x Camila x Nina); Laura escopo pessoal; personagens eLiving fora do organograma. TODOS os 21 têm ficha, casos e jornada de ponta a ponta provados NA ESPECIFICAÇÃO (fase 1); ligam em produção um por vez, pelos portões (estágio -> ativo), porque cota e VPS são limitadas — dizer isso com honestidade.
7. Qualidade: uma tabela só de estados de qualidade (crítica ponto 5), com precedência; ação do agente chega por ferramenta tipada; casos com respostas de ferramenta gravadas; regressão pass^3; relatório E5 montado pelo código, revisor confere fidelidade (regra 4 escrita por extenso para esse caso).
8. Autorização: "sua frase" em dois níveis (texto do plano / mudança no banco ou servidor); autorização não vence por data, vale até ser usada, pede de novo só se versão, estado ou escopo mudarem (AGENTS.md).
9. GitHub: orçamento de minutos numa tabela única (crítica ponto 7), jobs leves juntos, prioridade backup > diagnóstico > gitleaks; gitleaks no lugar de secret scanning (não existe em repo privado pessoal); ações fixadas por SHA.
10. Vercel fora do motor, do Hermes e do app nas fases 0-3 (MEL-32), com os motivos certos e números marcados NÃO CONFIRMADO onde for o caso.
11. Linguagem: frases medidas, nada de absolutos falsos (crítica ponto 9): "nenhum furo conhecido em aberto", "o que passou no teste da versão X", nunca "zero erro". Hostinger: não recomendar renovar/não renovar até ele conferir o painel.
ESTILO: igual ao v3 — português simples, frases completas, explicação entre parênteses para termo técnico, tabelas onde ajudam, sem jargão. Cada mudança em relação ao v3 marcada no texto com "(novo na v3.1)" ou "(mudou na v3.1: ...)".
REGRAS: escreva SOMENTE o(s) arquivo(s) que sua tarefa manda. Não rode git. Não acesse banco/servidor. Não copie valores de chaves. Não edite ${V2}/.
`

const GRUPOS = [
  { key: 'abertura', secoes: 'Título "Sistema Helena: plano v3.1", data e linha de autoria; "Resposta direta" (tem furo? e se aparecer um novo? eles vão seguir? dá para não ter erro? o que mudou desta vez — incluir as mudanças em relação ao v3 que o fundador precisa saber antes de aprovar, inclusive as regras do v3 que a v3.1 altera, conforme crítica ponto 12); "Como funciona" (peças e onde rodam, com o vigia do vigia; o GitHub sem credencial de produção).' },
  { key: 'jornada', secoes: '"A jornada do card" (caixa de entrada com número único; leitura de volta; no app o tipo da mensagem vem do botão que ele toca (MEL-25), a classificação por IA só no WhatsApp e depois do conjunto-ouro; nada sem lugar; pedido parecido; ordem de serviço; prioridade e prazo dele; cancelar sem IA; ajuste depois do pronto abre card novo ligado, com teto de ordens; um sistema por pedido v1/v2) e "As 13 regras de ferro" (tabela prova/trava/vigia; tabela única no banco com impressão digital; cada regra escrita uma vez e usada pela trava, pela prova e pelo vigia (MEL-22); prova em camadas com tamanho impresso (MEL-23); vigia a cada 5 min).' },
  { key: 'agente-motor', secoes: '"O agente: uma função com ações tipadas" (5 ações do autor; o que muda na v2.0: sub-card desligado e plano só por roteiro (MEL-24) — explicar; ação entregue por ferramenta tipada do nosso servidor (MEL-27) sem contradizer a regra "execução incompleta = falha de infraestrutura" (crítica 12); pasta limpa; login protegido; sem reserva escondida; ferramentas nossas, e "buscar" só na fase 4 / "ler página" por lista de endereços na fase 3 (MEL-34); limites em chamadas; quem leu internet só entrega; formato errado com 1 nova tentativa; falha lida, não declarada; executor atrás de adaptador (MEL-35)) e "O motor" (DBOS recomendado + cartão de decisão; estados da etapa com dono e prazo; dois passos; chave por execução; fila: 1 vaga de trabalho + 1 da Helena para mensagens (MEL-21) e quando sobe; um caminho só para a fila; cancelamento; cascata; publicar sem perder nada; plano conferido; horário de Brasília).' },
  { key: 'qualidade', secoes: '"Qualidade em 3 portões" (validador com checagens de ID e rastreio furo->checagem->teste (MEL-28); rubrica tipada com veredito "não consigo conferir" e critério de pronto em 3 camadas (MEL-29); tabela de leis e temas obrigatórios; convite sem termo de ganho e sem números; validador testado; faixa do código; jurídico com data; troca de modelo escondida; uma tabela só de estados de qualidade com precedência (crítica 5); revisor medido por tipo e canários (MEL-41); placar só com métricas de código (MEL-42)) e "O relatório do card" (montado pelo código (MEL-30); faixa; botões; versão vista; app velho não aperta botão de regra nova (MEL-39); texto seguro e trava do navegador num arquivo do repo (MEL-38), com frase medida sobre as origens liberadas).' },
  { key: 'falhas', secoes: '"Falhas e esperas" (tabela por tipo de falha com teto e quem é chamado; teto geral; em resolução; prazos no relógio do banco; padrão nunca aprova; vale o que chegar primeiro; um medidor só de cota para v1 e v2 lido do próprio ChatGPT (MEL-19) e a ordem quando a cota aperta; se a conta for suspensa).' },
  { key: 'seguranca', secoes: '"Segurança: fase 0a estancar" (primeiro ver se alguém entrou; cópia do banco antes de tudo e QUEM executa; tabela hoje x fase 0a; chaves escritas em arquivos do repositório (9 com service_role + 2 anon) e gitleaks; superfície inteira do Supabase com tabelas da v2 fora da API (MEL-03); quem escreve no repositório — Lovable, apps, tokens (MEL-04); a sessão de IA = o fundador no GitHub (MEL-05); app que falha fechado (MEL-33); URA e ligações da v1 (decisão 4); APIs pagas da v1 (MEL-18); contas com recuperação em dois caminhos (MEL-47); chave colada vira [chave removida]; ferramentas não olham para dentro; texto de IA é só texto; agente nasce sem segredo; ação de fora só pelo motor; acessos por extenso (30/10/2026); aprovação de risco só no app; rede fechada por padrão como P2 (MEL-48)).' },
  { key: 'manutencao', secoes: '"Manutenção sem depender do seu PC" (uma main só e o resto arquivado (MEL-08); protocolo das sessões de IA com duas portas e fim de sessão (MEL-09); livro de autorizações AUT-NNNN com os dois níveis de frase (MEL-10 + crítica 6); onde mora cada coisa (MEL-11); fila "Precisa de você" e guia de uma tela (MEL-12); plano conferido por máquina — fases, testes e furos como dados (MEL-13); CI das especificações e do app (MEL-14); três ambientes com Postgres local no CI (MEL-15); publicar = toque no EasyPanel com digest de imagem do GHCR e volta por digest (MEL-06); padrão de workflow e orçamento de minutos em tabela (MEL-07 + crítica 7); diagnóstico escrito pelo próprio Supabase sem senha no GitHub (MEL-36); avisos com um remetente (MEL-37); prévia das telas sem Vercel (MEL-40); manual do mantenedor como receitas (MEL-46); servidor dividido com limite; atualizar sem surpresa; todo erro vira teste; tabela "o que você quer mexer") e "Backup e recuperação" (backup completo num segundo repositório helena-backup fora do alcance das IAs (MEL-16) com o executor da cópia definido (crítica 2); prova semanal; roteiro de restauração; antes de mexer no banco; o banco não estoura; cartão Supabase grátis x Pro (MEL-17); o que fica fora e o que é apagado por prazo/LGPD — sem dizer "nunca apagado").' },
  { key: 'equipe', secoes: '"A equipe: os 21 agentes de ponta a ponta" (NOVO: centro de serviços para as 4 empresas; organograma; tabela dos 21 com função, serviço próprio principal, quem revisa e reserva sem conflito — use o catálogo se já existir em ' + V2 + '/servicos.yaml, senão proponha com base no contrato dos 21 e marque "a confirmar no catálogo da fase 1"; sobreposições resolvidas; como cada agente prova ponta a ponta na especificação (ficha, entregas, casos bons e defeitos plantados, jornada que a máquina percorre) e como liga em produção (estágio -> ativo, um por vez, critérios); roteiro de ponta a ponta para cada empresa) e "Os primeiros agentes no ar e a primeira meta" (E1..E5 corrigidos: E3 sem E1 e sem números, E4 com AJUSTE até 2 voltas, E5 montado pelo código com revisor de fidelidade; pesquisa jurídica antes do plano da meta (decisão 5); critério de pronto da meta).' },
  { key: 'treino-comando', secoes: '"Treinar como funcionário" (3 gestos no card em vez de 5 (MEL-45); lição só ativa com prova de efeito, teto por serviço e validade (MEL-43); decisões sem contradição) e "Você no comando" (painel; resumo das 18h; avisos pelo Telegram com remetente único; cartões de decisão; você não vira gargalo; conjunto-ouro das mensagens antes de a Helena assumir o WhatsApp (MEL-44), com a frase dele para gravar no banco).' },
  { key: 'testes-fases', secoes: '"Os testes que decidem" (os 11 testes do v3 ajustados: teste 4 sem DBOS-dependência indevida e com a trava liberada quando o motor cai; teste 11 SEM "sessões não editam workflows" e COM "nenhuma credencial de produção no GitHub"; regressão pass^3 (MEL-31); provas automáticas a cada mudança, incluindo a prova da máquina e o validador dos 21; se o teste 1 falhar; se a conta for suspensa) e "Fases com portão" (Agora / 0a / 0b / 1 / 2 / 3 / 4, com o que entra em cada uma e o portão exato; fase 1 = os 21 agentes provados na especificação; fase 2 = esqueleto andando, primeiro o caminho de publicar com motor "olá" e a volta cronometrada; fase 3 = primeira meta real; fase 4 = ligar os demais um por vez, sub-card e "buscar" com prova própria) e "O que preciso de você" (lista de marcar em ordem: agora, 0a, 0b, fim da fase 1, 2, 3, 4; decisões: motor, chaves, Hostinger (conferir painel, sem recomendação), Lovable, URA/voz, Supabase grátis x Pro; a frase de aprovação: "aprovo o plano v3.1 e o roteiro das 10 pessoas, com o motor DBOS" ou com o motor escolhido).' },
  { key: 'anexo', secoes: '"Furos: seis rodadas de ataque" (tabela das rodadas 1-4 do v3 = 171, rodada 5 = análise dos especialistas (55 propostas, 48 melhorias, 12 correções da crítica), rodada 6 = ataques desta v3.1 — deixe a contagem da rodada 6 como "{RODADA6}" para o montador preencher; riscos aceitos; como o próximo furo aparece) e "Anexo: as provas" (o que foi conferido — mantenha as do v3 que continuam valendo e acrescente as novas da rodada 5 com URL, marcando NÃO CONFIRMADO o que não foi conferido; motores comparados; caminhos comparados; plataformas avaliadas: Vercel, GitHub, frameworks — o que copiamos, adaptamos e evitamos; base do plano com fontes).' },
]

const SEC_SCHEMA = { type: 'object', properties: { markdown: { type: 'string' }, mudancas_vs_v3: { type: 'array', items: { type: 'string' } }, nao_confirmados: { type: 'array', items: { type: 'string' } } }, required: ['markdown', 'mudancas_vs_v3', 'nao_confirmados'] }
const ATQ_SCHEMA = { type: 'object', properties: { furos: { type: 'array', items: { type: 'object', properties: { trecho: { type: 'string' }, problema: { type: 'string' }, cenario: { type: 'string' }, conserto: { type: 'string' }, gravidade: { type: 'string', enum: ['alta', 'media', 'baixa'] } }, required: ['trecho', 'problema', 'cenario', 'conserto', 'gravidade'] } } }, required: ['furos'] }

const LENTES = [
  'LENTE FURO REAL: procure um cenário concreto e realista para ESTE setup (fundador solo, VPS 4 núcleos dividida, Supabase grátis, ChatGPT por assinatura, Hermes -z, v1 rodando ao lado) que o texto não previne, não detecta ou não recupera: card perdido/duplicado/parado sem dono, resultado errado chegando sem aviso, abuso de segurança, estado sem volta, manutenção impossível, cota estourada. Compare com o registro dos 171 furos e a crítica: um furo fechado lá que este texto reabriu também conta.',
  'LENTE VERDADE E COERÊNCIA: procure frase falsa, exagerada ou não verificada (preço, recurso grátis/pago, limite, "nunca", "sempre", "zero"), contradição com outra regra do plano v3.1 (DECISÕES FIXAS) ou com as restrições (DEC-014, nada externo pelos agentes, frase do fundador), algo do v3 que foi perdido sem motivo, e linguagem que o fundador leigo não entenderia.',
]

phase('Redigir')
const secoes = await pipeline(GRUPOS,
  g => agent(`${CTX}\n\nTAREFA: redija em Markdown as seções: ${g.secoes}\nLeia antes as seções correspondentes do plano v3 e as melhorias/críticas citadas. Mantenha tudo o que o v3 já tinha de certo nessas seções (não encolha: o plano precisa continuar completo), aplique as melhorias e correções, e marque cada mudança. Use títulos "## " para seções. Devolva o markdown completo (sem escrever arquivo).`, { label: `redigir:${g.key}`, phase: 'Redigir', schema: SEC_SCHEMA }),
  (s, g) => parallel(LENTES.map((l, i) => () => agent(`${CTX}\n\nVocê é atacante independente. ${l}\nTexto a atacar (seções: ${g.key}):\n\n${s.markdown}\n\nSó furos reais, com o trecho exato.`, { label: `atacar:${g.key}:${i + 1}`, phase: 'Atacar seções', schema: ATQ_SCHEMA }))).then(ats => ({ s, furos: ats.filter(Boolean).flatMap(a => a.furos) })),
  ({ s, furos }, g) => furos.length
    ? agent(`${CTX}\n\nVocê é o autor destas seções (${g.key}). Atacantes independentes apontaram os furos abaixo. Confirme cada um nas fontes; conserte os reais no texto (sem encolher o resto); se um for falso, ignore. Devolva o markdown completo corrigido.\nTEXTO:\n${s.markdown}\nFUROS:\n${JSON.stringify(furos, null, 1)}`, { label: `consertar:${g.key}`, phase: 'Atacar seções', schema: SEC_SCHEMA }).then(r => ({ g: g.key, r: r || s, furos }))
    : ({ g: g.key, r: s, furos: [] }))

const ok = secoes.filter(Boolean)
const furosSecoes = ok.reduce((n, x) => n + x.furos.length, 0)
log(`${ok.length}/${GRUPOS.length} grupos redigidos; ${furosSecoes} furos apontados e tratados nas seções.`)

phase('Montar')
const ARQ = `${PAC}/01-plano-v3.1.md`
const montagem = await agent(`${CTX}\n\nTAREFA: monte o documento único em ${ARQ} (crie o arquivo com Write). Junte as seções abaixo NA ORDEM dada, sem perder conteúdo, removendo repetições entre seções (mantenha a ocorrência mais completa e ponha remissão "ver seção X"), uniformizando termos (mesmo nome para a mesma coisa em todo o texto), conferindo que números (tetos, prazos, contagens) batem entre seções, e que não sobrou "{RODADA6}" fora da seção de furos. No topo, logo depois do título: uma linha "Substitui o plano v3 (01-plano-v3.md), que fica como histórico." Devolva um resumo com as inconsistências que você resolveu.\n\nSEÇÕES:\n${ok.map(x => `<!-- ${x.g} -->\n${x.r.markdown}`).join('\n\n')}`, { model: 'sonnet', label: 'montar', phase: 'Montar' })

phase('Atacar documento')
const visto = new Set()
const confirmados = []
let secas = 0, rodada = 0
const LENTES_DOC = [
  'CICLO DO CARD E LÓGICA (jornada, regras de ferro, agente, motor, falhas)',
  'QUALIDADE E OS 21 AGENTES DE PONTA A PONTA (portões, relatório, equipe, primeira meta, treino)',
  'OPERAÇÃO, SEGURANÇA E MANUTENÇÃO (fase 0a/0b, publicar, GitHub, backup, custos, VPS, Supabase)',
  'VERDADE PARA O FUNDADOR (afirmações não verificadas, absolutos, contradições entre seções, o que ele precisa fazer está claro e possível)',
]
while (secas < 2 && rodada < 4) {
  rodada++
  const achados = (await parallel(LENTES_DOC.map((l, i) => () => agent(`${CTX}\n\nATAQUE RODADA ${rodada}, lente: ${l}. Leia ${ARQ} inteiro (só leitura) e as fontes. Traga até 6 furos NOVOS, reais, com trecho exato e cenário. Já tratados (não repita): ${JSON.stringify([...visto].slice(-60))}`, { model: 'sonnet', label: `doc:r${rodada}:${i + 1}`, phase: 'Atacar documento', schema: ATQ_SCHEMA })))).filter(Boolean).flatMap(a => a.furos)
  const k = f => (f.trecho.slice(0, 80) + '|' + f.problema.slice(0, 60)).toLowerCase()
  const novos = achados.filter(f => !visto.has(k(f)))
  novos.forEach(f => visto.add(k(f)))
  if (!novos.length) { secas++; log(`Documento rodada ${rodada}: nada novo (${secas}/2).`); continue }
  const julg = await parallel(novos.map(f => () => parallel([0, 1].map(j => () => agent(`${CTX}\n\nVerificador cético. Tente REFUTAR: o furo abaixo existe mesmo em ${ARQ} (leia) e é real para este setup? Já está coberto em outra seção? ${j ? 'O conserto proposto quebra outra regra?' : ''} Na dúvida, real=false.\nFURO: ${JSON.stringify(f)}`, { model: 'sonnet', label: `doc:r${rodada}:verificar`, phase: 'Atacar documento', schema: { type: 'object', properties: { real: { type: 'boolean' }, motivo: { type: 'string' } }, required: ['real', 'motivo'] } }))).then(vs => ({ f, n: vs.filter(Boolean).filter(v => v.real).length }))))
  const conf = julg.filter(Boolean).filter(j => j.n >= 2).map(j => j.f)
  log(`Documento rodada ${rodada}: ${novos.length} novos, ${conf.length} confirmados.`)
  if (!conf.length) { secas++; continue }
  secas = 0
  confirmados.push(...conf.map(f => ({ ...f, rodada })))
  await agent(`${CTX}\n\nVocê é o editor de ${ARQ}. Conserte no próprio arquivo (com Edit) cada furo confirmado abaixo, sem encolher o resto e mantendo a coerência entre seções. FUROS:\n${JSON.stringify(conf, null, 1)}`, { model: 'sonnet', label: `doc:r${rodada}:consertar`, phase: 'Atacar documento' })
}
if (secas < 2) log(`Parou no limite de ${rodada} rodadas sem 2 secas seguidas.`)

phase('Registro')
const registro = await agent(`${CTX}\n\nTAREFA 1: escreva ${PAC}/02-registro-de-furos-rodadas-5-e-6.md no mesmo formato do registro original (tabelas: # | Furo | Conserto no plano (seção) | Teste que prova | Fase). Rodada 5 = as 48 melhorias e as 12 correções da crítica (fontes 03, 04 e o JSON verificado), uma linha por item, com o conserto como ficou em ${ARQ}. Rodada 6 = os furos abaixo (das seções e do documento), com o conserto como ficou. IDs: R5-MEL-xx, R5-CRI-xx, R6-xx.\nTAREFA 2: em ${ARQ}, substitua "{RODADA6}" pela contagem real da rodada 6 (${furosSecoes} apontados nas seções + ${confirmados.length} confirmados no documento) e confira que a tabela de rodadas bate com os registros. Devolva um resumo curto.\nFUROS DAS SEÇÕES:\n${JSON.stringify(ok.map(x => ({ grupo: x.g, furos: x.furos })), null, 1)}\nFUROS DO DOCUMENTO:\n${JSON.stringify(confirmados, null, 1)}`, { model: 'sonnet', label: 'registro', phase: 'Registro' })

return { arquivo: ARQ, furosSecoes, rodadas: rodada, secas, confirmados: confirmados.length, montagem, registro }
