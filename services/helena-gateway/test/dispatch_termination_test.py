"""Transport termination must reap the executor and preserve caller handlers."""
import sys
import signal
import subprocess
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import hermes_dispatch_once as dispatch


class TerminationTests(unittest.TestCase):
    def setUp(self):
        self.handlers = {signal.SIGTERM: 'previous-term', signal.SIGINT: 'previous-int'}
        self.original = dict(self.handlers)

    def register(self, number, handler):
        old = self.handlers[number]
        self.handlers[number] = handler
        return old

    def execute(self, wait):
        proc = Mock(pid=123)
        proc.wait.side_effect = wait
        with patch.object(dispatch.signal, 'signal', side_effect=self.register), patch.object(dispatch.signal, 'SIGKILL', 9, create=True), patch.object(dispatch.os, 'killpg', create=True) as kill:
            result = dispatch.wait_executor(proc, 600)
            self.assertEqual(self.handlers, self.original)
            return result, proc, kill

    def test_success_does_not_kill(self):
        result, proc, kill = self.execute([0])
        self.assertEqual(result, (0, None))
        kill.assert_not_called()

    def test_timeout_kills_and_reaps(self):
        result, proc, kill = self.execute([subprocess.TimeoutExpired('hermes', 600), -9])
        self.assertEqual(result, (124, 'TIMEOUT'))
        kill.assert_called_once_with(123, 9)
        self.assertEqual(proc.wait.call_count, 2)

    def test_transport_signal_is_reported_without_second_execution(self):
        count = 0
        def wait(**kwargs):
            nonlocal count
            count += 1
            if count == 1:
                self.handlers[signal.SIGTERM](signal.SIGTERM, None)
            return -9
        result, proc, kill = self.execute(wait)
        self.assertEqual(result, (128 + signal.SIGTERM, 'TRANSPORT_INTERRUPTED'))
        kill.assert_called_once_with(123, 9)
        self.assertEqual(count, 2)


if __name__ == '__main__':
    unittest.main()
