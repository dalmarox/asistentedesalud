// Recibe TODO lo que pasa en el bot de Telegram: cuando alguien le escribe /start
// (ahí guardamos su chat_id para poder mandarle avisos después) y cuando toca
// los botones de un aviso ("Ya lo tomé" / "Recordame en 10 minutos").

const { store: storeFrom } = require('./blobs-helper');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Código simple para que no cualquiera que encuentre el bot quede registrado.
// Se lo escribe la persona junto con /start, así: /start CASA123
const REGISTRO_CODIGO = process.env.TELEGRAM_REGISTRO_CODIGO || 'FAMILIA';

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'ok' };
  }

  const update = JSON.parse(event.body || '{}');
  const configStore = storeFrom('config');
  const medsStore = storeFrom('meds');

  // --- Caso 1: la persona escribió un mensaje (por ejemplo /start) ---
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    if (text.toUpperCase().startsWith('/START')) {
      const partes = text.split(' ');
      const codigo = (partes[1] || '').toUpperCase();

      if (codigo !== REGISTRO_CODIGO.toUpperCase()) {
        await telegram('sendMessage', {
          chat_id: chatId,
          text: 'Para activarte necesito el código de la familia. Escribí: /start CODIGO'
        });
        return ok();
      }

      await configStore.setJSON('telegramChatId', chatId);
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '¡Listo! Ya quedaste conectado. Te voy a avisar acá cuando sea hora de tomar tus medicamentos.'
      });
      return ok();
    }

    // Cualquier otro mensaje de texto (no lo procesamos por ahora)
    return ok();
  }

  // --- Caso 2: la persona tocó un botón del aviso ---
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const [accion, medId] = cb.data.split(':'); // ej: "tomado:m12345"

    const list = (await medsStore.get('list', { type: 'json' })) || [];
    const med = list.find(m => m.id === medId);

    if (accion === 'tomado' && med) {
      const hoy = new Date().toISOString().slice(0, 10);
      med.takenLog = med.takenLog || {};
      med.takenLog[hoy] = true;
      await medsStore.setJSON('list', list);
      await telegram('answerCallbackQuery', { callback_query_id: cb.id, text: '✔ Anotado, gracias' });
      await telegram('editMessageText', {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text: `✔ Ya tomaste: ${med.name}`
      });
    }

    if (accion === 'posponer' && med) {
      med.snoozeUntil = Date.now() + 10 * 60 * 1000; // dentro de 10 minutos
      await medsStore.setJSON('list', list);
      await telegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Te aviso en 10 minutos' });
      await telegram('editMessageText', {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text: `⏰ Te voy a recordar de nuevo en 10 minutos: ${med.name}`
      });
    }

    return ok();
  }

  return ok();
};

function ok() {
  return { statusCode: 200, body: 'ok' };
}
