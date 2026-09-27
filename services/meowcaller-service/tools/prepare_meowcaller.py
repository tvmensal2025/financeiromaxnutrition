"""Apply the pinned upstream relay fix to an isolated dependency copy."""
import json, pathlib, shutil, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[1]
module = "github.com/purpshell/meowcaller"
version = "v0.0.0-20260906234207-c48c3e2a243c"
patch = root / "patches/meowcaller-relay-fanout.patch"
subprocess.run(["go", "mod", "edit", "-dropreplace="+module], cwd=root, check=True)
info = json.loads(subprocess.check_output(["go", "mod", "download", "-json", module+"@"+version], cwd=root))
if info.get("Error"): raise RuntimeError(info["Error"])
target = pathlib.Path(tempfile.mkdtemp(prefix=".meowcaller-patched-", dir=root))
shutil.copytree(info["Dir"], target, dirs_exist_ok=True)
for item in target.rglob("*"):
    if item.is_file(): item.chmod(0o644)
subprocess.run(["git", "init", "-q", str(target)], check=True)
# Exclude upstream release notes: only runtime source is patched.
subprocess.run(["git", "apply", "--check", "--exclude=CHANGELOG.md", str(patch)], cwd=target, check=True)
subprocess.run(["git", "apply", "--exclude=CHANGELOG.md", str(patch)], cwd=target, check=True)
if not (target / "engine_relay_fanout.go").is_file():
    raise RuntimeError("Relay patch was not applied")
shutil.copyfile(root / "patches/relay_regression_test.go.txt", target / "relay_regression_test.go")
subprocess.run(["go", "mod", "edit", "-replace="+module+"=./"+target.name], cwd=root, check=True)
print("Prepared Meowcaller relay fix 340c889 on "+version)
