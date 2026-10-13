// Inicializador de desenvolvimento local do Helena Gateway
// Segredos (SUPABASE_SERVICE_ROLE_KEY, MCP_BEARER_TOKEN, MEOWCALLER_TOKEN, EVOLUTION_API_KEY...) vêm só do
// ambiente local (.env fora do Git ou terminal): nunca com valor padrão aqui. Sem eles, cada função falha fechada.
process.env.PORT = process.env.PORT || '3999';
process.env.PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost:3999';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://wxkgrykduqtsgmjkzlou.supabase.co';
process.env.LAYA_BASE_URL = process.env.LAYA_BASE_URL || 'https://helena-automation-laya-service.d9v63q.easypanel.host';
process.env.MEOWCALLER_BASE_URL = process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
process.env.EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL || 'http://helena-automation-evolution-api.d9v63q.easypanel.host';
process.env.EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'helena_mensagens';
process.env.CALL_VOICE_STREAMING_ENABLED = process.env.CALL_VOICE_STREAMING_ENABLED || 'true';

await import('./src/server.mjs');
