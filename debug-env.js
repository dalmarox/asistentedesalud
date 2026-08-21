// Función TEMPORAL solo para diagnosticar el error de Netlify Blobs.
// No expone los valores completos, solo si existen y cómo empiezan/terminan.
// Borrar este archivo una vez resuelto el problema.

exports.handler = async function () {
  const siteId = process.env.BLOBS_SITE_ID || '';
  const token = process.env.BLOBS_TOKEN || '';

  function resumen(valor) {
    if (!valor) return 'NO ESTÁ DEFINIDA (vacía)';
    if (valor.length < 8) return `muy corta (${valor.length} caracteres): "${valor}"`;
    return `${valor.length} caracteres, empieza "${valor.slice(0, 6)}" y termina "${valor.slice(-4)}"`;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BLOBS_SITE_ID: resumen(siteId),
      BLOBS_TOKEN: resumen(token)
    }, null, 2)
  };
};
