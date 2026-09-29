import fs from 'node:fs';
const path='src/pages/ComandoPage.tsx';
let s=fs.readFileSync(path,'utf8');
const replace=(a,b)=>{if(!s.includes(a))throw new Error('Trecho não encontrado: '+a.slice(0,90));s=s.replace(a,b);};
replace('Waypoints, CircleHelp }','Waypoints, CircleHelp, ChevronLeft, ChevronRight, X, Layers3 }');
replace('import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";', 'import * as Dialog from "@radix-ui/react-dialog";\nimport { TaskBrief } from "@/components/executive/TaskBrief";');
replace('const abas = ["Visão geral", "Agentes",', 'const abas = ["Visão geral", "Tarefas", "Agentes",');
replace('const [busca, setBusca] = useState("");','const [busca, setBusca] = useState("");\n  const [buscaTarefa, setBuscaTarefa] = useState("");\n  const [limite, setLimite] = useState(8);');
replace('useEffect(() => { setTarefaId(null); setFiltroStatus("TODOS"); }, [currentBusinessId]);','useEffect(() => { setTarefaId(null); setFiltroStatus("TODOS"); }, [currentBusinessId]);\n  useEffect(() => { setLimite(8); }, [buscaTarefa, filtroStatus, currentBusinessId]);');
const taskLine=s.split('\n').find(l=>l.includes('const listaTarefas ='));
replace(taskLine,taskLine.replace('const listaTarefas = tarefas.filter','const listaTarefas = tarefas.filter(t => normalizar(`${t.task_id} ${t.tarefa} ${t.responsavel}`).includes(normalizar(buscaTarefa))).filter'));
replace('  function cardTarefa(t: TarefaComando) {',`  const prioritarias = abertos.slice().sort((a,b) => {
    const pesos: Record<string,number> = { CRITICA: 4, ALTA: 3, MEDIA: 2, BAIXA: 1 };
    return (pesos[normalizar(b.prioridade)] || 0) - (pesos[normalizar(a.prioridade)] || 0) || (a.prazo || "9999").localeCompare(b.prazo || "9999");
  }).slice(0,4);
  const indiceTarefa = tarefa ? tarefas.findIndex(t => t.task_id === tarefa.task_id) : -1;
  function mostrarTarefas(status = "TODOS") { setFiltroStatus(status); setAba("Tarefas"); }

  function cardTarefa(t: TarefaComando) {`);
replace('<button key={t.task_id} className="hc-task"','<button key={t.task_id} className={`hc-task ${normalizar(t.status) === "BLOQUEADA" ? "is-blocked" : ""}`}');
replace('<span>{t.responsavel || "Responsável não informado"}</span><ArrowUpRight size={16} />','<span>{t.responsavel || "Responsável não informado"}</span><span className="hc-open-task">Abrir tarefa <ArrowUpRight size={16} /></span>');
replace('<h1>Sala de comando<span>.</span></h1><p>Clareza para decidir. Evidência para acompanhar.</p>', '<h1>Sala de comando<span>.</span></h1><p>Uma visão de cada prioridade. Um caminho claro para cada entrega.</p>');
const preview=s.split('\n').find(l=>l.includes('<div className="hc-preview">'));
replace(preview, '    <details className="hc-source-note"><summary><ShieldCheck size={15}/> Dados da sua sessão · somente leitura <span>Sobre esta visão</span></summary><p>Os módulos atuais continuam disponíveis. As atualizações desta página não aprovam tarefas nem executam agentes. A leitura respeita as permissões atuais.</p></details>');
replace('<span>01 / DIREÇÃO DA HELENA</span>','<span>PRIORIDADE EXECUTIVA</span>');
replace('<div className="hc-focus-footer"><div>','<div className="hc-focus-footer"><AgentAvatar agentId="AGT-01" nome="Helena" size={40}/><div>');
replace('<div className="hc-eyebrow">02 / ATENÇÃO DO FUNDADOR</div>','<div className="hc-eyebrow">CENTRAL DE ATENÇÃO</div>');
replace('onClick={() => { setFiltroStatus("BLOQUEADA"); document.getElementById("hc-tarefas")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}','onClick={() => mostrarTarefas("BLOQUEADA")}');
replace('onClick={() => setFiltroStatus(filtroStatus === g.id ? "TODOS" : g.id)}','onClick={() => mostrarTarefas(g.id)}');
const taskStart=s.indexOf('      <article className="hc-card" id="hc-tarefas">');
const taskEnd=s.indexOf('\n',taskStart);
let taskBlock=s.slice(taskStart,taskEnd);
s=s.slice(0,taskStart)+s.slice(taskEnd);
taskBlock=taskBlock.replace('05 / INSPEÇÃO','CENTRAL DE ENTREGAS').replace('Da tarefa à evidência','Toda tarefa tem um próximo passo.').replace('{listaTarefas.map(cardTarefa)}','{listaTarefas.slice(0,limite).map(cardTarefa)}');
taskBlock=taskBlock.replace('<div className="hc-task-grid">','<label className="hc-search hc-task-search"><Search size={18}/><input aria-label="Buscar tarefa ou responsável" placeholder="Buscar por tarefa, responsável ou código…" value={buscaTarefa} onChange={e => setBuscaTarefa(e.target.value)}/><span>{listaTarefas.length} registros</span></label><div className="hc-task-grid">');
taskBlock=taskBlock.replace('</article>','{listaTarefas.length > limite && <button className="hc-button hc-load-more" onClick={() => setLimite(n => n+8)}>Mostrar mais tarefas <ChevronRight size={16}/></button>}</article>');
replace('    {aba === "Agentes"', '    {aba === "Tarefas" && <div className="hc-stack">'+taskBlock.trim()+'</div>}\n\n    {aba === "Agentes"');
replace('      <div className="hc-two">\n        <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">03 / ANDAMENTO</div>',`      <article className="hc-card hc-priority"><div className="hc-section-heading hc-row"><div><div className="hc-eyebrow">PRIORIDADE E PRAZO</div><h2>Entregas que merecem atenção</h2><p>Primeiras tarefas abertas por prioridade e prazo. Clique para ver o que falta.</p></div><button className="hc-text-button" onClick={() => mostrarTarefas()}>Todas as tarefas <ArrowRight size={16}/></button></div><div className="hc-task-grid">{prioritarias.map(cardTarefa)}</div>{!prioritarias.length && <p className="hc-empty">{disponivel ? "Sem tarefas abertas visíveis neste recorte." : "Aguardando a leitura das tarefas."}</p>}</article>
      <div className="hc-two">
        <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">PANORAMA DA OPERAÇÃO</div>`);
replace('04 / RESPONSABILIDADE','EQUIPE EM FOCO');
replace('06 / REGISTROS RECENTES','MOVIMENTAÇÕES RECENTES');
replace('  <Sheet open=', '  <Dialog.Root open=');
replace('<SheetContent onCloseAutoFocus={event => { event.preventDefault(); origemDrawer.current?.focus(); }} className="hc-drawer w-full sm:max-w-xl overflow-y-auto">', `<Dialog.Portal><Dialog.Overlay className="hc-modal-overlay"/><Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); origemDrawer.current?.focus(); }} className={tarefa ? "hc-modal" : "hc-modal hc-agent-modal"}>
      <header className="hc-modal-header"><div><span className="hc-eyebrow"><Layers3 size={14}/>{tarefa ? "ESPAÇO DA ENTREGA" : "PERFIL DO ESPECIALISTA"}</span>`);
replace('<SheetTitle>{agente ? `${agente.agente} · ${agente.cargo_funcao}` : tarefa?.task_id || "Detalhes"}</SheetTitle><SheetDescription>{agente ? "Função registrada no Supabase e acompanhamento no recorte selecionado." : "Estado registrado da tarefa. Evidência descrita não significa validação independente."}</SheetDescription>', '<Dialog.Title>{agente ? `${agente.agente} · ${agente.cargo_funcao}` : tarefa?.tarefa || "Detalhes"}</Dialog.Title><Dialog.Description>{agente ? "Responsabilidades e entregas no recorte selecionado." : "Responsável, dependências e evidência em um só lugar."}</Dialog.Description></div><Dialog.Close className="hc-modal-close" aria-label="Fechar detalhes"><X size={20}/></Dialog.Close></header><div className="hc-modal-body">');
const start=s.indexOf('      {tarefa && <><h2');
const end=s.indexOf('    </SheetContent></Sheet>',start);
if(start<0||end<0)throw new Error('Modal anterior não encontrado');
s=s.slice(0,start)+`      {tarefa && <TaskBrief tarefa={tarefa} agentes={agentes}/>}
      </div><footer className="hc-modal-footer"><span>{tarefa ? "Último registro: " + dataHora(tarefa.atualizado_em) + " · Brasília" : "Permissões descritas conforme cadastro do agente"}</span>{tarefa && <div className="hc-modal-navigation"><button aria-label="Tarefa anterior" disabled={indiceTarefa <= 0} onClick={() => setTarefaId(tarefas[indiceTarefa-1].task_id)}><ChevronLeft size={18}/></button><span>{indiceTarefa+1} / {tarefas.length}</span><button aria-label="Próxima tarefa" disabled={indiceTarefa >= tarefas.length-1} onClick={() => setTarefaId(tarefas[indiceTarefa+1].task_id)}><ChevronRight size={18}/></button></div>}</footer>
    </Dialog.Content></Dialog.Portal></Dialog.Root>`+s.slice(end+'    </SheetContent></Sheet>'.length);
fs.writeFileSync(path,s);
