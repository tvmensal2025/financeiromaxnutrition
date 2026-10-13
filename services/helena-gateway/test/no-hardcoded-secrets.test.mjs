// Nenhum segredo com valor padrão no código do gateway: sem a variável de ambiente, a função falha fechada.
// A mensagem de falha mostra só o NOME da variável, nunca o valor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

// ---------------------------------------------------------------- repositório inteiro
// Os segredos que vazaram (13/10/2026) não podem voltar a nenhum arquivo do repositório: token do meowcaller,
// token MCP, chave service_role do Supabase, chave do Kokoro e chave da Evolution, além de formatos comuns de
// chave (OpenAI, ElevenLabs, Google, GitHub). Valores falsos de teste (com "teste", "fake", "exemplo"...) e JWT
// "anon" (público) são permitidos. A falha mostra só arquivo, linha e tipo, nunca o valor.
const repoRoot = path.resolve(root, '..', '..');
const FAKE_VALUE = /teste|test|fake|exemplo|example|dummy|simulad|xxxx/i;
// SHA-256 das duas chaves vazadas que não têm formato próprio (o valor não fica neste arquivo).
const LEAKED_SHA256 = new Map([
  ['c860ed236298586eda7c6967059f599218423a4bfb9fd6ce2e6f481d08c81f4b', 'chave do Kokoro'],
  ['52a8db81739d42fa20348b648053c582902105ae3ca05024fbc58ad7c1605a93', 'chave da Evolution']
]);
const SECRET_PATTERNS = [
  [/helena_(?:meow|mcp)_sec_[A-Za-z0-9]{6,}/g, 'token do meowcaller/MCP'],
  [/sk-(?:proj-)?[A-Za-z0-9_-]{24,}/g, 'chave OpenAI'],
  [/sk_[0-9a-f]{40,}/g, 'chave ElevenLabs'],
  [/AIza[0-9A-Za-z_-]{35}/g, 'chave Google'],
  [/ghp_[A-Za-z0-9]{30,}/g, 'token GitHub']
];
const TEXT_FILE = /\.(m?js|cjs|ts|tsx|json|md|py|sh|sql|txt|ya?ml|html|toml|css|example)$|(^|\/)\.env/i;

export function findSecretsInText(text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, kind] of SECRET_PATTERNS) {
      for (const match of line.matchAll(pattern)) if (!FAKE_VALUE.test(match[0])) hits.push([index + 1, kind]);
    }
    for (const match of line.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      let role = '';
      try { role = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')).role; } catch { /* não é JWT */ }
      if (role === 'service_role') hits.push([index + 1, 'chave service_role do Supabase']);
    }
    for (const match of line.matchAll(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])/g)) {
      const kind = LEAKED_SHA256.get(createHash('sha256').update(match[0]).digest('hex'));
      if (kind) hits.push([index + 1, kind]);
    }
  });
  return hits;
}

test('o detector reconhece os formatos de segredo e deixa passar valor falso e JWT anon', () => {
  const jwt = role => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'assinatura'].join('.');
  const realLooking = ['helena', 'mcp', 'sec', '0a1b2c3d4e5f6a7b'].join('_');
  assert.deepEqual(findSecretsInText(`const t = '${realLooking}';`), [[1, 'token do meowcaller/MCP']]);
  assert.deepEqual(findSecretsInText(`x\nconst k = '${jwt('service_role')}';`), [[2, 'chave service_role do Supabase']]);
  assert.deepEqual(findSecretsInText(`const anon = '${jwt('anon')}';`), []);
  assert.deepEqual(findSecretsInText(`const t = '${['helena', 'meow', 'sec', 'teste123'].join('_')}';`), []);
});

test('nenhum segredo vazado aparece em arquivo do repositório', (t) => {
  let listed;
  try {
    listed = execFileSync('git', ['-C', repoRoot, 'ls-files', '--cached', '--others', '--exclude-standard'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    t.skip('repositório git indisponível');
    return;
  }
  const found = [];
  for (const rel of listed.split('\n').filter(name => name && TEXT_FILE.test(name) && !name.includes('node_modules/'))) {
    const full = path.join(repoRoot, rel);
    let text;
    try {
      if (statSync(full).size > 3_000_000) continue;
      text = readFileSync(full, 'utf8');
    } catch { continue; }
    for (const [line, kind] of findSecretsInText(text)) found.push(`${rel}:${line} (${kind})`);
  }
  assert.deepEqual(found, [], `segredo no repositório (troque por variável de ambiente ou <SUA_CHAVE>): ${found.join('; ')}`);
});
