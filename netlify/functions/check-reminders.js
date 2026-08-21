// Esta función NO la llama el navegador. La llama un cron externo (cron-job.org)
// una vez por minuto, y revisa si hay que mandar algún aviso de medicamento por Telegram.

const { getStore } = require('@netlify/blobs');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hhmmNow() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

exports.handler = async function () {
  if (!BOT_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta TELEGRAM_BOT_TOKEN en Netlify.' }) };
  }

  const configStore = getStore('config');
  const medsStore = getStore('meds');

  const chatId = await configStore.get('telegramChatId', { type: 'json' });
  if (!chatId) {
    // Todavía nadie hizo /start con el bot. No hay a quién avisarle.
    return { statusCode: 200, body: JSON.stringify({ skipped: 'sin chat_id registrado' }) };
  }

  const list = (await medsStore.get('list', { type: 'json' })) || [];
  const tk = todayKey();
  const hhmm = hhmmNow();
  const now = Date.now();
  let cambiado = false;
  let avisados = [];

  for (const med of list) {
    const yaTomado = med.takenLog && med.takenLog[tk];
    if (yaTomado) continue;

    const tocaPorSnooze = med.snoozeUntil && now >= med.snoozeUntil;
    const tocaPorHorario = med.time === hhmm && med.lastSentDate !== tk;

    if (tocaPorSnooze || tocaPorHorario) {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: `💊 Es hora de tomar tu medicamento: ${med.name}`,
        reply_markup: {
          inline_keyboard: [[
            { text: '✔ Ya lo tomé', callback_data: `tomado:${med.id}` },
            { text: '⏰ Recordame en 10 min', callback_data: `posponer:${med.id}` }
          ]]
        }
      });

      // Si tenía foto guardada, la mandamos como archivo (Telegram no acepta base64 directo)
      if (med.photo) {
        try {
          const base64Data = med.photo.split(',')[1] || med.photo;
          const buffer = Buffer.from(base64Data, 'base64');
          const form = new FormData();
          form.append('chat_id', String(chatId));
          form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'medicamento.jpg');
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: form });
        } catch (e) {
          // Si falla la foto no importa, el aviso de texto ya se mandó igual.
        }
      }

      med.lastSentDate = tk;
      med.snoozeUntil = null;
      cambiado = true;
      avisados.push(med.name);
    }
  }

  if (cambiado) {
    await medsStore.setJSON('list', list);
  }

  return { statusCode: 200, body: JSON.stringify({ avisados }) };
};
