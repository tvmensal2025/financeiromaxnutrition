import fs from 'node:fs';
const edit=(path,fn)=>{const s=fs.readFileSync(path,'utf8');fs.writeFileSync(path,fn(s));};
edit('src/components/Layout.tsx',s=>{
 s=s.replace('  Sliders,','  ChevronDown,\n  CircleDollarSign,').replace('  HelpCircle,\n','').replace('  PieChart,\n','');
 s=s.replace('{ to: "/", label: "Painel", icon: LayoutDashboard, end: true },','{ to: "/", label: "Sala de comando", icon: LayoutDashboard, end: true },').replace('{ to: "/comando", label: "Sala de comando", icon: Compass },','{ to: "/supervisao", label: "Supervisão da Helena", icon: Shield },\n  { to: "/empresas", label: "Operação por empresa", icon: Building2 },\n  { to: "/consumo", label: "Consumo e rotinas", icon: CircleDollarSign },').replace('  { to: "/inbox", label: "Inbox", icon: Inbox },\n','').replace('  Inbox,\n','');
 s=s.replace('{ to: "/portfolio", label: "Portfólio", icon: Building2 },','{ to: "/portfolio", label: "Portfólio", icon: Building2 },\n  { to: "/indicadores", label: "Indicadores de negócio", icon: LayoutDashboard },').replace(', badge: "21"','');
 s=s.replace('  const { currentBusiness, currentBusinessId, isConsolidated, rotulo } = useBusiness();','  const { currentBusiness, isConsolidated, error: businessError } = useBusiness();\n  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});');
 s=s.replace('if (pathname === "/") return `${empresaNome} / Painel`;','if (pathname === "/") return `${empresaNome} / Sala de comando`;\n    if (pathname === "/supervisao") return `${empresaNome} / Supervisão`;\n    if (pathname === "/empresas") return `${empresaNome} / Operação por empresa`;\n    if (pathname === "/consumo") return `${empresaNome} / Consumo e rotinas`;\n    if (pathname === "/indicadores") return `${empresaNome} / Indicadores de negócio`;');
 const start=s.indexOf('        <div>\n          <p className="pe-sidebar-section">Negócios');
 // CRLF normalized before matching.
 return s;
});
edit('src/components/Layout.tsx',s=>{
 s=s.replaceAll('\r\n','\n');
 const start=s.indexOf('        <div>\n          <p className="pe-sidebar-section">Negócios');
 const end=s.indexOf('\n      </div>\n    </div>\n  );',start);
 if(start<0||end<0)throw Error('Sidebar anchor missing');
 s=s.slice(0,start)+`        {[
          { titulo: 'Negócios', itens: BLOCO_NEGOCIOS },
          { titulo: 'Operação', itens: BLOCO_OPERACAO },
          { titulo: 'Inteligência', itens: BLOCO_INTELIGENCIA },
          { titulo: 'Governança', itens: BLOCO_GOVERNANCA },
          { titulo: 'Administração', itens: BLOCO_ADMINISTRACAO },
        ].map(grupo => {
          const ativa = grupo.itens.some(i => pathname === i.to);
          const aberta = gruposAbertos[grupo.titulo] ?? ativa;
          return <div key={grupo.titulo} className="he-nav-group">
            <button className="he-nav-group-toggle" aria-expanded={aberta} onClick={() => setGruposAbertos(g => ({...g, [grupo.titulo]: !aberta}))}><span>{grupo.titulo}</span><ChevronDown size={14} className={aberta ? 'rotate-180' : ''}/></button>
            {aberta && <div className="space-y-0.5">{grupo.itens.map(item => <NavItemLink key={item.to} item={item} onClick={fecharMobile}/>)}</div>}
          </div>;
        })}
        <div className="he-sidebar-signature"><span>HELENA HUB</span><p>Direção clara.<br/>Execução verificável.</p></div>`+s.slice(end);
 s=s.replace('mobileAberto ? "translate-x-0" : "-translate-x-full"','mobileAberto ? "translate-x-0" : "hidden"');
 s=s.replace('<main className="pe-main flex-1 w-full">','<main className="pe-main flex-1 w-full">\n          {businessError && <div className="hc-warning" role="alert">Cadastro de empresas indisponível. Atualize a página para tentar novamente.</div>}');
 return s;
});
edit('src/components/Header.tsx',s=>s.replace('Sistema sincronizado','Sessão autenticada').replace('animate-pulse',''));
edit('src/main.tsx',s=>s+'\nimport "./styles/helena-premium.css";\n');
edit('src/contexts/BusinessContext.tsx',s=>s.replace('useState<Empresa[]>(EMPRESAS_BASE)','useState<Empresa[]>([])').replace('if (!idCandidato) return lista[0]?.id || "BIZ-001";','if (!idCandidato) return "GRUPO";').replace('const listaFinal = listaMapeada.length ? listaMapeada : EMPRESAS_BASE;','if (err) throw err;\n      const listaFinal = listaMapeada;').replace('setEmpresas(EMPRESAS_BASE);','setEmpresas([]);').replace('setCurrentBusinessIdState("BIZ-001");','setCurrentBusinessIdState("GRUPO");'));
edit('src/components/executive/ExecutiveErrorState.tsx',s=>s.replace('  moduleName?: string;','  title?: string;\n  moduleName?: string;').replace('  moduleName,','  title,\n  moduleName,').replace('{moduleName ? `Não foi possível carregar ${moduleName}` : "Falha na comunicação"}','{title || (moduleName ? `Não foi possível carregar ${moduleName}` : "Falha na comunicação")}'));
edit('src/components/executive/ExecutiveLoadingState.tsx',s=>s.replace('  rows?: number;','  message?: string;\n  rows?: number;').replace('  rows = 4,','  message = "Carregando registros",\n  rows = 4,').replace('<div className={`grid','<div role="status" aria-label={message} className={`grid').replace('<div className={`space-y-3','<div role="status" aria-label={message} className={`space-y-3'));
edit('src/components/executive/ExecutiveBadge.tsx',s=>s.replace('  | "default"','  | "neutral"\n  | "default"'));
edit('src/components/executive/ExecutiveDrawer.tsx',s=>s.replace('width?: "normal" | "wide";','width?: "normal" | "wide" | "max-w-lg";'));
