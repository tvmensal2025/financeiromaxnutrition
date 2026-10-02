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
from PIL import Image, ImageChops, ImageOps
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import hermes_visual as visual

class VisualTests(unittest.TestCase):
    def test_generation_context_excludes_registry_and_unrelated_business_examples(self):
        copy = 'A Humano Digital orienta e conecta pessoas. Participação depende do projeto.'
        creative = {'business_id': 'BIZ-003', 'brand': 'Humano Digital',
                    'brand_version': 3038, 'logo_asset': 'storage://private/logo.png',
                    'sources': ['MEM-HR-private'], 'verified_facts': ['Registry context'],
                    'review': 'Upstream workflow', 'exact_copy': copy,
                    'scene': 'Pessoa adulta dobra roupas numa sala clara.', 'palette': '#075E47'}
        direction = 'Preservar fotografia, composição e copy aprovada para story.'
        context = visual.generation_context(creative, 'story-1', direction)
        encoded = json.dumps(context, ensure_ascii=False)
        for forbidden in ('business_id', 'brand_version', 'logo_asset', 'storage://',
                          'MEM-HR-private', 'robo amigavel', 'Saude', 'Upstream workflow'):
            self.assertNotIn(forbidden, encoded)
        self.assertEqual(context['art_direction']['exact_copy'], copy)
        self.assertEqual(context['direction'], direction)
        self.assertEqual(context['art_direction']['scene'], creative['scene'])
        self.assertEqual(context['slot'], 'story-1')

    def test_task_version_is_refused_before_network_and_can_be_corrected(self):
        with patch.dict(os.environ, {'HERMES_HOME': '/data/profiles/maya--biz003'}), \
             patch.object(visual, 'call_tool') as gateway, patch.object(visual, 'load_provider') as provider:
            for version in (3781, True, 1.0, 0, 6):
                report = visual.generate_design('JOB-HR-' + 'a' * 32, 'post', version, 'Direcao aprovada para esta imagem. ' * 4)
                self.assertEqual(report['status'], 'INVALID_ARGUMENTS')
                self.assertEqual(report['fields'], ['version'])
                self.assertFalse(report['generation_started'])
                self.assertEqual(report['model_calls'], 0)
                self.assertIn('never task.row_version', report['recovery'])
            gateway.assert_not_called(); provider.assert_not_called()

    def test_other_argument_errors_are_named_before_any_generation(self):
        with patch.dict(os.environ, {'HERMES_HOME': '/data/profiles/maya--biz003'}), \
             patch.object(visual, 'call_tool') as gateway:
            report = visual.generate_design('bad-job', 'story', 1, 'short')
            self.assertEqual(report['fields'], ['job_id', 'slot', 'design_note'])
            gateway.assert_not_called()

    def test_stdio_readiness_rejects_missing_identity_before_loading_provider(self):
        with patch.dict(os.environ, {'HERMES_HOME': ''}), patch.object(visual, 'load_provider') as provider:
            self.assertEqual(visual.check_visual_runtime()['reason'], 'PROFILE_MISSING')
            provider.assert_not_called()

    def test_stdio_readiness_verifies_same_scoped_token_without_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory) / 'maya--biz003'; home.mkdir()
            token = 'hhs_' + 'P' * 40
            (home / '.env').write_text(visual.TOKEN_NAME + '=' + token + '\n')
            with patch.dict(os.environ, {'HERMES_HOME': str(home), visual.TOKEN_NAME: token}), patch.object(visual, 'load_provider') as provider:
                provider.return_value.is_available.return_value = True
                report = visual.check_visual_runtime()
                self.assertTrue(report['ready']); self.assertEqual(report['model_calls'], 0)
                self.assertEqual(report['renderer']['source_sha256'],
                                 hashlib.sha256(Path(visual.__file__).read_bytes()).hexdigest())
                self.assertEqual(report['renderer']['visual_approval'], 'REQUIRES_INDEPENDENT_PIXEL_REVIEW')
                self.assertFalse(report['renderer']['adds_logo_backing'])
                self.assertFalse(report['renderer']['adds_footer'])
                provider.return_value.generate.assert_not_called()
                os.environ[visual.TOKEN_NAME] = 'different'
                self.assertEqual(visual.check_visual_runtime()['reason'], 'PROFILE_TOKEN_MISMATCH')
                provider.return_value.generate.assert_not_called()

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
        self.assertEqual(final.size, (1080, 1350)); self.assertEqual(final.getpixel((900, 1240)), (255,0,0))
        self.assertGreater(final.crop((0,1150,600,1350)).convert('L').entropy(), 2, 'No appended empty footer')
        story_art = io.BytesIO(); Image.effect_noise((900,1600),80).convert('RGB').save(story_art,format='PNG')
        story = Image.open(io.BytesIO(visual.final_canvas(story_art.getvalue(), logo.getvalue(), 'story-1', '#075E47', ['#075E47', '#F4F5EB'])))
        self.assertEqual(story.size, (1080, 1920))
        self.assertEqual(story.getpixel((900, 1600)), (255,0,0))
        self.assertNotEqual(story.getpixel((900, 1700)), (255,0,0), 'Logo must clear the bottom 250px story overlay')
        self.assertGreater(story.crop((0,1540,600,1920)).convert('L').entropy(), 2, 'Story artwork must continue to the bottom')
        with self.assertRaisesRegex(ValueError, 'aspect ratio'):
            visual.final_canvas(art.getvalue(),logo.getvalue(),'story-1','#075E47')
        empty = io.BytesIO(); Image.new('RGB',(800,1000),'white').save(empty, format='PNG')
        with self.assertRaisesRegex(ValueError, 'empty'): visual.final_canvas(empty.getvalue(),logo.getvalue(),'post','#075E47')

    def test_official_logo_alpha_preserves_artwork_without_added_plate(self):
        logo_image = Image.new('RGBA', (260, 96), (0, 0, 0, 0))
        logo_image.paste((255, 0, 0, 255), (30, 20, 230, 76))
        logo = io.BytesIO(); logo_image.save(logo, format='PNG')
        for slot, size, bottom in [('post', (1080,1350), 50), ('story-1', (1080,1920), 250)]:
            with self.subTest(slot=slot):
                source = Image.linear_gradient('L').resize(size).convert('RGB')
                raw = io.BytesIO(); source.save(raw, format='PNG')
                final = Image.open(io.BytesIO(visual.final_canvas(raw.getvalue(), logo.getvalue(), slot,
                        '#075E47', ['#075E47', '#F4F5EB'])))
                left, top = 760, size[1] - bottom - 96
                mask = Image.new('L', size, 0)
                mask.paste(logo_image.getchannel('A'), (left, top))
                diff = ImageChops.difference(source, final).convert('L')
                self.assertIsNone(ImageChops.multiply(diff, ImageOps.invert(mask)).getbbox(),
                                  'No artwork pixels outside the official logo alpha may change')
                self.assertEqual(final.getpixel((left+100, top+40)), (255,0,0))

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
