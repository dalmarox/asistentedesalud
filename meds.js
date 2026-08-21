// Guarda y lee los medicamentos desde Netlify Blobs (en vez de localStorage del celular),
// para que el chequeo automático (check-reminders.js) los pueda ver aunque el navegador esté cerrado.

const { store: storeFrom } = require('./blobs-helper');

function store() {
  return storeFrom('meds');
}

exports.handler = async function (event) {
  const meds = store();

  try {
    if (event.httpMethod === 'GET') {
      const list = (await meds.get('list', { type: 'json' })) || [];
      return json(200, list);
    }

    if (event.httpMethod === 'POST') {
      // Agregar un medicamento nuevo
      const body = JSON.parse(event.body || '{}');
      if (!body.name || !body.time) {
        return json(400, { error: 'Falta el nombre o el horario.' });
      }
      const list = (await meds.get('list', { type: 'json' })) || [];
      const newMed = {
        id: 'm' + Date.now(),
        name: body.name,
        time: body.time,
        photo: body.photo || null,
        takenLog: {}
      };
      list.push(newMed);
      await meds.setJSON('list', list);
      return json(200, newMed);
    }

    if (event.httpMethod === 'DELETE') {
      const { id } = JSON.parse(event.body || '{}');
      let list = (await meds.get('list', { type: 'json' })) || [];
      list = list.filter(m => m.id !== id);
      await meds.setJSON('list', list);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'PATCH') {
      // Marcar como tomado hoy (lo usa tanto el botón web como el botón de Telegram)
      const { id, date } = JSON.parse(event.body || '{}');
      const list = (await meds.get('list', { type: 'json' })) || [];
      const med = list.find(m => m.id === id);
      if (!med) return json(404, { error: 'No se encontró el medicamento.' });
      med.takenLog = med.takenLog || {};
      med.takenLog[date] = true;
      await meds.setJSON('list', list);
      return json(200, med);
    }

    return json(405, { error: 'Método no permitido.' });
  } catch (err) {
    return json(500, { error: err.message });
  }
};

function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}
