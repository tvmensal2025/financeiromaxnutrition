import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hermes_execution_context import team_context_prompt


class TeamContextTests(unittest.TestCase):
    def test_preserves_authorized_roles_without_extra_fields(self):
        text = team_context_prompt({'fleet': {'agents': [
            {'agent_id': 'AGT-08', 'name': 'Daniel', 'function': 'Dados/BI',
             'status': 'ATIVO', 'runtime_status': 'ACTIVE', 'private_note': 'EXCLUDE'},
            {'agent_id': 'AGT-02', 'name': 'Laura', 'runtime_status': 'MISSING'},
        ]}, 'credential': 'EXCLUDE'})
        rows = json.loads(text.splitlines()[2])
        self.assertEqual(rows[0]['function'], 'Dados/BI')
        self.assertEqual(rows[1]['runtime_status'], 'MISSING')
        self.assertNotIn('EXCLUDE', text)
        self.assertIn('Proposta de atribuicao nao significa tarefa aceita', text)

    def test_missing_directory_does_not_invent_roles(self):
        self.assertIn('nao fornecido', team_context_prompt({}))
        self.assertIn('nao fornecido', team_context_prompt({'fleet': []}))

    def test_bad_entries_do_not_become_responsible_agents(self):
        text = team_context_prompt({'fleet': {'agents': [None, 'invalid', {'name': 'unknown'}]}})
        self.assertEqual(json.loads(text.splitlines()[2]), [])


if __name__ == '__main__':
    unittest.main()
