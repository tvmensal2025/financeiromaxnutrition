// Nenhum segredo com valor padrão no código do gateway: sem a variável de ambiente, a função falha fechada.
// A mensagem de falha mostra só o NOME da variável, nunca o valor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function moduleFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return moduleFiles(full);
    return entry.name.endsWith('.mjs') ? [full] : [];
  });
}

// process.env.ALGO_TOKEN || 'valor'  (também com aliases encadeados e ??)
const SECRET_FALLBACK = /process\.env\.([A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_]*)\s*(?:\|\||\?\?)\s*(?:process\.env\.[A-Z0-9_]+\s*(?:\|\||\?\?)\s*)*(['"`])([^'"`]+)\2/g;
const HARMLESS_DEFAULT = /^(\[\]|\{\}|true|false|\d+)$/;

test('nenhum segredo tem valor padrão no código (src/ e dev-server.mjs)', () => {
  const found = [];
  for (const file of [...moduleFiles(path.join(root, 'src')), path.join(root, 'dev-server.mjs')]) {
    for (const match of readFileSync(file, 'utf8').matchAll(SECRET_FALLBACK)) {
      if (!HARMLESS_DEFAULT.test(match[3])) found.push(`${path.relative(root, file)}: ${match[1]}`);
    }
  }
  assert.deepEqual(found, [], `segredo com valor padrão no código (só o nome): ${found.join(', ')}`);
});
