const puppeteer = require('puppeteer');
const fs = require('fs');
const condiciones = require('./condiciones');
const { evaluarCondicion } = require('./condiciones');

// Copy the necessary functions from your original code into this file, such as:
// - iniciarSesionYNavegar
// - obtenerTextoElemento
// - guardarNumeroEnArchivo
// - esNumeroValido
// - extraerIniciales
// - resultado2
// - ejecutora

// Modify the ejecutora function to save the data to a file instead of sending it to the client
async function ejecutora(innerFrame) {
  // ...
  // Save the data to a file instead of sending it to the client
  fs.writeFileSync('data.json', JSON.stringify(historialResultados));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--window-size=980,1020']
  });

  const { page, innerFrame } = await iniciarSesionYNavegar(browser, usuario, contrasena);

  await ejecutora(innerFrame);

  await browser.close();
})();
