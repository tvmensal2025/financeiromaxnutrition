import fs from 'node:fs';
const p='src/components/executive/CommandPriorities.tsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace('  return <section',`  const mostradas = new Set<string>();
  const filasComPrevia = filas.map(f => {
    const previa = f.itens.find(t => !mostradas.has(t.task_id)) || f.itens[0];
    if (previa) mostradas.add(previa.task_id);
    return {...f, previa};
  });
  return <section`);
s=s.replace('{filas.map(', '{filasComPrevia.map(');
const split=s.indexOf('  return <section');
s=s.slice(0,split)+s.slice(split).replaceAll('f.itens[0]','f.previa').replace('Ver {f.titulo.toLowerCase()}',"Ver {f.id === 'FUNDADOR' ? 'suas pendências' : f.id === 'ATRASOS' ? 'atrasos' : f.titulo.toLowerCase()}");
fs.writeFileSync(p,s);
const page='src/pages/ComandoPage.tsx';
let q=fs.readFileSync(page,'utf8').replace('{nomeDe?.(f.id) || f.id}',"{normalizar(f.id) === 'GRUPO' ? 'Compartilhado do grupo' : normalizar(f.id) === 'SISTEMA' ? 'Operação do sistema' : nomeDe?.(f.id) || f.id}");
fs.writeFileSync(page,q);
