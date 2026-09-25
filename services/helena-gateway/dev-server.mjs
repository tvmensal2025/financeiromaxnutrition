// Inicializador de desenvolvimento local do Helena Gateway
process.env.PORT = process.env.PORT || '3999';
process.env.PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost:3999';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://wxkgrykduqtsgmjkzlou.supabase.co';
process.env.LAYA_BASE_URL = process.env.LAYA_BASE_URL || 'https://helena-automation-laya-service.d9v63q.easypanel.host';
process.env.MEOWCALLER_BASE_URL = process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
process.env.MEOWCALLER_TOKEN = process.env.MEOWCALLER_TOKEN || 'helena_meow_sec_8a3c1f9d2e';

await import('./src/server.mjs');
