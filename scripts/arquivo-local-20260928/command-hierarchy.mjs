import fs from 'node:fs';
const p='src/pages/ComandoPage.tsx';
let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
s=s.replace('import { SupervisionPanel }', 'import { CommandPriorities, type PriorityFilter } from "@/components/executive/CommandPriorities";\nimport { distribuirEmpresas } from "@/lib/supervisao";\nimport { SupervisionPanel }');
s=s.replace('agruparStatus, atribuidoA,','requerFundador, agruparStatus, atribuidoA,');
s=s.replace('isConsolidated, rotulo } = useBusiness()', 'isConsolidated, rotulo, nomeDe } = useBusiness()');
s=s.replace('  const [filtroStatus,', '  const [filtroAtencao, setFiltroAtencao] = useState<"TODOS" | "FUNDADOR" | "ATRASOS">("TODOS");\n  const [filtroStatus,');
s=s.replace('setAgenteId(null); setFiltroStatus("TODOS"); }, [currentBusinessId]);','setAgenteId(null); setFiltroStatus("TODOS"); setFiltroAtencao("TODOS"); }, [currentBusinessId]);');
s=s.replace('[buscaTarefa, filtroStatus, currentBusinessId]', '[buscaTarefa, filtroStatus, filtroAtencao, currentBusinessId]');
s=s.replace('  const atrasos = abertos.filter(t => atrasada(t));\n','').replace('  const bloqueadas = tarefas.filter(t => normalizar(t.status) === "BLOQUEADA");\n','');
s=s.replace('const listaTarefas = tarefas.filter(', 'const listaTarefas = tarefas.filter(t => filtroAtencao === "TODOS" || (filtroAtencao === "FUNDADOR" ? requerFundador(t) : atrasada(t))).filter(');
s=s.replace('function mostrarTarefas(status = "TODOS") { setFiltroStatus(status); setAba("Tarefas"); }','function mostrarTarefas(status = "TODOS") { setFiltroAtencao("TODOS"); setFiltroStatus(status); setAba("Tarefas"); }\n  function verFila(filtro: PriorityFilter) {\n    mostrarTarefas(filtro === "BLOQUEADA" ? "BLOQUEADA" : "TODOS");\n    setFiltroAtencao(filtro === "BLOQUEADA" ? "TODOS" : filtro);\n    setBuscaTarefa("");\n  }');
const headerStart=s.indexOf('    <header className="hc-heading">');
const headerEnd=s.indexOf('    {falhas.length',headerStart);
if(headerStart<0||headerEnd<0)throw Error('Header missing');
s=s.slice(0,headerStart)+`    <header className="hc-heading hc-heading-compact">
      <div><h1>Sala de comando<span>.</span></h1><p><strong>{isConsolidated ? "Grupo consolidado" : rotulo}</strong><span> · {isConsolidated ? "Visão dos negócios" : "Empresa selecionada + grupo e sistema"}</span></p></div>
      <div className="hc-header-actions"><details className="hc-update-details"><summary><ShieldCheck size={15}/> Consulta e fonte</summary><div><strong>Última consulta: {dataHora(leitura)} · Brasília</strong><p>Consulta a cada 30 s enquanto a página está visível. As leituras não acionam agentes nem aprovam tarefas.</p><p>Dados permitidos pela sua sessão. A leitura do banco e as regras de execução permanecem separadas da apresentação.</p></div></details><button className="hc-button" aria-label="Atualizar dados" disabled={carregando} onClick={() => setCiclo(n => n + 1)}><RefreshCw size={16} className={carregando ? "animate-spin" : ""}/><span>{carregando ? "Consultando…" : "Atualizar"}</span></button></div>
    </header>
`+s.slice(headerEnd);
const heroStart=s.indexOf('      <div className="hc-hero-grid">');
const metricsStart=s.indexOf('      <div className="hc-metrics">',heroStart);
const prioritiesStart=s.indexOf('      <article className="hc-card hc-priority">',metricsStart);
const focusStart=s.indexOf('        <article className="hc-focus">',heroStart);
const focusEnd=s.indexOf('        </article>',focusStart)+'        </article>'.length;
if([heroStart,metricsStart,prioritiesStart,focusStart].some(x=>x<0))throw Error('Overview anchors missing');
const focus=s.slice(focusStart,focusEnd).replace('className="hc-focus"','className="hc-focus hc-direction-summary"');
const metrics=s.slice(metricsStart,prioritiesStart);
s=s.slice(0,heroStart)+`      <CommandPriorities tarefas={tarefas} disponivel={disponivel} abrirTarefa={abrirTarefa} verFila={verFila}/>
      <section className="hc-company-overview" aria-label="Entregas por empresa"><div className="hc-section-heading hc-row"><div><span className="hc-eyebrow">ENTREGAS POR EMPRESA</span><h2>Cada negócio com sua própria fila</h2></div><button className="hc-text-button" onClick={()=>setAba('Empresas')}>Ver distribuição completa <ArrowRight size={16}/></button></div><div className="hc-company-strip">{distribuirEmpresas(tarefas).map(f=><button key={f.id} onClick={()=>setAba('Empresas')}><small>{f.id}</small><strong>{nomeDe?.(f.id) || f.id}</strong><span>{disponivel ? f.abertas : '—'} abertas · {disponivel ? f.bloqueadas : '—'} bloqueadas</span></button>)}</div>{!tarefas.length && <p className="hc-empty">{disponivel ? 'Sem entregas visíveis neste recorte.' : 'Aguardando leitura das entregas.'}</p>}</section>
`+s.slice(prioritiesStart);
const timeline=s.indexOf('      <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">MOVIMENTAÇÕES RECENTES');
if(timeline<0)throw Error('Timeline missing');
s=s.slice(0,timeline)+focus+'\n'+metrics+s.slice(timeline);
s=s.replace('<div className="hc-task-grid">{listaTarefas.slice(0,limite)', '{filtroAtencao !== "TODOS" && <div className="hc-active-filter"><span>Mostrando: {filtroAtencao === "FUNDADOR" ? "Precisa de você" : "Prazo vencido"}</span><button onClick={()=>setFiltroAtencao("TODOS")}>Limpar filtro <X size={14}/></button></div>}<div className="hc-task-grid">{listaTarefas.slice(0,limite)');
fs.writeFileSync(p,s);
