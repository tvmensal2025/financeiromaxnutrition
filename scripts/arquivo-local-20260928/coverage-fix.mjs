import fs from 'node:fs';
const path='src/components/executive/SupervisionPanel.tsx';
let s=fs.readFileSync(path,'utf8');
s=s.replace("  const agentes =", "  const revisaoCompleta = pronto && dados?.agentes.estado === 'ok' && dados?.projetos.estado === 'ok';\n  const agentes =");
s=s.replace("['GRUPO','SISTEMA'].includes(id)","['GRUPO','SISTEMA'].includes(normalizar(id))");
s=s.replace("{pronto || i===3 ? m.value : '—'}","{revisaoCompleta || i===3 ? m.value : '—'}");
s=s.replace("{pronto ? 'Nenhum apontamento", "{revisaoCompleta ? 'Nenhum apontamento");
s=s.replace('<p>{f.bloqueadas} bloqueadas · {f.concluidas} concluídas · {f.itens.length} registros visíveis</p>',"<p>{pronto ? `${f.bloqueadas} bloqueadas · ${f.concluidas} concluídas · ${f.itens.length} registros visíveis` : 'Contagens aguardando leitura completa'}</p>");
fs.writeFileSync(path,s);
