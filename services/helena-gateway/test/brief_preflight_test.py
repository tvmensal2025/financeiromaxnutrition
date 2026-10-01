import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from brief_preflight import check_task_brief, SECTIONS, utf16_length


def brief():
    return '\n'.join('## ' + title + '\n' + 'Conteudo autorizado e completo para esta etapa. ' * 3 for title in SECTIONS)


class BriefPreflightTests(unittest.TestCase):
    def check(self, text, **kwargs):
        return check_task_brief(text, 'Criar campanha privada', 'Quatro arquivos revisados e copy aprovada.', **kwargs)

    def test_valid_brief_is_advisory_not_permission(self):
        result = self.check(brief())
        self.assertEqual(result['status'], 'TECHNICAL_CHECK_PASSED')
        self.assertTrue(result['gateway_validation_still_required'])
        self.assertEqual(result['model_calls'], 0)

    def test_real_failed_sizes_are_refused(self):
        for size in (12132, 10227, 8735):
            text = brief() + ' ' + 'x' * (size - len(brief()) - 1)
            self.assertEqual(self.check(text)['errors'][0]['actual'], size)

    def test_unicode_uses_gateway_length_not_python_characters(self):
        self.assertEqual(utf16_length('a🤖'), 3)
        text = brief() + '🤖' * 3600
        self.assertEqual(self.check(text)['status'], 'CORRECT_BEFORE_SUBMIT')

    def test_preserves_copy_and_rejects_invalid_creative_json(self):
        text = brief() + '\n```direcao-arte\n{"exact_copy":"Olá, equipe!"}\n```'
        self.assertEqual(self.check(text, for_design=True, protected_texts=['Olá, equipe!'])['status'], 'TECHNICAL_CHECK_PASSED')
        self.assertEqual(self.check(text, protected_texts=['Copy removida'])['status'], 'CORRECT_BEFORE_SUBMIT')
        self.assertEqual(self.check(brief() + '\n```direcao-arte\n{\n```', for_design=True)['status'], 'CORRECT_BEFORE_SUBMIT')

    def test_missing_duplicate_or_reordered_sections_are_refused(self):
        self.assertEqual(self.check(brief().replace('## Contexto e fontes', '## Outro'))['status'], 'CORRECT_BEFORE_SUBMIT')
        self.assertEqual(self.check(brief() + '\n## Contexto e fontes\nMais conteudo.')['status'], 'CORRECT_BEFORE_SUBMIT')


if __name__ == '__main__':
    unittest.main()
