import http.client
import urllib.request
import json
import io
import struct
import time

BASE_URL = 'http://72.60.159.48:3000'
req = urllib.request.Request(
    f'{BASE_URL}/api/trpc/auth.login',
    data=json.dumps({'json': {'email': 'rafael.ids@icloud.com', 'password': '201097De.'}}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as res:
    token = json.loads(res.read().decode('utf-8'))['json']['token']

req2 = urllib.request.Request(
    f'{BASE_URL}/api/trpc/projects.listProjectsAndServices',
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req2) as res:
    data = json.loads(res.read().decode('utf-8'))['json']

eleven_key = ''
for s in data.get('services', []):
    if s.get('name') == 'helena-gateway':
        for line in s.get('env', '').split('\n'):
            if line.startswith('ELEVENLABS_API_KEY='):
                eleven_key = line.split('=', 1)[1].strip()

print("Using key:", eleven_key[:8] + "...")

# Build multipart form data
boundary = 'Boundary1234567890'
body = io.BytesIO()

def add_field(name, val):
    body.write(f'--{boundary}\r\n'.encode('utf-8'))
    body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode('utf-8'))
    body.write(f'{val}\r\n'.encode('utf-8'))

# Audio wav data
num_samples = 16000
raw_audio = b'\x00' * (num_samples * 2)
header = struct.pack(
    '<4sI4s4sIHHIIHH4sI',
    b'RIFF', 36 + len(raw_audio), b'WAVE',
    b'fmt ', 16, 1, 1, 16000, 32000, 2, 16,
    b'data', len(raw_audio)
)
body.write(f'--{boundary}\r\n'.encode('utf-8'))
body.write(b'Content-Disposition: form-data; name="file"; filename="speech.wav"\r\n')
body.write(b'Content-Type: audio/wav\r\n\r\n')
body.write(header + raw_audio)
body.write(b'\r\n')

add_field('model_id', 'scribe_v1')
add_field('language_code', 'por')

body.write(f'--{boundary}--\r\n'.encode('utf-8'))
body_bytes = body.getvalue()

req_stt = urllib.request.Request(
    'https://api.elevenlabs.io/v1/speech-to-text',
    data=body_bytes,
    headers={
        'xi-api-key': eleven_key,
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)
start = time.time()
try:
    with urllib.request.urlopen(req_stt) as res_stt:
        print('Status:', res_stt.status)
        print('Took:', round((time.time() - start)*1000), 'ms')
        print('Response:', res_stt.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.read().decode('utf-8'))
except Exception as e:
    print('Error:', e)
