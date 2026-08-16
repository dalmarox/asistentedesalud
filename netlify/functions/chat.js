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

  // Modelo gratuito (nivel free de Google AI Studio). Si en el futuro deja de estar disponible,
  // revisar el nombre vigente en ai.google.dev/gemini-api/docs/pricing
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
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

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error || data })
      };
    }

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

