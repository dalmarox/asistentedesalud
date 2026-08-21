// Netlify a veces falla en detectar automáticamente el contexto de Blobs dentro de una función
// (error conocido: "MissingBlobsEnvironmentError"). Para evitarlo, lo configuramos a mano
// con el ID del sitio y un token de acceso personal, guardados como variables de entorno.

const { getStore } = require('@netlify/blobs');

function store(name) {
  return getStore({
    name,
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
}

module.exports = { store };
