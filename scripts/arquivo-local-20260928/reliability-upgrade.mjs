import fs from 'node:fs';
const edit=(path,fn)=>fs.writeFileSync(path,fn(fs.readFileSync(path,'utf8')));
edit('src/pages/ExecucaoPage.tsx',s=>{
 s='import { diaSaoPaulo } from "@/lib/comando";\n'+s;
 s=s.replaceAll('|| "2026-09-25 04:25"','|| "Horário não informado"').replaceAll('|| "2026-09-25 04:30"','|| "Horário não informado"').replace('p.ultima_atualizacao || "2026-09-25"','p.ultima_atualizacao || "Não informada"').replace('ag.ultima_atualizacao ||\r\n        "2026-09-25"','ag.ultima_atualizacao ||\r\n        "Não informada"');
 s=s.replaceAll('"2026-09-25"','diaSaoPaulo()').replace('Hoje (25/09/2026)','Hoje (Brasília)').replace('|| "25/09/2026"','|| "Não informado"');
 s=s.replaceAll('Concluídas Hoje','Concluídas atualizadas hoje');
 s=s.replace('conn?.connection_status || "CONNECTED"','conn?.connection_status || "UNKNOWN"');
 return s;
});
edit('src/lib/execucao.ts',s=>{
 s='import { diaSaoPaulo } from "./comando";\n'+s;
 s=s.replaceAll('dataReferencia: string = "2026-09-25"','dataReferencia: string = diaSaoPaulo()');
 s=s.replace('padrão: hoje 2026-09-25','padrão: hoje em Brasília; usa última atualização, não data de conclusão');
 s=s.replace('  if (t.prazo === dataReferencia) return true;\r\n','');
 s=s.replace('  if (t.atualizado_em && t.atualizado_em.startsWith(dataReferencia)) return true;','  if (t.atualizado_em) {\n    const d = new Date(t.atualizado_em);\n    if (!Number.isNaN(d.getTime()) && diaSaoPaulo(d) === dataReferencia) return true;\n  }');
 return s;
});
edit('src/components/Layout.tsx',s=>s.replace('  { to: "/inbox", label: "Inbox", icon: Inbox },\n','').replace('  Inbox,\n',''));
edit('src/components/executive/ExecutiveMetricCard.tsx',s=>s.replace('className={`rounded-xl','className={`he-metric rounded-xl'));
