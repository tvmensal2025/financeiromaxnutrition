import urllib.request, re, json

BASE_URL = 'http://72.60.159.48:3000'
html = urllib.request.urlopen(BASE_URL).read().decode('utf-8', errors='ignore')
chunks = re.findall(r'src="(/_next/static/chunks/[^"]+)"', html)

for c in chunks:
    try:
        js = urllib.request.urlopen(BASE_URL + c).read().decode('utf-8', errors='ignore')
        for m in re.finditer(r'useQuery\(\[?["\']([^"\']+)["\']', js):
            query_name = m.group(1)
            if 'log' in query_name.lower():
                print('useQuery:', query_name)
        for m in re.finditer(r'trpc\.([a-zA-Z0-9_\.]+)\.use', js):
            print('trpc:', m.group(1))
    except Exception:
        pass
