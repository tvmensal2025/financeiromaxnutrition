/**
 * Autenticação obrigatória das rotas que iniciam ligação ou geram voz (VOZ-33).
 *
 * Reaproveita a credencial que o app já envia (`Authorization: Bearer <sessão Max>`)
 * e a mesma validação de `voice-admin-auth.mjs` (`/auth/v1/user` do Max), mas sem exigir
 * perfil de administrador: qualquer conta logada vale. Outras credenciais (token estático
 * de serviço, Hermes, OAuth da Helena) seguem para o `fallback` (`authenticateMcp`).
 *
 * Define `req.voiceSession`:
 *  - `{ kind: 'user', userId, profilePhone() }`  conta do app; o telefone vem do perfil dela;
 *  - `{ kind: 'service' }`                        token estático de serviço (pode escolher o destino);
 *  - `{ kind: 'other' }`                          qualquer outra credencial válida (não pode ligar).
 */

/** Só dígitos; 10 ou 11 dígitos sem DDI recebem 55, como em `originateCall`. */
export function normalizeDialNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return (digits.length === 10 || digits.length === 11) && !digits.startsWith('55') ? `55${digits}` : digits;
}

export function createVoiceSessionAuth({
  fallback,
  url = process.env.MAX_SUPABASE_URL,
  key = process.env.MAX_SUPABASE_ANON_KEY,
  fetchImpl = fetch
}) {
  return async (req, res, next) => {
    const header = String(req.headers?.authorization || '');
    const token = header.replace(/^Bearer /, '').trim();
    if (!header || !token) {
      return res.status(401).json({ error: 'authorization_required', message: 'Entre na sua conta para continuar.' });
    }
    let issuer;
    try { issuer = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).iss; } catch { /* não é JWT */ }

    if (!url || issuer !== `${url}/auth/v1`) {
      return fallback(req, res, () => {
        req.voiceSession = { kind: req.identity?.type === 'static_fallback' ? 'service' : 'other' };
        return next();
      });
    }

    try {
      const headers = { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const userResponse = await fetchImpl(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(5000) });
      if (!userResponse.ok) return res.status(401).json({ error: 'session_expired', message: 'Sessão expirada. Entre novamente.' });
      const user = await userResponse.json();
      if (!user?.id) return res.status(401).json({ error: 'invalid_token' });
      req.user = { id: user.id, email: user.email };
      req.voiceSession = {
        kind: 'user',
        userId: user.id,
        // Lido com a própria sessão da pessoa (RLS do Max); nunca com o corpo do pedido.
        profilePhone: async () => {
          const profile = await fetchImpl(
            `${url}/rest/v1/profiles?select=phone&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
            { headers, signal: AbortSignal.timeout(5000) }
          );
          if (!profile.ok) throw new Error('profile_unavailable');
          const rows = await profile.json();
          return String((Array.isArray(rows) ? rows[0]?.phone : '') ?? '').replace(/\D/g, '');
        }
      };
      return next();
    } catch {
      return res.status(503).json({ error: 'auth_unavailable', message: 'Não foi possível validar a sessão. Tente novamente.' });
    }
  };
}
