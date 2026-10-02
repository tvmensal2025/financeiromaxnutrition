"""Pure contract checks; no Hermes board or model calls."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from helena_kanban_mirror import LANES, board_slug, card


class MirrorContract(unittest.TestCase):
    def fixture(self, status):
        return {
            'job_id': 'JOB-HR-' + 'a' * 32, 'task_id': 'TSK-1',
            'business_id': 'BIZ-003', 'agent_id': 'AGT-12',
            'profile_slug': 'maya--biz003', 'binding_status': 'ACTIVE',
            'objective': 'Criar imagem da campanha', 'status': status,
            'priority': 'ALTA', 'approval_status': 'APPROVED',
        }

    def test_every_official_state_maps_to_a_board_lane(self):
        for official, lane in LANES.items():
            with self.subTest(official=official):
                self.assertEqual(card(self.fixture(official))['status'], lane)

    def test_board_identity_is_stable_and_scoped(self):
        item = card(self.fixture('READY'))
        self.assertEqual(item['board'], 'helena-biz-003')
        self.assertEqual(item['assignee'], 'maya--biz003')
        self.assertEqual(item['idempotency_key'], 'helena-mirror:JOB-HR-' + 'a' * 32)
        self.assertIn('não execute', item['body'])
        self.assertNotIn('instruction', item['body'])

    def test_historical_job_ids_are_displayed_without_execution(self):
        for job_id in ('JOB-WPP-MUHDJGA7', 'JOB-20260927043930112-AC7353'):
            job = self.fixture('COMPLETED')
            job['job_id'] = job_id
            self.assertEqual(card(job)['idempotency_key'], 'helena-mirror:' + job_id)

    def test_missing_profile_is_visible_and_unknown_state_stops_sync(self):
        invalid = self.fixture('READY')
        invalid['binding_status'] = 'UNAVAILABLE'
        missing = card(invalid)
        self.assertIsNone(missing['assignee'])
        self.assertEqual(missing['status'], 'blocked')
        self.assertIn('perfil indisponível', missing['body'])
        invalid = self.fixture('INVENTED')
        with self.assertRaises(ValueError):
            card(invalid)
        with self.assertRaises(ValueError):
            board_slug('../BIZ-003')


if __name__ == '__main__':
    unittest.main()
