// Segredo de script vem só do ambiente, nunca com valor no código: defina a variável no terminal antes de rodar
// ou use `node --env-file=.env <script>` (o Node não carrega .env sozinho; mantenha o arquivo .env fora do Git).
// Sem a variável, o script para com uma mensagem clara que diz só o NOME da variável.
export function requireEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Defina a variável de ambiente ${name} antes de rodar este script (nenhum segredo fica no código).`);
  }
  return value;
}
