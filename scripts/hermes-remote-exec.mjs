import WebSocket from 'ws';
import https from 'node:https';

function request(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

export async function runHermesCommand(cmd, timeoutMs = 8000) {
  if (!process.env.HELENA_HERMES_LOGIN_TOKEN) {
    throw new Error('Configure HELENA_HERMES_LOGIN_TOKEN no ambiente local.');
  }
  const postData = new URLSearchParams({
    next: '/cli',
    token: process.env.HELENA_HERMES_LOGIN_TOKEN
  }).toString();
  
  const loginRes = await request('https://chocolate-grasshopper-990557.hostingersite.com/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0'
    }
  }, postData);
  
  const cookieHeader = loginRes.headers['set-cookie'];
  const sessionCookie = cookieHeader ? cookieHeader[0].split(';')[0] : '';

  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://chocolate-grasshopper-990557.hostingersite.com/cli/ws', {
      headers: {
        'Cookie': sessionCookie,
        'Origin': 'https://chocolate-grasshopper-990557.hostingersite.com',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    let fullOutput = '';
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));
      setTimeout(() => {
        ws.send(Buffer.from(cmd + '\n'));
      }, 500);

      setTimeout(() => {
        ws.close();
        resolve(fullOutput);
      }, timeoutMs);
    });

    ws.on('message', (data) => {
      fullOutput += data.toString('utf8');
    });

    ws.on('error', reject);
  });
}

export async function runHermesPython(pythonScript, timeoutMs = 10000) {
  const b64 = Buffer.from(pythonScript, 'utf8').toString('base64');
  const cmd = `python -c "import base64; exec(base64.b64decode('${b64}').decode('utf-8'))"`;
  return runHermesCommand(cmd, timeoutMs);
}

// Se chamado diretamente
if (process.argv[2] === '--eval-python') {
  const pyCode = process.argv.slice(3).join(' ');
  const res = await runHermesPython(pyCode);
  console.log(res);
} else if (process.argv[2]) {
  const res = await runHermesCommand(process.argv.slice(2).join(' '));
  console.log(res);
}
