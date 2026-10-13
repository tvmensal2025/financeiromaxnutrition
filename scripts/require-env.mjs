// Segredo de script vem só do ambiente (terminal ou .env fora do Git), nunca com valor no código.
// Sem a variável, o script para com uma mensagem clara que diz só o NOME da variável.
export function requireEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Defina a variável de ambiente ${name} antes de rodar este script (nenhum segredo fica no código).`);
  }
  return value;
}
