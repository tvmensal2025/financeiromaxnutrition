import base64
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import hermes_visual as visual

class VisualTests(unittest.TestCase):
    def detail(self):
        brand = {'status': 'APPROVED', 'logo_approved': True, 'name': 'Empresa teste', 'business_id': 'BIZ-003',
                 'logo_url': 'storage://helena-brand-assets/BIZ-003/logo.png', 'colors': [{'hex': '#075E47'}]}
        creative = {'business_id': 'BIZ-003', 'brand': brand['name'], 'brand_version': 3, 'logo_asset': brand['logo_url'], 'formats': ['post'], 'imagery_method': 'GENERATED_IMAGE'}
        return {'job': {'job_id': 'JOB-HR-' + 'a'*32, 'business_id': 'BIZ-003', 'agent_id': 'AGT-12', 'status': 'RUNNING',
                        'instruction': '```direcao-arte\n'+json.dumps(creative)+'\n```'},
                'company_identity': {'row_version': 3, 'brand_identity': brand}}

    def test_contract_rejects_wrong_status_brand_and_slot(self):
        detail = self.detail(); visual.design_contract(detail, 'post')
        with self.assertRaises(ValueError): visual.design_contract(detail, 'story-1')
        detail['job']['status'] = 'DRAFT'
        with self.assertRaises(ValueError): visual.design_contract(detail, 'post')
        detail['job']['status'] = 'RUNNING'; detail['company_identity']['row_version'] = 4
        with self.assertRaises(ValueError): visual.design_contract(detail, 'post')

    def test_final_canvas_has_requested_dimensions_and_actual_logo(self):
        art = io.BytesIO(); Image.effect_noise((800, 1000), 80).convert('RGB').save(art, format='PNG')
        logo = io.BytesIO(); Image.new('RGBA',(100,40),(255,0,0,255)).save(logo, format='PNG')
        final = Image.open(io.BytesIO(visual.final_canvas(art.getvalue(), logo.getvalue(), 'post', '#075E47')))
        self.assertEqual(final.size, (1080, 1350)); self.assertEqual(final.getpixel((540, 1240)), (255,0,0))
        empty = io.BytesIO(); Image.new('RGB',(800,1000),'white').save(empty, format='PNG')
        with self.assertRaisesRegex(ValueError, 'empty'): visual.final_canvas(empty.getvalue(),logo.getvalue(),'post','#075E47')

    @unittest.skipIf(sys.platform == 'win32', 'fcntl receipt lock is validated on Hermes Linux')
    def test_generation_once_upload_retry_reuses_private_png(self):
        detail = self.detail(); jid = detail['job']['job_id']; calls = []
        logo = io.BytesIO(); Image.new('RGBA',(100,40),(255,0,0,255)).save(logo, format='PNG')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); raw = root/'source.png'; Image.effect_noise((800,1000),80).convert('RGB').save(raw)
            class Provider:
                def is_available(self): return True
                def generate(self, **kw): calls.append(kw); return {'success': True, 'image': str(raw)}
            def gateway(base, token, name, args):
                if name == 'get_job': return detail
                if name == 'get_visual_asset' and args['reference'] == 'brand-logo': return {'data': base64.b64encode(logo.getvalue()).decode()}
                if name == 'create_artifact_upload': return {'upload_url': f'https://wxkgrykduqtsgmjkzlou.supabase.co/storage/v1/object/upload/sign/helena-deliveries/BIZ-003/{jid}/post-v1.png?token=fixture'}
                if name == 'verify_artifact_upload': return {'reference': f'storage://helena-deliveries/BIZ-003/{jid}/post-v1.png', 'verified': True}
                return {'sha256': hashlib.sha256((root/jid/'post-v1/final.png').read_bytes()).hexdigest()}
            class Upload:
                def open(self, *a, **kw): return contextlib.nullcontext(type('R', (), {'status': 200})())
            with patch.object(visual,'ROOT',root), patch.object(visual,'call_tool',gateway), patch.object(visual,'load_provider',return_value=Provider()), patch.object(visual.urllib.request,'build_opener',return_value=Upload()), patch.dict(os.environ,{'HERMES_HOME':'/data/profiles/maya--biz003', visual.TOKEN_NAME:'fixture'}):
                args = (jid,'post',1,'Use a copy aprovada com imagem protagonista e paleta da marca, preservando contraste e legibilidade em celular.')
                first = visual.generate_design(*args); self.assertEqual(visual.generate_design(*args), first)
                self.assertEqual(len(calls), 1)

if __name__ == '__main__': unittest.main()
