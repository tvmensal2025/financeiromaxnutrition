// Extrai somente literais; não executa o código da aplicação.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
    if (!ts.isPropertyAssignment(p)) throw new Error('Propriedade não literal');
    return [p.name.text, literal(p.initializer)];
  }));
  throw new Error('Plano deve conter apenas objetos, arrays e textos literais');
}
function extrair(file, name) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let value;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) value = literal(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!value) throw new Error('Plano não encontrado: ' + name);
  return value;
}
const plano = {
  estado: 'PROPOSTA; não abre tarefas nem altera WIP',
  data_revisao: '2026-09-26',
  plano_evolucao: extrair('src/lib/comando.ts', 'planoEvolucao'),
  processo: extrair('src/pages/ComandoPage.tsx', 'passos'),
  fontes: ['src/lib/comando.ts', 'src/pages/ComandoPage.tsx', 'public.tarefas', 'public.foco_executivo']
};
fs.writeFileSync(path.join(root, 'docs/helena/plano-evolucao.json'), JSON.stringify(plano, null, 2) + '\n');
