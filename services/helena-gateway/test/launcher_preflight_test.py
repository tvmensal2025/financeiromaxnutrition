import subprocess
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import hermes_dispatch_once as dispatcher


class LauncherTests(unittest.TestCase):
    def check(self, response):
        calls = []
        def run(command, **kwargs):
            calls.append((command, kwargs))
            return response
        with patch.object(dispatcher, 'native_cli_command', return_value=['python', 'adapter', '--run-hermes', 'hermes']):
            result = dispatcher.launcher_preflight('hermes', 'marina--biz003', Path('/data/profiles/marina--biz003'), 'private-test-token', run)
        self.assertEqual(calls[0][0][-4:], ['-p', 'marina--biz003', 'chat', '--help'])
        self.assertNotIn('--query-file', calls[0][0])
        self.assertEqual(calls[0][1]['env']['HERMES_HOME'], str(Path('/data/profiles/marina--biz003')))
        self.assertNotIn('private-test-token', str(result))
        return result

    def test_exact_adapter_help_path_can_be_checked_without_model(self):
        result = self.check(subprocess.CompletedProcess([], 0, b'--query-file --oneshot', b''))
        self.assertEqual(result, {'status': 'READY'})

    def test_syntax_error_is_categorized_without_exposing_output(self):
        result = self.check(subprocess.CompletedProcess([], 1, b'', b'SyntaxError private-test-token'))
        self.assertEqual(result['diagnostic'], 'RUNTIME_SYNTAX')
        self.assertEqual(result['status'], 'LAUNCHER_UNAVAILABLE')

    def test_unsupported_help_is_not_considered_ready(self):
        result = self.check(subprocess.CompletedProcess([], 0, b'ordinary help', b''))
        self.assertEqual(result['status'], 'LAUNCHER_UNAVAILABLE')


if __name__ == '__main__': unittest.main()
