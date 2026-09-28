// Inicializador de desenvolvimento local do Helena Gateway
process.env.PORT = process.env.PORT || '3999';
process.env.PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost:3999';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://wxkgrykduqtsgmjkzlou.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyOTQyOSwiZXhwIjoyMTA1NzA1NDI5fQ.1tf7YBL8ib52pAbVQHVg7Pwwr3iIBAYPOaKg_3dQWek';
process.env.MCP_BEARER_TOKEN = process.env.MCP_BEARER_TOKEN || 'helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f';
process.env.LAYA_BASE_URL = process.env.LAYA_BASE_URL || 'https://helena-automation-laya-service.d9v63q.easypanel.host';
process.env.MEOWCALLER_BASE_URL = process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
process.env.MEOWCALLER_TOKEN = process.env.MEOWCALLER_TOKEN || 'helena_meow_sec_8a3c1f9d2e';
process.env.EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL || 'http://helena-automation-evolution-api.d9v63q.easypanel.host';
process.env.EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
process.env.EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'helena_mensagens';
process.env.CALL_VOICE_STREAMING_ENABLED = process.env.CALL_VOICE_STREAMING_ENABLED || 'true';

await import('./src/server.mjs');
