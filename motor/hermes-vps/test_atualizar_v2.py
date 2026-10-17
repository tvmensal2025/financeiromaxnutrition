"""Exercita o dry run real com bundles Git sintéticos; sem rede ou serviços."""

from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("atualizar-v2.sh")


class AtualizarV2Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="helena-release-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "current"
        self.repo.mkdir()
        self.staging = self.root / "staging"
        self.staging.mkdir(mode=0o700)
        self.git("init", "--quiet")
        self.git("config", "user.name", "Teste local")
        self.git("config", "user.email", "teste@example.invalid")
        self.migrations = self.repo / "supabase/migrations-v2"
        self.migrations.mkdir(parents=True)
        for name in (
            "motor/orquestrador/requirements.txt",
            "motor/executor/requirements-hermes-real.txt",
            "motor/hermes-vps/patch-hermes-auth.py",
            "motor/hermes-vps/testar-patch-hermes-auth.py",
        ):
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.touch()

    def git(self, *args):
        return subprocess.check_output(
            ["git", "-C", str(self.repo), *args], text=True, stderr=subprocess.PIPE
        ).strip()

    def migration(self, number):
        return self.migrations / f"{number:04d}_fixture.sql"

    def add_migrations(self, start, end):
        for number in range(start, end + 1):
            self.migration(number).write_text(f"-- fixture {number}\n")

    def commit(self):
        self.git("add", "--all")
        self.git("commit", "--quiet", "--allow-empty", "-m", "fixture")
        return self.git("rev-parse", "HEAD")

    def baseline(self, latest=26, missing=None):
        self.add_migrations(1, latest)
        if missing is not None:
            self.migration(missing).unlink()
        self.base_sha = self.commit()

    def dry_run(self):
        release_sha = self.commit()
        bundle = self.root / "release.bundle"
        self.git("bundle", "create", str(bundle), "--all")
        self.git("checkout", "--quiet", "--detach", self.base_sha)
        result = subprocess.run(
            ["bash", str(SCRIPT), "--bundle", str(bundle), "--commit", release_sha,
             "--current-repo", str(self.repo), "--baseline", self.base_sha,
             "--dest", str(self.staging)],
            capture_output=True, text=True, timeout=20,
        )
        # Mesmo uma falha não muda checkout atual nem deixa release parcialmente preparado.
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base_sha)
        self.assertEqual(self.git("status", "--porcelain=v1"), "")
        self.assertEqual(list(self.staging.iterdir()), [])
        return result

    def assert_rejected(self, reason):
        result = self.dry_run()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(reason, result.stderr)

    def test_accepts_old_0019_baseline_and_complete_0026_release(self):
        self.baseline(latest=19)
        self.add_migrations(20, 26)
        result = self.dry_run()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("checkout 0001–0019 iguais, release contém 0001–0026", result.stdout)
        self.assertIn("DRY RUN", result.stdout)

    def test_accepts_and_reports_future_contiguous_migrations(self):
        self.baseline(latest=27)
        self.add_migrations(28, 28)
        result = self.dry_run()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("checkout 0001–0027 iguais, release contém 0001–0028", result.stdout)

    def test_rejects_changed_existing_0024(self):
        self.baseline()
        self.migration(24).write_text("-- alteração indevida\n")
        self.assert_rejected("migration 0024 do baseline foi alterada")

    def test_rejects_changed_future_migration(self):
        self.baseline(latest=27)
        self.migration(27).write_text("-- alteração indevida\n")
        self.assert_rejected("migration 0027 do baseline foi alterada")

    def test_rejects_release_without_required_0026(self):
        self.baseline()
        self.migration(26).unlink()
        self.assert_rejected("release precisa conter pelo menos as migrations 0001–0026")

    def test_rejects_release_gap_after_0023(self):
        self.baseline()
        self.migration(25).unlink()
        self.assert_rejected("release tem lacuna na migration 0025")

    def test_rejects_baseline_gap_even_if_release_repairs_it(self):
        self.baseline(missing=25)
        self.add_migrations(25, 25)
        self.assert_rejected("baseline tem lacuna na migration 0025")

    def test_rejects_duplicate_0026(self):
        self.baseline()
        (self.migrations / "0026_duplicada.sql").write_text("-- duplicada\n")
        self.assert_rejected("migration duplicada no release")

    def test_rejects_renamed_0025(self):
        self.baseline()
        self.migration(25).rename(self.migrations / "0025_renomeada.sql")
        self.assert_rejected("migration 0025 mudou de nome")

    def test_rejects_sql_symlink_before_reading_its_target(self):
        self.baseline()
        self.migration(26).unlink()
        self.migration(26).symlink_to("/caminho-externo-nao-lido")
        self.assert_rejected("migration não é arquivo regular no incoming")


if __name__ == "__main__":
    unittest.main()
