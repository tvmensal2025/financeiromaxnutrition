/** Authenticate the Max admin session only on voice configuration routes. */
export function createVoiceAdminAuth({ fallback, url = process.env.MAX_SUPABASE_URL, key = process.env.MAX_SUPABASE_ANON_KEY, fetchImpl = fetch }) {
  return async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    let issuer;
    try { issuer = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).iss; } catch {}
    if (!url || issuer !== `${url}/auth/v1`) return fallback(req, res, next);
    if (!req.path.startsWith('/api/integrations/call-engine/')) return res.status(403).json({ error: 'voice_admin_scope_required' });
    try {
      const headers = { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const userResponse = await fetchImpl(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(5000) });
      if (!userResponse.ok) return res.status(401).json({ error: 'session_expired', message: 'Sessão expirada. Entre novamente para salvar.' });
      const user = await userResponse.json();
      if (!user.id) return res.status(401).json({ error: 'invalid_token' });
      const role = await fetchImpl(`${url}/rest/v1/rpc/is_admin_user`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(5000) });
      if (!role.ok || await role.json() !== true) return res.status(403).json({ error: 'admin_required', message: 'Somente administradores podem configurar os perfis.' });
      req.user = { id: user.id, email: user.email };
      return next();
    } catch { return res.status(503).json({ error: 'auth_unavailable', message: 'Não foi possível validar a sessão. Tente novamente.' }); }
  };
}
