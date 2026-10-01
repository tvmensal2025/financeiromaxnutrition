import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import install_pipeline_runtime as installer


class InstallerTests(unittest.TestCase):
    def test_existing_schedule_and_state_preserved_and_install_replay_noop(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)
            runtime = home / 'helena-runtime'
            runtime.mkdir()
            scripts = home / 'scripts'
            scripts.mkdir()
            poll = scripts / 'helena_dispatch_poll.sh'
            old = '#!/bin/sh\npython /data/helena-runtime/hermes_dispatch_once.py --auto --execute\n'
            poll.write_text(old)
            (runtime / 'workflow-state.json').write_text('{"receipts":{"existing":{}}}')
            before_state = (runtime / 'workflow-state.json').read_bytes()
            result = installer.install(home)
            self.assertFalse(result['schedule_changed'])
            self.assertFalse(result['jobs_changed'])
            self.assertEqual(result['model_calls'], 0)
            self.assertEqual((runtime / 'workflow-state.json').read_bytes(), before_state)
            self.assertEqual((Path(result['backup']) / 'scripts/helena_dispatch_poll.sh').read_text(), old)
            self.assertEqual(poll.read_text(), installer.POLL)
            self.assertEqual(installer.install(home)['changed_files'], 0)

    def test_divergent_poll_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)
            (home / 'helena-runtime').mkdir()
            (home / 'scripts').mkdir()
            poll = home / 'scripts/helena_dispatch_poll.sh'
            poll.write_text('unrecognized operator script')
            with self.assertRaises(ValueError): installer.install(home)
            self.assertEqual(poll.read_text(), 'unrecognized operator script')


if __name__ == '__main__': unittest.main()
