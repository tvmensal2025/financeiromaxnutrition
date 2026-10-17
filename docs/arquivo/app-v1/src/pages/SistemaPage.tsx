import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, RefreshCw, PlugZap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { lerPaginas } from '@/lib/leitura-paginada';
import { ExecutivePageHeader } from '@/components/executive/ExecutivePageHeader';
import { ExecutiveMetricCard } from '@/components/executive/ExecutiveMetricCard';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { dataHora } from '@/lib/data-hora';

type Connection = {agent_id:string; connection_status:string|null;provider:string|null;last_tested_at:string|null};
export default function SistemaPage() {
  const [connections,setConnections]=useState<Connection[]|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [cycle,setCycle]=useState(0);
  const [readAt,setReadAt]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setLoading(true);setError(false);setConnections(null);
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    (async()=>{
      try {
        const result=await lerPaginas<Connection>((start,end)=>supabase.from('agent_connections').select('agent_id,connection_status,provider,last_tested_at',{count:'exact'}).order('agent_id').range(start,end).abortSignal(controller.signal),controller.signal);
        if(!active) return;
        if(result.error) setError(true); else {setConnections(result.data??[]);setReadAt(new Date().toISOString());}
      } catch {if(active) setError(true);}
      finally {window.clearTimeout(timeout);if(active)setLoading(false);}
    })();
    return ()=>{active=false;controller.abort();window.clearTimeout(timeout);};
  },[cycle]);
  const connected=connections?.filter(c=>c.connection_status==='CONNECTED').length;
  const other=connections?connections.length-(connected??0):null;
  return <div className="he-system-page space-y-6">
    <ExecutivePageHeader title="Conexões em perspectiva." description="Veja o que está registrado, quando foi verificado e o que ainda precisa de atenção." icon={Activity} breadcrumb="SISTEMA / VISIBILIDADE" actions={<button className="he-action-button" disabled={loading} onClick={()=>setCycle(c=>c+1)}><RefreshCw size={15}/>{loading?'Consultando…':'Atualizar'}</button>}/>
    {error&&<div role="alert" className="he-system-notice">Não foi possível consultar as conexões. Tente atualizar. Nenhum status de funcionamento foi presumido.</div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ExecutiveMetricCard label="Conexões cadastradas" value={connections?.length} subtext={loading?'Consultando os registros':'Visíveis para sua conta'}/>
      <ExecutiveMetricCard label="Marcadas como conectadas" value={connected} subtext="Conforme o último registro"/>
      <ExecutiveMetricCard label="Outros estados" value={other} subtext="Consultar os detalhes abaixo"/>
    </div>
    <div className="he-system-panel"><header><div><span className="he-page-kicker">MAPA DE CONEXÕES</span><h2>Clareza para acompanhar.</h2></div><Link to="/integracoes">Gerenciar integrações <ArrowUpRight size={16}/></Link></header>
      <p>Uma conexão registrada não comprova que o agente concluiu uma tarefa. Acompanhe o resultado na <Link to="/entregas">biblioteca de entregas</Link>.</p>
      {loading?<p role="status">Carregando conexões…</p>:connections?.length===0?<div className="he-chart-empty"><PlugZap/><p>Nenhuma conexão cadastrada está visível para sua conta.</p></div>:connections&&<div className="he-system-list">{connections.map(c=><article key={c.agent_id}><span className="he-connection-icon"><PlugZap size={19}/></span><div><h3>{c.agent_id==='AGT-01'?'Helena':c.agent_id}</h3><p>{c.provider||'Provedor não informado'}</p></div><div><ExecutiveBadge variant={c.connection_status==='CONNECTED'?'success':'neutral'}>{c.connection_status==='CONNECTED'?'Conectada':c.connection_status==='DISCONNECTED'?'Desconectada':c.connection_status==='ERROR'?'Requer atenção':'A conferir'}</ExecutiveBadge><p>{c.last_tested_at?`Último teste: ${dataHora(c.last_tested_at)}`:'Sem teste registrado'}</p></div></article>)}</div>}
      <footer>{readAt&&!error?`Consulta realizada em ${dataHora(readAt)}`:'Aguardando consulta confirmada'} · Nenhum teste pago é disparado nesta página.</footer>
    </div>
    <div className="he-system-notice"><strong>O que este painel confirma</strong><p>Mostra os registros de conexão autorizados para sua conta. Disponibilidade dos provedores, permissões do banco e execução completa dos agentes exigem verificações próprias.</p></div>
  </div>;
}
