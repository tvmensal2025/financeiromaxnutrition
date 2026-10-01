import json
from pathlib import Path
import sys
from types import SimpleNamespace as Obj
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import install_native_mcp_pixels as bridge

class PixelsTests(unittest.TestCase):
    def renderer(self):
        source = 'def render(result, server_name):\n' + bridge.ANCHOR + '\n    return text_result\n'
        namespace = {'json': json, '_render_content_blocks': lambda r,s: ('ordinary text', 1),
                     'mcp_field': lambda obj, snake, camel, default: getattr(obj, snake, getattr(obj, camel, default))}
        exec(bridge.patched(source), namespace); return namespace['render']

    def test_verified_private_gateway_pixels_use_native_envelope(self):
        meta = {'reference': 'storage://helena-deliveries/BIZ-003/job/post-v2.png', 'sha256': 'a'*64}
        result = Obj(content=[Obj(type='text', text=json.dumps(meta)), Obj(type='image', mime_type='image/png', data='actual-pixels')])
        render = self.renderer(); envelope = render(result, 'helena_operacao')
        self.assertIsInstance(envelope, dict, 'Hermes only recognizes a native dict; JSON strings spill into text')
        self.assertTrue(envelope['_multimodal'])
        self.assertEqual(envelope['content'][1]['image_url']['url'], 'data:image/png;base64,actual-pixels')
        self.assertIn('Nao aprovar', envelope['text_summary'])
        self.assertEqual(render(result, 'other-server'), 'ordinary text')
        meta['reference'] = 'https://unapproved.test/image'
        result.content[0].text = json.dumps(meta)
        self.assertEqual(render(result, 'helena_operacao'), 'ordinary text')

    def test_large_pixels_remain_in_image_content_not_text_summary(self):
        meta = {'reference': 'storage://helena-brand-assets/BIZ-003/logo.png', 'sha256': 'b'*64}
        pixels = 'A' * 2000000
        result = Obj(content=[Obj(type='text', text=json.dumps(meta)), Obj(type='image', mime_type='image/png', data=pixels)])
        envelope = self.renderer()(result, 'helena_operacao')
        self.assertIsInstance(envelope, dict)
        self.assertLess(len(envelope['text_summary']), 200)
        self.assertLess(len(envelope['content'][0]['text']), 300)
        self.assertEqual(envelope['content'][1]['image_url']['url'], 'data:image/png;base64,' + pixels)

    def test_replay_is_exact_and_vendor_drift_refuses_patch(self):
        source = 'def render(result, server_name):\n' + bridge.ANCHOR + '\n    return text_result\n'
        self.assertEqual(bridge.patched(bridge.patched(source)), bridge.patched(source))
        with self.assertRaises(ValueError): bridge.patched('changed vendor code')

if __name__ == '__main__': unittest.main()
