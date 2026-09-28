const CATEGORIES = new Set(['food','symptom','hydration','relationship','mood','exercise','sleep','other']);

export async function classifyVoiceFacts(text, { fetchImpl = fetch, apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (!apiKey) return null;
  try {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(4500),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-6-luna', reasoning_effort: 'none', temperature: 0,
        response_format: { type: 'json_object' }, max_completion_tokens: 180,
        messages: [
          { role: 'system', content: 'Extraia apenas fatos explícitos que a pessoa afirma sobre si na fala. Responda JSON {"categories":[]} com categorias food, symptom, hydration, relationship, mood, exercise, sleep ou other. Não infira quantidade, diagnóstico, data, nem classifique perguntas ou afirmações sobre terceiros.' },
          { role: 'user', content: String(text).slice(0,3000) }
        ] })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const categories = JSON.parse(data.choices?.[0]?.message?.content || '{}').categories;
    return Array.isArray(categories) ? [...new Set(categories.filter(value => CATEGORIES.has(value)))] : null;
  } catch { return null; }
}
