"""Testes offline de virada.sh e da guarda --producao do patcher.

Tudo em diretórios temporários: um repositório Git sintético faz o papel de
/usr/local/lib/hermes-agent, um systemctl/ps/curl simulados (em um diretório
PATH) fazem o papel da VPS, e um patcher sintético (só no modo de teste do
script) substitui os hashes do Hermes real. Quando a fonte fixada do Hermes
0.15.1 está disponível (HERMES_015_SOURCE com .git no commit fixado), um teste
extra roda o patcher REAL. Nenhum teste acessa rede, Telegram, VPS ou Supabase.
Os valores de token/segredo abaixo são sintéticos.
"""

from __future__ import annotations

import hashlib
import importlib.util
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import subprocess
import tempfile
import time
import unittest


HERE = Path(__file__).resolve().parent
VIRADA = HERE / "virada.sh"
PATCHER = HERE / "patch-hermes-telegram.py"
SOURCE = Path(os.environ.get("HERMES_015_SOURCE", "/tmp/helena-hermes-015-source"))

TOKEN = "123456789:AAFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE12"
SEGREDO = "a1b2c3d4e5f6" * 6  # 72 caracteres válidos
OUTRO_SEGREDO = "9f8e7d6c5b4a" * 5

STUB_PATCHER = '''
import os, pathlib, sys
a = sys.argv[1:]
tree = pathlib.Path(a[a.index("--tree") + 1])
M = "# HELENA-PATCH\\n"
files = [tree / "gateway/run.py", tree / "gateway/config.py"]
helper = tree / "gateway/platforms/helena_v2_inbox.py"
def patched():
    return all(f.read_text().endswith(M) for f in files) and helper.exists()
if "--check" in a:
    sys.exit(0 if patched() else 1)
if "--apply" in a:
    if not (str(tree.resolve()).startswith("/tmp") or "--producao" in a):
        sys.exit(1)
    if os.environ.get("STUB_FALHA") == "meio":
        files[0].write_text(files[0].read_text() + M)
        sys.exit(1)
    for f in files:
        if not f.read_text().endswith(M):
            f.write_text(f.read_text() + M)
    helper.parent.mkdir(parents=True, exist_ok=True)
    helper.write_text("# helper\\n")
    sys.exit(0)
sys.exit(2)
'''

SHIM_SYSTEMCTL = r'''#!/usr/bin/env bash
S="$SHIM_STATE"
printf 'systemctl %s\n' "$*" >> "$S/chamadas.log"
[ "${1:-}" = --user ] && shift
cmd="${1:-}"; shift
unit_dir="$SHIM_UNIT_DIR"
vivo() { [ -f "$S/gateway.pid" ] && [ -r "/proc/$(cat "$S/gateway.pid")/stat" ] && [ "$(awk '{print $3}' "/proc/$(cat "$S/gateway.pid")/stat")" != Z ]; }
case "$cmd" in
  show)
    unit="$1"; shift; prop=""
    while [ $# -gt 0 ]; do case "$1" in -p) prop="$2"; shift ;; esac; shift; done
    case "$unit" in hermes-gateway.service|outra.service) ;; *) [ "$prop" = LoadState ] && echo not-found; exit 0 ;; esac
    case "$prop" in
      LoadState) echo loaded ;;
      ActiveState) if vivo; then echo active; else echo inactive; fi ;;
      SubState) if vivo; then echo running; else echo dead; fi ;;
      UnitFileState) echo enabled ;;
      MainPID) if vivo; then cat "$S/gateway.pid"; else echo 0; fi ;;
      ExecStart) echo "{ path=${SHIM_EXEC:-$HERMES_DIR/venv/bin/python -m hermes_cli.main gateway run --replace} ; }" ;;
      FragmentPath) echo "$unit_dir/$unit" ;;
      DropInPaths) [ -f "$S/dropin_carregado" ] && echo "$unit_dir/$unit.d/helena-v2-telegram.conf" ;;
      Environment) cat "$S/environment" 2>/dev/null ;;
      EnvironmentFiles) [ -f "$S/dropin_carregado" ] && sed -n 's/^EnvironmentFile=\(.*\)$/\1 (ignore_errors=no)/p' "$S/dropin_carregado" ;;
    esac ;;
  daemon-reload)
    d="$unit_dir/hermes-gateway.service.d/helena-v2-telegram.conf"
    if [ -f "$d" ]; then cp "$d" "$S/dropin_carregado"; else rm -f "$S/dropin_carregado"; fi ;;
  start)
    vivo && exit 0
    vars=()
    [ -f "$S/environment" ] && for v in $(cat "$S/environment"); do vars+=("$v"); done
    if [ -f "$S/dropin_carregado" ]; then
      ef="$(sed -n 's/^EnvironmentFile=//p' "$S/dropin_carregado" | head -n1)"
      [ -f "$ef" ] && while IFS= read -r l; do [ -n "$l" ] && vars+=("$l"); done < "$ef"
    fi
    mkdir -p "$HERMES_HOME/logs"
    setsid env -i PATH="$PATH" "${vars[@]}" sleep 600 >/dev/null 2>&1 < /dev/null &
    echo $! > "$S/gateway.pid"
    modo=antigo; tok=0
    for v in "${vars[@]}"; do case "$v" in HELENA_V2_TELEGRAM_MODE=inbox-worker) modo=novo ;; TELEGRAM_BOT_TOKEN=*) tok=1 ;; esac; done
    grep -Eq '^[[:space:]]*TELEGRAM_BOT_TOKEN[[:space:]]*=' "$HERMES_HOME/.env" 2>/dev/null && tok=1
    if [ "$modo" = novo ] && [ "$tok" = 1 ]; then echo "WARNING gateway.run: ✗ telegram failed to connect" >> "$HERMES_HOME/logs/gateway.log"
    else echo "INFO gateway.run: ✓ telegram connected" >> "$HERMES_HOME/logs/gateway.log"; fi ;;
  stop)
    if [ -f "$S/gateway.pid" ]; then kill "$(cat "$S/gateway.pid")" 2>/dev/null; rm -f "$S/gateway.pid"; fi ;;
  *) echo "systemctl simulado: comando nao previsto: $cmd" >&2; exit 1 ;;
esac
exit 0
'''

SHIM_PS = r'''#!/usr/bin/env bash
S="$SHIM_STATE"
for f in gateway.pid stray.pid; do
  if [ -f "$S/$f" ] && [ -r "/proc/$(cat "$S/$f")/stat" ] && [ "$(awk '{print $3}' "/proc/$(cat "$S/$f")/stat")" != Z ]; then
    printf '%s root 00:07 %s/venv/bin/python -m hermes_cli.main gateway run --replace\n' "$(cat "$S/$f")" "$HERMES_DIR"
  fi
done
printf '999999 helena 01:00 /opt/helena-v2/venv-hermes/bin/python -m hermes_cli.main gateway\n'
exit 0
'''

SHIM_CURL = r'''#!/usr/bin/env bash
S="$SHIM_STATE"
printf 'curl %s\n' "$*" >> "$S/chamadas.log"
cat > "$S/curl-stdin.txt"
out="$(sed -n 's/^output = "\(.*\)"$/\1/p' "$S/curl-stdin.txt")"
printf '%s' "${CURL_CORPO:-{\"ok\":true,\"job\":null\}}" > "$out"
printf '%s' "${CURL_CODIGO:-200}"
'''


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(root: Path, skip=(".git", "venv", "logs")) -> dict[str, str]:
    out = {}
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if any(part in skip for part in rel.parts) or not path.is_file():
            continue
        out[str(rel)] = sha(path)
    return out


class Ambiente:
    """Instalação sintética + VPS simulada em diretórios temporários."""

    def __init__(self, real_source: bool = False):
        self.tmp = Path(tempfile.mkdtemp(prefix="helena-virada-test-", dir="/tmp"))
        self.hermes_dir = self.tmp / "hermes-agent"
        self.home = self.tmp / "hermes-home"
        self.etc = self.tmp / "etc-helena-v2"
        self.backups = self.tmp / "backups"
        self.user_units = self.tmp / "units-user"
        self.system_units = self.tmp / "units-system"
        self.state = self.tmp / "shim-state"
        self.bin = self.tmp / "bin"
        for d in (self.backups, self.user_units, self.system_units, self.state, self.bin, self.home):
            d.mkdir(parents=True, exist_ok=True)
        self.real_source = real_source
        self._git_home = self.tmp / "githome"
        self._git_home.mkdir()
        if real_source:
            self._git("clone", "--quiet", "--local", "--no-hardlinks", str(SOURCE), str(self.hermes_dir), cwd=self.tmp)
        else:
            self._criar_repo_sintetico()
        (self.hermes_dir / "venv/bin").mkdir(parents=True, exist_ok=True)
        py = self.hermes_dir / "venv/bin/python"
        py.write_text("#!/bin/sh\necho 0.15.1\n")
        py.chmod(0o755)
        self.head = self._git("rev-parse", "HEAD", cwd=self.hermes_dir).strip()
        (self.home / ".env").write_text(
            f"TELEGRAM_BOT_TOKEN={TOKEN}\nTELEGRAM_ALLOWED_USERS=123456\nTELEGRAM_REACTIONS=true\n")
        (self.home / ".env").chmod(0o600)
        (self.home / "config.yaml").write_text("model:\n  default: gpt-6.1-sol\n")
        (self.home / "auth.json").write_text('{"synthetic": "auth-sentinel-xyz"}\n')
        (self.home / "auth.json").chmod(0o600)
        (self.home / "sessions").mkdir()
        (self.home / "sessions/s1.json").write_text('{"conversa": "sintetica"}\n')
        (self.user_units / "hermes-gateway.service").write_text("[Unit]\nDescription=Hermes Gateway\n")
        for nome, corpo in (("systemctl", SHIM_SYSTEMCTL), ("ps", SHIM_PS), ("curl", SHIM_CURL)):
            f = self.bin / nome
            f.write_text(corpo)
            f.chmod(0o755)
        stub = self.tmp / "stub-patcher.py"
        stub.write_text(STUB_PATCHER)
        self.stub_patcher = stub

    def _git(self, *args, cwd):
        env = {**os.environ, "HOME": str(self._git_home), "GIT_CONFIG_NOSYSTEM": "1"}
        for k in ("GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"):
            env.pop(k, None)
        r = subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True, check=True)
        return r.stdout

    def _criar_repo_sintetico(self):
        d = self.hermes_dir
        (d / "gateway/platforms").mkdir(parents=True)
        (d / "gateway/run.py").write_text("# run original\n")
        (d / "gateway/config.py").write_text("# config original\n")
        (d / "gateway/platforms/__init__.py").write_text("")
        self._git("init", "--quiet", cwd=d)
        self._git("config", "user.name", "Teste", cwd=d)
        self._git("config", "user.email", "teste@example.invalid", cwd=d)
        self._git("add", "-A", cwd=d)
        self._git("commit", "--quiet", "-m", "sintetico", cwd=d)

    def env(self, extra=None):
        env = {
            "PATH": f"{self.bin}:/usr/local/bin:/usr/bin:/bin",
            "HOME": str(self._git_home),
            "LANG": "C",
            "HELENA_VIRADA_TESTE": "1",
            "HERMES_DIR": str(self.hermes_dir),
            "HERMES_HOME": str(self.home),
            "HELENA_ETC_DIR": str(self.etc),
            "HELENA_BACKUP_BASE": str(self.backups),
            "HELENA_USER_UNIT_DIR": str(self.user_units),
            "HELENA_SYSTEM_UNIT_DIR": str(self.system_units),
            "HELENA_VIRADA_ENSAIO_TESTES": "0",
            "HELENA_VIRADA_ESPERA_S": "3",
            "SHIM_STATE": str(self.state),
            "SHIM_UNIT_DIR": str(self.user_units),
        }
        if not self.real_source:
            env["HELENA_VIRADA_PATCHER"] = str(self.stub_patcher)
            env["HELENA_VIRADA_PIN"] = self.head
        if extra:
            env.update(extra)
        return env

    def run(self, *args, input=None, extra=None, timeout=180):
        env = self.env(extra)
        return subprocess.run(["bash", str(VIRADA), *args], input=input, env=env, capture_output=True,
                              text=True, timeout=timeout, cwd=self.tmp)

    def systemctl(self, *args):
        return subprocess.run(["systemctl", *args], env=self.env(), capture_output=True, text=True)

    def iniciar_servico_antigo(self):
        self.systemctl("--user", "start", "hermes-gateway.service")

    def pid_servico(self):
        f = self.state / "gateway.pid"
        return int(f.read_text()) if f.exists() else None

    def limpar(self):
        for nome in ("gateway.pid", "stray.pid"):
            f = self.state / nome
            if f.exists():
                try:
                    os.kill(int(f.read_text()), signal.SIGKILL)
                except (ProcessLookupError, ValueError):
                    pass
        shutil.rmtree(self.tmp, ignore_errors=True)

    def chamadas(self) -> str:
        f = self.state / "chamadas.log"
        return f.read_text() if f.exists() else ""


class Base(unittest.TestCase):
    real = False

    def setUp(self):
        self.a = Ambiente(real_source=self.real)
        self.addCleanup(self.a.limpar)

    def saida(self, r):
        return r.stdout + r.stderr

    def sem_vazamento(self, *resultados):
        for r in resultados:
            texto = self.saida(r)
            for segredo in (TOKEN, SEGREDO, OUTRO_SEGREDO, "auth-sentinel-xyz", TOKEN.split(":")[1]):
                self.assertNotIn(segredo, texto)

    def backup(self):
        r = self.a.run("backup")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.sem_vazamento(r)
        return sorted(self.a.backups.glob("backup-hermes-015-*"))[-1]

    def instalar(self, segredo=SEGREDO, *args):
        return self.a.run("instalar", "--producao", *args, input=segredo + "\n")


class SintaxeEConstantes(unittest.TestCase):
    def test_bash_n(self):
        r = subprocess.run(["bash", "-n", str(VIRADA)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_pin_do_script_igual_ao_do_patcher(self):
        spec = importlib.util.spec_from_file_location("patcher_virada_test", PATCHER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        linha = next(l for l in VIRADA.read_text().splitlines() if l.startswith("PIN_COMMIT="))
        self.assertEqual(linha, f'PIN_COMMIT="{module.PINNED_COMMIT}"')

    def test_ajuda_e_etapa_desconhecida(self):
        r = subprocess.run(["bash", str(VIRADA), "ajuda"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        for etapa in ("inventario", "backup", "ensaiar", "instalar", "parar-poller", "iniciar", "estado", "reverter"):
            self.assertIn(etapa, r.stdout)
        r = subprocess.run(["bash", str(VIRADA), "apagar-tudo"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)

    def test_modo_de_teste_recusa_caminhos_reais(self):
        r = subprocess.run(["bash", str(VIRADA), "inventario"], capture_output=True, text=True, env={
            "PATH": os.environ["PATH"], "HELENA_VIRADA_TESTE": "1", "HELENA_ETC_DIR": "/tmp/x",
            "HELENA_BACKUP_BASE": "/tmp/x", "HELENA_USER_UNIT_DIR": "/tmp/x", "HELENA_SYSTEM_UNIT_DIR": "/tmp/x"})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("recusa caminhos reais", r.stderr)

    def test_sem_root_fora_do_modo_de_teste(self):
        if os.geteuid() == 0:
            self.skipTest("rodando como root")
        r = subprocess.run(["bash", str(VIRADA), "inventario"], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("root", r.stderr)

    def test_script_nao_chama_o_telegram_e_so_usa_curl_no_teste_da_edge(self):
        texto = VIRADA.read_text()
        codigo = [l for l in texto.splitlines() if not l.lstrip().startswith("#")]
        corpo = "\n".join(codigo)
        self.assertNotIn("api.telegram.org", corpo)
        self.assertNotRegex(corpo, r"/bot\$|bot%s|getUpdates|sendMessage")
        inicio, fim = corpo.index("cmd_estado() {"), corpo.index("cmd_reverter() {")
        fora = corpo[:inicio] + corpo[fim:]
        self.assertNotRegex(fora, r"\bcurl\b")
        self.assertIn("curl -K -", corpo[inicio:fim])  # configuração (com o segredo) por stdin, nunca argumento


class RoteiroDoFundador(unittest.TestCase):
    DOC = HERE.parents[2] / "docs/manual/virada-telegram-passo-a-passo.md"

    def test_hashes_do_roteiro_conferem_com_os_arquivos(self):
        texto = self.DOC.read_text()
        bloco = texto.split("sha256sum -c <<'EOF'\n", 1)[1].split("\nEOF", 1)[0]
        esperados = dict(l.split("  ", 1)[::-1] for l in bloco.splitlines())
        self.assertEqual(sorted(esperados), sorted(
            ["virada.sh", "patch-hermes-telegram.py", "helena_v2_inbox.py", "test_telegram_v2.py"]))
        for nome, h in esperados.items():
            self.assertEqual(sha(HERE / nome), h, f"{nome}: atualize o passo 4 de {self.DOC.name}")

    def test_roteiro_tem_os_cabecalhos_e_nenhum_segredo(self):
        texto = self.DOC.read_text()
        self.assertIn("\nO que é:", texto)
        self.assertIn("\nComo mudar:", texto)
        for proibido in (TOKEN, SEGREDO, "AAFAKE"):
            self.assertNotIn(proibido, texto)
        # todo token/segredo entra por read -rs ou stdin; nenhum comando leva o token como argumento
        self.assertNotRegex(texto, r"bot[0-9]{6,}:")
        self.assertNotRegex(texto, r"curl[^\n]*api\.telegram\.org/bot[^%\"]")

    def test_cada_bloco_de_comando_comeca_com_clear(self):
        blocos = self.DOC.read_text().split("```")[1::2]
        comandos = [b for b in blocos if any(x in b for x in ("curl", "virada.sh", "supabase", "shred", "systemctl"))]
        self.assertGreaterEqual(len(comandos), 15)
        for bloco in comandos:
            self.assertTrue(bloco.lstrip().startswith("clear &&"), bloco.strip().splitlines()[0][:70])
            self.assertEqual(len([l for l in bloco.strip().splitlines() if l.strip() and l.strip() != "EOF"
                                  and not l.startswith("@") and "  " not in l[:1]]) >= 1, True)


class PatcherProducao(unittest.TestCase):
    def rodar(self, *args):
        return subprocess.run(["python3", str(PATCHER), *args], capture_output=True, text=True)

    def test_recusa_por_padrao_fora_de_tmp_e_workspace(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent) as d:
            r = self.rodar("--tree", d, "--apply")
            self.assertEqual(r.returncode, 1)
            self.assertIn("--producao", r.stderr)

    def test_producao_so_com_apply(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent) as d:
            r = self.rodar("--tree", d, "--check", "--producao")
            self.assertEqual(r.returncode, 2)

    def test_producao_continua_exigindo_git_e_hashes(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent) as d:
            r = self.rodar("--tree", d, "--apply", "--producao")
            self.assertEqual(r.returncode, 1)
            self.assertIn("verification failed", r.stderr)
            Path(d, ".git").mkdir()
            r = self.rodar("--tree", d, "--apply", "--producao")
            self.assertEqual(r.returncode, 1)
            self.assertIn("verification failed", r.stderr)
            self.assertEqual(list(Path(d).glob("gateway")), [])


class Inventario(Base):
    def test_somente_leitura_e_sem_valores(self):
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.a.run("inventario")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.sem_vazamento(r)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        out = r.stdout
        self.assertIn("versão do pacote: 0.15.1", out)
        self.assertIn(self.a.head, out)
        self.assertIn("TELEGRAM_BOT_TOKEN no .env: PRESENTE", out)
        self.assertIn("TELEGRAM_ALLOWED_USERS", out)  # só o nome da variável
        self.assertIn("unidade: hermes-gateway.service (escopo user)", out)
        self.assertEqual(list(self.a.backups.iterdir()), [])
        self.assertNotIn("stop", self.a.chamadas())

    def test_detecta_token_na_configuracao_sem_imprimir(self):
        (self.a.home / "config.yaml").write_text(f"telegram:\n  token: {TOKEN}\n")
        r = self.a.run("inventario")
        self.assertEqual(r.returncode, 0)
        self.assertIn("config.yaml:linha 2", r.stdout)
        self.sem_vazamento(r)


class Backup(Base):
    def test_backup_confere_e_protege(self):
        bk = self.backup()
        self.assertEqual(oct(bk.stat().st_mode & 0o777), "0o700")
        for f in bk.rglob("*"):
            if f.is_file():
                self.assertEqual(oct(f.stat().st_mode & 0o777), "0o600", f)
        for nome in ("codigo-hermes-agent.tar.gz", "hermes-home.tar.gz", "MANIFESTO.env", "MANIFESTO.sha256"):
            self.assertTrue((bk / nome).exists(), nome)
        manifesto = (bk / "MANIFESTO.env").read_text()
        self.assertIn(f"commit={self.a.head}", manifesto)
        self.assertIn("patch_aplicado=nao", manifesto)
        self.assertIn(f"home_env_sha={sha(self.a.home / '.env')}", manifesto)
        listagem = subprocess.run(["tar", "-tzf", str(bk / "hermes-home.tar.gz")], capture_output=True, text=True).stdout
        self.assertIn("./.env", listagem)
        self.assertIn("./auth.json", listagem)
        codigo = subprocess.run(["tar", "-tzf", str(bk / "codigo-hermes-agent.tar.gz")], capture_output=True, text=True).stdout
        self.assertIn("./gateway/run.py", codigo)
        self.assertNotIn("./venv/", codigo)

    def test_backup_nao_altera_nada(self):
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        self.backup()
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        self.assertNotIn("stop", self.a.chamadas())

    def test_backup_adulterado_e_recusado_pelo_instalar(self):
        bk = self.backup()
        with open(bk / "hermes-home.tar.gz", "ab") as f:
            f.write(b"lixo")
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.instalar()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("reprovado", r.stderr)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        self.assertFalse(self.a.etc.exists())


class Instalar(Base):
    def test_exige_producao_e_backup(self):
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.a.run("instalar", input=SEGREDO + "\n")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("--producao", r.stderr)
        r = self.instalar()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("backup", r.stderr)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        self.assertFalse(self.a.etc.exists())

    def test_segredo_nunca_por_argumento(self):
        self.backup()
        r = self.a.run("instalar", "--producao", SEGREDO)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("opção desconhecida", r.stderr)
        r = self.a.run("instalar", "--producao", "--segredo=" + OUTRO_SEGREDO)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(OUTRO_SEGREDO, r.stdout)  # nem ecoado no stdout
        self.assertFalse(self.a.etc.exists())

    def test_segredo_invalido_nao_altera_nada(self):
        self.backup()
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        for ruim in ("curto", "tem espaco " + "a" * 40, "", "x" * 300, "aspas'" + "a" * 40):
            r = self.instalar(ruim)
            self.assertNotEqual(r.returncode, 0, ruim)
            self.assertIn("formato inválido", r.stderr + r.stdout if ruim else r.stderr)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        self.assertFalse(self.a.etc.exists())

    def test_instalacao_completa(self):
        self.a.iniciar_servico_antigo()
        bk = self.backup()
        original_env = (self.a.home / ".env").read_text().splitlines()
        r = self.instalar()
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.sem_vazamento(r)
        # patch aplicado na instalação
        self.assertTrue((self.a.hermes_dir / "gateway/run.py").read_text().endswith("# HELENA-PATCH\n"))
        self.assertTrue((self.a.hermes_dir / "gateway/platforms/helena_v2_inbox.py").exists())
        # token desativado, restante do .env intacto
        novo = (self.a.home / ".env").read_text().splitlines()
        self.assertEqual(len(novo), len(original_env))
        self.assertTrue(novo[0].startswith("# TELEGRAM_BOT_TOKEN desativado pela virada Helena v2"))
        self.assertEqual(novo[1:], original_env[1:])
        self.assertNotIn(TOKEN, (self.a.home / ".env").read_text())
        self.assertEqual(oct((self.a.home / ".env").stat().st_mode & 0o777), "0o600")
        # valor original só no backup
        self.assertIn(TOKEN, (bk / "arquivos-originais/home.env").read_text())
        # ambiente do worker
        env_worker = self.a.etc / "telegram-worker.env"
        self.assertEqual(oct(env_worker.stat().st_mode & 0o777), "0o600")
        linhas = env_worker.read_text().splitlines()
        self.assertEqual(linhas, [
            "HELENA_V2_TELEGRAM_MODE=inbox-worker",
            "HELENA_V2_TELEGRAM_BROKER_URL=https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram",
            f"HELENA_V2_TELEGRAM_WORKER_SECRET={SEGREDO}"])
        self.assertNotIn("TELEGRAM_BOT_TOKEN", env_worker.read_text())
        # drop-in carregado
        dropin = self.a.user_units / "hermes-gateway.service.d/helena-v2-telegram.conf"
        self.assertEqual(dropin.read_text(), f"[Service]\nEnvironmentFile={env_worker}\n")
        self.assertIn("daemon-reload", self.a.chamadas())
        # o serviço NÃO foi reiniciado pelo instalar
        self.assertNotIn(" stop", self.a.chamadas())
        self.assertIsNotNone(self.a.pid_servico())
        # descreve o destino do token
        self.assertIn("O que acontece com o token no .env", r.stdout)
        # segredo nunca em argv de nenhum comando simulado
        self.assertNotIn(SEGREDO, self.a.chamadas())
        self.assertNotIn(TOKEN, self.a.chamadas())

    def test_instalar_e_repetivel(self):
        self.backup()
        self.assertEqual(self.instalar().returncode, 0)
        env1 = snapshot(self.a.home), snapshot(self.a.hermes_dir), (self.a.etc / "telegram-worker.env").read_text()
        r = self.a.run("instalar", "--producao", "--manter-segredo")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("patch já aplicado", r.stdout)
        env2 = snapshot(self.a.home), snapshot(self.a.hermes_dir), (self.a.etc / "telegram-worker.env").read_text()
        self.assertEqual(env1, env2)
        self.sem_vazamento(r)

    def test_commit_diferente_do_fixado_recusa_sem_alterar(self):
        self.backup()
        (self.a.hermes_dir / "novo.txt").write_text("x")
        self.a._git("add", "-A", cwd=self.a.hermes_dir)
        self.a._git("commit", "--quiet", "-m", "outro", cwd=self.a.hermes_dir)
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.instalar()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("fixado", r.stderr)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        self.assertFalse(self.a.etc.exists())

    def test_arquivo_do_hermes_alterado_depois_do_backup_recusa(self):
        self.backup()
        (self.a.hermes_dir / "gateway/run.py").write_text("# editado na mao\n")
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.instalar()
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))

    def test_token_na_configuracao_recusa_e_aceitar_libera(self):
        (self.a.home / "config.yaml").write_text(f"telegram:\n  token: {TOKEN}\n")
        self.backup()
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.instalar()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("token preenchida", r.stderr)
        self.sem_vazamento(r)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        r = self.instalar(SEGREDO, "--aceitar-token-config")
        self.assertEqual(r.returncode, 0, self.saida(r))

    def test_token_no_ambiente_da_unidade_recusa(self):
        (self.a.state / "environment").write_text(f"TELEGRAM_BOT_TOKEN={TOKEN} OUTRA=1\n")
        self.backup()
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.instalar()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("Environment=", r.stderr)
        self.sem_vazamento(r)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))

    def test_falha_no_meio_do_patch_desfaz_tudo(self):
        self.backup()
        antes = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        r = self.a.run("instalar", "--producao", input=SEGREDO + "\n", extra={"STUB_FALHA": "meio"})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("desfazendo", r.stdout + r.stderr)
        self.assertEqual(antes, (snapshot(self.a.hermes_dir), snapshot(self.a.home)))
        self.assertFalse((self.a.etc / "telegram-worker.env").exists())

    def test_segredo_lido_de_terminal_oculto(self):
        self.backup()
        mestre, escravo = pty.openpty()
        env = self.a.env()
        proc = subprocess.Popen(["bash", str(VIRADA), "instalar", "--producao"], stdin=escravo, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, env=env, cwd=self.a.tmp, close_fds=True)
        os.close(escravo)
        eco = b""

        def drenar(t):
            nonlocal eco
            fim = time.time() + t
            while time.time() < fim:
                r, _, _ = select.select([mestre], [], [], 0.05)
                if r:
                    try:
                        eco += os.read(mestre, 4096)
                    except OSError:
                        return

        drenar(1.5)
        os.write(mestre, (SEGREDO + "\n").encode())
        drenar(0.5)
        os.write(mestre, (SEGREDO + "\n").encode())
        out, err = proc.communicate(timeout=120)
        drenar(0.2)
        os.close(mestre)
        self.assertEqual(proc.returncode, 0, (out + err).decode())
        self.assertNotIn(SEGREDO.encode(), eco, "o terminal repetiu o segredo digitado")
        self.assertNotIn(SEGREDO.encode(), out + err)
        self.assertIn(SEGREDO, (self.a.etc / "telegram-worker.env").read_text())

    def test_digitacao_diferente_nas_duas_vezes_nao_grava(self):
        self.backup()
        mestre, escravo = pty.openpty()
        env = self.a.env()
        proc = subprocess.Popen(["bash", str(VIRADA), "instalar", "--producao"], stdin=escravo, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, env=env, cwd=self.a.tmp)
        os.close(escravo)
        time.sleep(1.5)
        os.write(mestre, (SEGREDO + "\n").encode())
        time.sleep(0.5)
        os.write(mestre, (OUTRO_SEGREDO + "\n").encode())
        out, err = proc.communicate(timeout=60)
        os.close(mestre)
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse(self.a.etc.exists())
        self.assertNotIn(SEGREDO.encode(), out + err)


class PararIniciarEstadoReverter(Base):
    def instalado(self):
        self.a.iniciar_servico_antigo()
        self.bk = self.backup()
        r = self.instalar()
        self.assertEqual(r.returncode, 0, self.saida(r))

    def test_ciclo_completo_com_reversao(self):
        originais = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        self.instalado()

        # parar-poller: só a unidade do Hermes, sem processo sobrando
        self.assertIsNotNone(self.a.pid_servico())
        r = self.a.run("parar-poller")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIsNone(self.a.pid_servico())
        self.assertIn("nenhum processo do gateway 0.15.1 sobrou", r.stdout)
        paradas = [l for l in self.a.chamadas().splitlines() if " stop" in l]
        self.assertEqual(len(paradas), 1)
        self.assertIn("hermes-gateway.service", paradas[0])
        self.assertNotIn("helena-", self.a.chamadas())

        # iniciar: modo novo, sem token no processo, log confirma
        r = self.a.run("iniciar")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("TELEGRAM_BOT_TOKEN no ambiente=0", r.stdout)
        self.assertIn("modo inbox-worker=1", r.stdout)
        self.assertIn("telegram connected", r.stdout)
        pid = self.a.pid_servico()
        ambiente = Path(f"/proc/{pid}/environ").read_bytes().split(b"\0")
        self.assertIn(b"HELENA_V2_TELEGRAM_MODE=inbox-worker", ambiente)
        self.assertFalse([v for v in ambiente if v.startswith(b"TELEGRAM_BOT_TOKEN")])
        self.sem_vazamento(r)

        # estado
        r = self.a.run("estado")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("patch Helena v2: APLICADO", r.stdout)
        self.assertIn("TELEGRAM_BOT_TOKEN: ausente", r.stdout)
        self.assertIn("modo inbox-worker=1", r.stdout)
        self.assertNotIn(SEGREDO, self.saida(r))

        # estado --testar-edge: segredo por stdin do curl, nunca por argumento
        r = self.a.run("estado", "--testar-edge")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("HTTP 200", r.stdout)
        curl = [l for l in self.a.chamadas().splitlines() if l.startswith("curl ")]
        self.assertEqual(curl, ["curl -K -"])
        self.assertIn(SEGREDO, (self.a.state / "curl-stdin.txt").read_text())
        self.assertNotIn(SEGREDO, self.a.chamadas())
        self.sem_vazamento(r)
        r = self.a.run("estado", "--testar-edge", extra={"CURL_CODIGO": "401"})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("401", r.stderr)

        # reverter sem confirmar o webhook: restaura e NÃO religa
        r = self.a.run("reverter")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("NÃO religo o poller antigo", r.stdout)
        self.assertIsNone(self.a.pid_servico())
        self.assertIn("getWebhookInfo", r.stdout)
        self.sem_vazamento(r)
        depois = (snapshot(self.a.hermes_dir), snapshot(self.a.home))
        self.assertEqual(originais[0], depois[0])
        self.assertEqual(originais[1], depois[1])
        self.assertFalse((self.a.user_units / "hermes-gateway.service.d/helena-v2-telegram.conf").exists())
        self.assertTrue((self.a.etc / "telegram-worker.env").exists())

        # reverter com a confirmação: religa o poller antigo
        r = self.a.run("reverter", "--confirmo-webhook-removido")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIsNotNone(self.a.pid_servico())
        self.assertIn("poller antigo religado", r.stdout)
        self.assertEqual(originais[1], snapshot(self.a.home))

    def test_iniciar_recusa_com_poller_vivo_ou_sem_instalar(self):
        self.a.iniciar_servico_antigo()
        self.backup()
        r = self.a.run("iniciar")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("parar-poller", r.stderr)
        self.a.run("parar-poller")
        r = self.a.run("iniciar")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("patch", r.stderr)
        self.assertIsNone(self.a.pid_servico())

    def test_iniciar_detecta_adapter_que_falha_fechado(self):
        self.instalado()
        self.a.run("parar-poller")
        # token reintroduzido no .env depois da instalação: o iniciar recusa antes de subir
        with open(self.a.home / ".env", "a") as f:
            f.write(f"TELEGRAM_BOT_TOKEN={TOKEN}\n")
        r = self.a.run("iniciar")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("TELEGRAM_BOT_TOKEN", r.stderr)
        self.sem_vazamento(r)
        self.assertIsNone(self.a.pid_servico())

    def test_processo_sobrando_e_detectado_e_forcar_resolve(self):
        self.a.iniciar_servico_antigo()
        stray = subprocess.Popen(["sleep", "600"], start_new_session=True)
        self.addCleanup(lambda: (stray.kill(), stray.wait()))
        (self.a.state / "stray.pid").write_text(str(stray.pid))
        r = self.a.run("parar-poller")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("sobraram processos", r.stdout)
        self.assertIn("NÃO registre o webhook", r.stderr)
        r = self.a.run("parar-poller", "--forcar")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIsNone(self.a.pid_servico())
        stray.wait(timeout=10)

    def test_unidade_do_motor_v2_e_recusada(self):
        for nome in ("helena-despachante.service", "helena-vigia.service", "meu-despachante.service"):
            r = self.a.run("parar-poller", extra={"HERMES_UNIT": nome})
            self.assertNotEqual(r.returncode, 0, nome)
            self.assertIn("motor v2", r.stderr)
        self.assertNotIn(" stop", self.a.chamadas())

    def test_unidade_que_nao_e_do_venv_do_hermes_e_recusada(self):
        r = self.a.run("parar-poller", extra={"HERMES_UNIT": "outra.service", "SHIM_EXEC": "/opt/helena-v2/venv-hermes/bin/hermes -z"})
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(" stop", self.a.chamadas())

    def test_reverter_recusa_backup_invalido_ou_sem_backup(self):
        r = self.a.run("reverter")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("nenhum backup", r.stderr)
        bk = self.backup()
        (bk / "MANIFESTO.env").write_text((bk / "MANIFESTO.env").read_text() + "x=1\n")
        r = self.a.run("reverter")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("reprovado", r.stderr)

    def test_reverter_home_completo_preserva_a_versao_pos_virada(self):
        self.instalado()
        self.a.run("parar-poller")
        (self.a.home / "sessions/s2.json").write_text('{"nova": 1}\n')
        r = self.a.run("reverter", "--home-completo")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertFalse((self.a.home / "sessions/s2.json").exists())
        aside = list(self.a.tmp.glob("hermes-home.pos-virada-*"))
        self.assertEqual(len(aside), 1)
        self.assertTrue((aside[0] / "sessions/s2.json").exists())
        self.assertIn(TOKEN, (self.a.home / ".env").read_text())

    def test_nenhum_acesso_ao_telegram_no_fluxo_inteiro(self):
        self.instalado()
        for passo in (("inventario",), ("parar-poller",), ("iniciar",), ("estado",), ("reverter", "--confirmo-webhook-removido")):
            self.a.run(*passo)
        chamadas = self.a.chamadas()
        self.assertNotIn("telegram", chamadas.lower())
        self.assertNotIn("curl", chamadas)


@unittest.skipUnless((SOURCE / ".git").exists() and (SOURCE / "gateway/run.py").exists(),
                     "fonte Git fixada do Hermes 0.15.1 indisponível (HERMES_015_SOURCE)")
class PatcherReal(Base):
    """Mesmo fluxo, mas com o patcher e os hashes REAIS sobre o checkout fixado do Hermes."""

    real = True

    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("patcher_real_test", PATCHER)
        cls.patcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.patcher)
        head = subprocess.run(["git", "-C", str(SOURCE), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        if head != cls.patcher.PINNED_COMMIT:
            raise unittest.SkipTest("HERMES_015_SOURCE não está no commit fixado")

    def test_instalar_e_reverter_com_hashes_reais(self):
        self.a.iniciar_servico_antigo()
        original = snapshot(self.a.hermes_dir)
        self.backup()
        r = self.instalar()
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.sem_vazamento(r)
        check = subprocess.run(["python3", str(PATCHER), "--tree", str(self.a.hermes_dir), "--check"], capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stderr)
        for relativo, esperado in self.patcher.PATCHED_HASHES.items():
            self.assertEqual(sha(self.a.hermes_dir / relativo), esperado, relativo)
        r = self.a.run("estado")
        self.assertIn("patch Helena v2: APLICADO", r.stdout)
        r = self.a.run("parar-poller")
        self.assertEqual(r.returncode, 0, self.saida(r))
        r = self.a.run("reverter")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertEqual(original, snapshot(self.a.hermes_dir))
        self.assertEqual(self._git("status", "--porcelain", "--untracked-files=no", cwd=self.a.hermes_dir), "")

    def _git(self, *args, cwd):
        return self.a._git(*args, cwd=cwd)

    @unittest.skipUnless(os.environ.get("HELENA_TEST_HERMES_PY"),
                         "defina HELENA_TEST_HERMES_PY com o Python de um venv com as dependências do Hermes 0.15.1")
    def test_ensaiar_roda_os_testes_do_adapter_com_o_python_do_hermes(self):
        py = self.a.hermes_dir / "venv/bin/python"
        py.write_text(f'#!/bin/sh\nexec "{os.environ["HELENA_TEST_HERMES_PY"]}" "$@"\n')
        r = self.a.run("ensaiar", extra={"HELENA_VIRADA_ENSAIO_TESTES": "1"}, timeout=600)
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("testes do adapter passaram", r.stdout)
        self.assertIn("ENSAIO OK", r.stdout)

    def test_ensaiar_com_a_copia_limpa(self):
        r = self.a.run("ensaiar")
        self.assertEqual(r.returncode, 0, self.saida(r))
        self.assertIn("ENSAIO OK", r.stdout)
        self.assertIn("idempotente", r.stdout)
        self.assertEqual(snapshot(self.a.hermes_dir), snapshot(self.a.hermes_dir))
        self.assertEqual(self._git("status", "--porcelain", "--untracked-files=no", cwd=self.a.hermes_dir), "")
        self.assertEqual(list(Path("/tmp").glob("helena-ensaio.*")), [])

    def test_patcher_real_recusa_producao_sem_flag_fora_de_tmp(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent) as d:
            r = subprocess.run(["git", "clone", "--quiet", "--local", str(SOURCE), d + "/h"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            antes = snapshot(Path(d) / "h")
            r = subprocess.run(["python3", str(PATCHER), "--tree", d + "/h", "--apply"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 1)
            self.assertEqual(antes, snapshot(Path(d) / "h"))
            r = subprocess.run(["python3", str(PATCHER), "--tree", d + "/h", "--apply", "--producao"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            r = subprocess.run(["python3", str(PATCHER), "--tree", d + "/h", "--check"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
