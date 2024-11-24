const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const condiciones = require('./condiciones');
const { evaluarCondicion } = require('./condiciones');

const usuario = '1047404095';
const contrasena = '3138122109';
let resultadoFinal = '';
let ultimoResultado = '';
let inicialExtraidos = false;
let historialResultados = [];

// Función principal para iniciar sesión y navegar al juego
const iniciarSesionYNavegar = async (browser, usuario, contrasena) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 980, height: 1020 });

    try {
        console.log('Navegando a la página de inicio de sesión de Betplay...');
        await page.goto('https://betplay.com.co/', { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('#userName', { timeout: 30000 });
        await page.type('#userName', usuario);
        await page.type('#password', contrasena);

        console.log('Haciendo clic en el botón de inicio de sesión...');
        const loginButton = await page.$('#btnLoginPrimary');
        if (!loginButton) throw new Error('Botón de inicio de sesión no encontrado');
        await loginButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Navegando a la página del juego Aviator...');
        await page.goto('https://betplay.com.co/slots/launchGame?gameCode=SMS_JetX&flashClient=true&additionalParam=&integrationChannelCode=PARIPLAY', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Esperando el marco del juego...');
        await page.waitForSelector('iframe', { timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 20000)); // Espera adicional para asegurarse de que los frames se carguen completamente

        const frames = await page.frames();
        const frame = frames.find(f => f.url().includes('JetXNode31/JetXLight/Board.aspx'));
        if (!frame) throw new Error('Frame de JetXNode31 no encontrado');

        console.log('Frame encontrado. Iniciando scraping...');
        await frame.waitForSelector('body', { timeout: 30000 });
        return { page, frame };
    } catch (error) {
        console.error(`Error durante la ejecución: ${error.message}`);
        await browser.close();
        process.exit(1);
    }
};

// Función para extraer datos del historial del juego
const obtenerTextoElemento = async (elemento) => {
    try {
        return await elemento.evaluate(el => el.textContent.trim());
    } catch (error) {
        console.error(`Error obteniendo el texto del elemento: ${error.message}`);
        return null;
    }
};

// Guardar número en archivo y emitir al cliente
const guardarNumeroEnArchivo = (numero, io) => {
    const filePath = path.join(__dirname, 'numeros_extraidos.txt');
    fs.appendFile(filePath, `${numero}\n`, (err) => {
        if (err) {
            console.error('Error al guardar el número en el archivo:', err);
        } else {
            console.log(`Número ${numero} guardado en el archivo.`);
            io.emit('nuevoNumero', { numero });
        }
    });
};

// Función para realizar el scraping
const ejecutora = async (frame, io) => {
    console.log('Comenzando a extraer números...');
    while (true) {
        try {
            const elementos = await frame.$$('div.history > div.row');
            if (elementos.length > 1) {
                const elemento = elementos[1];
                const texto = await obtenerTextoElemento(elemento);
                const numero = parseFloat(texto.replace(',', '.'));
                if (numero && numero !== ultimoResultado) {
                    ultimoResultado = numero;
                    historialResultados.push(numero);
                    guardarNumeroEnArchivo(numero, io);
                    console.log(`Nuevo número extraído: ${numero}`);
                }
            }
        } catch (error) {
            console.error('Error en la extracción:', error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
};

// Configuración del servidor Express y socket.io
(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=980,1020']
    });

    const { page, frame } = await iniciarSesionYNavegar(browser, usuario, contrasena);

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/data', (req, res) => {
        res.json({ resultadoFinal, historialResultados });
    });

    io.on('connection', (socket) => {
        console.log('Nuevo cliente conectado');
        socket.emit('initialData', { resultadoFinal, historialResultados });

        socket.on('disconnect', () => {
            console.log('Cliente desconectado');
        });
    });

    // Configuración para producción y local
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, async () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
        const newPage = await browser.newPage();
        await newPage.goto(`http://localhost:${PORT}`);
    });

    ejecutora(frame, io);

    process.on('SIGINT', async () => {
        await browser.close();
        process.exit();
    });
})();
