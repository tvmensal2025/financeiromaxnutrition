// Manual diagnostic: one synthetic request, no Supabase writes or agent dispatch.
import { requestTypeSafe, typeSafeRequestBody } from './integrations/typesafe.mjs';

try {
  const body = typeSafeRequestBody({
    role: { agente:'Teste de marketing', cargo_funcao:'Redacao de conteudo', missao:'Preparar rascunhos educativos internos.' },
    task: { objective:'Preparar rascunho interno de tres stories sobre organizacao para trabalhar em casa.',
      instruction:'Publico adulto. Cada story tem um titulo e uma dica pratica sobre rotina. Entregar somente texto em portugues. Nao publicar, nao prometer renda, nao assumir condicoes de parceiros e nao contatar clientes.',
      definition_of_done:'Tres textos curtos revisaveis, com uma dica pratica cada, sem promessa de renda ou publicacao.' }
  });
  const result = await requestTypeSafe(body, process.env.TYPESAFE_API_KEY);
  console.log(JSON.stringify({ ok:true, synthetic:true, model:result.model, recommendation:result.recommendation,
    usage:result.usage, estimated_cost_usd:result.estimated_cost_usd, dispatched:false }));
} catch (error) {
  const safe = /^(MISSING_API_KEY|HTTP_\d{3}|INVALID_RESPONSE|INVALID_USAGE|MODEL_MISMATCH)$/.test(error.message) ? error.message : 'CONNECTION_OR_RESPONSE_ERROR';
  console.error(JSON.stringify({ ok:false, code:safe, dispatched:false }));
  process.exitCode=1;
}
