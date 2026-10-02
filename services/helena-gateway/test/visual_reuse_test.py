import base64
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image, ImageChops
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import hermes_visual as visual

class ReuseTests(unittest.TestCase):
    def test_reposition_preserves_pixels_outside_logo_and_rejects_unsafe_area(self):
        base=Image.linear_gradient('L').resize((1080,1920)).convert('RGB')
        b=io.BytesIO();base.save(b,format='PNG')
        mark=Image.new('RGBA',(260,96),(0,0,0,0));mark.paste((255,0,0,255),(30,20,230,76))
        m=io.BytesIO();mark.save(m,format='PNG')
        result=Image.open(io.BytesIO(visual.reposition_logo(b.getvalue(),m.getvalue(),'story-1',250,895)))
        mask=Image.new('L',base.size,0);mask.paste(mark.getchannel('A'),(250,895))
        diff=ImageChops.difference(base,result).convert('L')
        self.assertIsNone(ImageChops.multiply(diff,ImageChops.invert(mask)).getbbox())
        self.assertEqual(result.getpixel((300,925)),(255,0,0))
        self.assertEqual(result.getpixel((900,1600)),base.getpixel((900,1600)))
        for left,top in [(0,895),(250,10),(250,1800),(1000,895)]:
            with self.assertRaises(ValueError):visual.reposition_logo(b.getvalue(),m.getvalue(),'story-1',left,top)

    def test_recompose_refuses_unproven_base_before_upload_or_model(self):
        self.detail['company_identity']['brand_identity']['colors']=[{'hex':'#075E47'}]
        with tempfile.TemporaryDirectory() as folder, \
             patch.dict(os.environ,{'HERMES_HOME':'/data/profiles/maya--biz003',visual.TOKEN_NAME:'fixture'}), \
             patch.object(visual,'ROOT',Path(folder)),patch.object(visual,'call_tool',self.gateway), \
             patch.object(visual,'upload_existing_png') as upload,patch.object(visual,'load_provider') as provider:
            with self.assertRaises(FileNotFoundError):visual.recompose_design(self.target,'post',1,2,100,100)
            upload.assert_not_called();provider.assert_not_called()

    def setUp(self):
        self.target = 'JOB-HR-' + 'a'*32
        self.source = 'JOB-HR-' + 'b'*32
        self.creative = {'business_id': 'BIZ-003', 'brand': 'Teste', 'brand_version': 3,
                         'logo_asset': 'storage://logo.png', 'formats': ['post'],
                         'imagery_method': 'GENERATED_IMAGE', 'exact_copy': 'Texto aprovado'}
        instruction = '```direcao-arte\n' + json.dumps(self.creative) + '\n```'
        self.job = {'job_id': self.target, 'business_id': 'BIZ-003', 'agent_id': 'AGT-12',
                    'status': 'RUNNING', 'instruction': self.source + '\n' + instruction}
        self.old = {**self.job, 'job_id': self.source, 'status': 'DRAFT', 'instruction': instruction}
        self.detail = {'job': self.job, 'company_identity': {'row_version': 3, 'brand_identity': {
            'business_id': 'BIZ-003', 'status': 'APPROVED', 'logo_approved': True,
            'name': 'Teste', 'logo_url': 'storage://logo.png'}}}
        output = io.BytesIO(); Image.new('RGB', (1080, 1350), 'green').save(output, format='PNG')
        self.raw = output.getvalue()
        self.asset = {'data': base64.b64encode(self.raw).decode(), 'sha256': hashlib.sha256(self.raw).hexdigest()}
        self.calls = []

    def gateway(self, base, token, name, args):
        self.calls.append(name)
        if name == 'get_job': return self.detail if args['job_id'] == self.target else {'job': self.old}
        if name == 'get_visual_asset': return self.asset
        raise AssertionError(name)

    def run_reuse(self):
        return visual.reuse_design(self.target, self.source, 'post', 1, 1)

    def test_rejects_unlinked_cross_business_copy_brand_and_hash_before_upload(self):
        for fault in ('unlinked', 'business', 'agent', 'copy', 'brand', 'hash'):
            with self.subTest(fault=fault):
                self.setUp()
                if fault == 'unlinked': self.job['instruction'] = self.old['instruction']
                if fault == 'business': self.old['business_id'] = 'BIZ-002'
                if fault == 'agent': self.old['agent_id'] = 'AGT-17'
                if fault == 'copy': self.old['instruction'] = self.old['instruction'].replace('Texto aprovado', 'Outro texto')
                if fault == 'brand': self.old['instruction'] = self.old['instruction'].replace('"brand_version": 3', '"brand_version": 2')
                if fault == 'hash': self.asset['sha256'] = 'wrong'
                with patch.dict(os.environ, {'HERMES_HOME': '/data/profiles/maya--biz003', visual.TOKEN_NAME: 'fixture'}), \
                     patch.object(visual, 'call_tool', self.gateway), patch.object(visual, 'upload_existing_png') as upload, \
                     patch.object(visual, 'load_provider') as provider:
                    with self.assertRaises(ValueError): self.run_reuse()
                    upload.assert_not_called(); provider.assert_not_called()

    @unittest.skipIf(sys.platform == 'win32', 'fcntl tested on Hermes Linux')
    def test_exact_bytes_idempotency_no_model_and_no_inherited_approval(self):
        with tempfile.TemporaryDirectory() as folder, \
             patch.dict(os.environ, {'HERMES_HOME': '/data/profiles/maya--biz003', visual.TOKEN_NAME: 'fixture'}), \
             patch.object(visual, 'ROOT', Path(folder)), patch.object(visual, 'call_tool', self.gateway), \
             patch.object(visual, 'load_provider') as provider:
            def upload(job, slot, version, path, token):
                self.assertEqual(path.read_bytes(), self.raw)
                return {'reference': 'storage://target', 'verified': True}
            with patch.object(visual, 'upload_existing_png', side_effect=upload) as writer:
                first = self.run_reuse(); second = self.run_reuse()
                self.assertEqual(first, second); self.assertEqual(writer.call_count, 1)
                self.assertFalse(first['approval_inherited']); self.assertEqual(first['model_calls'], 0)
                provider.assert_not_called()
                receipt = json.loads((Path(folder)/self.target/'post-v1/receipt.json').read_text())
                self.assertEqual(receipt['source_sha256'], self.asset['sha256'])
                self.assertEqual(receipt['state'], 'VERIFIED')
                self.asset['sha256'] = hashlib.sha256(b'changed').hexdigest()
                with self.assertRaises(ValueError): self.run_reuse()
                self.assertEqual(writer.call_count, 1)

if __name__ == '__main__': unittest.main()
