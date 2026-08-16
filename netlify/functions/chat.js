// Función serverless de Netlify: intermediaria segura entre la app y la API de Claude.
// La clave de API queda guardada como variable de entorno en Netlify, nunca en el HTML.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Falta configurar ANTHROPIC_API_KEY en Netlify (Site configuration → Environment variables), y volver a publicar el sitio.' })
    };
  }

  let payload;
  try{
    payload = JSON.parse(event.body || '{}');
  }catch(e){
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Cuerpo de la petición inválido.' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5', // Verificar el nombre de modelo vigente en docs.claude.com antes de publicar
        max_tokens: 1000,
        system: payload.system,
        messages: payload.messages
      })
    });

    const data = await response.json();

    if(!response.ok){
      // La API de Anthropic devolvió un error (clave inválida, sin crédito, etc.) — lo mostramos tal cual para poder diagnosticarlo.
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error || data })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};

