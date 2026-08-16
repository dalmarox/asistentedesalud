// Función serverless de Netlify: intermediaria segura entre la app y la API de Gemini.
// La clave de API queda guardada como variable de entorno en Netlify (GEMINI_API_KEY), nunca en el HTML.
// Devuelve la respuesta en el mismo formato que usaba la API de Claude, para no tener que tocar el HTML.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Falta configurar GEMINI_API_KEY en Netlify (Site configuration → Environment variables), y volver a publicar el sitio.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Cuerpo de la petición inválido.' }) };
  }

  // Convertimos el historial del formato Claude {role:'user'|'assistant', content:string}
  // al formato que espera Gemini: {role:'user'|'model', parts:[{text}]}
  const contents = (payload.messages || []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
  }));

  // Modelos a intentar en orden (Google va renombrando/retirando modelos con frecuencia).
  // Si ambos dejan de funcionar, revisar los nombres vigentes en ai.google.dev/gemini-api/docs/pricing
  const modelsToTry = ['gemini-3-flash', 'gemini-3.1-flash-lite'];

  async function callGemini(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: payload.system || '' }] },
        contents,
        generationConfig: { response_mime_type: 'application/json' }
      })
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  }

  try {
    let result = null;
    for (const model of modelsToTry) {
      result = await callGemini(model);
      if (result.ok) break; // este modelo funcionó, no probamos el siguiente
    }

    if (!result.ok) {
      return {
        statusCode: result.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: result.data.error || result.data })
      };
    }

    const data = result.data;
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
                  data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
                  data.candidates[0].content.parts[0].text) || '';

    // Empaquetamos la respuesta con la misma forma que devolvía la API de Claude,
    // así el HTML no necesita ningún cambio.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
