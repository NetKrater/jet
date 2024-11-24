const { Client } = require('ssh2');
const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const condiciones = require('./condiciones');
const { evaluarCondicion } = require('./condiciones');

const sshConfig = {
    host: 'us1.sshws.net',
    port: 22,
    username: 'fastssh.com-netkrater',
    password: 'netkrater'
};

const usuario = '';
const contrasena = '';
let resultadoFinal = '';
let ultimoResultado = '';
let inicialExtraidos = false;
let historialResultados = [];

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
        if (!loginButton) {
            throw new Error('Botón de inicio de sesión no encontrado');
        }
        await loginButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Navegando a la página del juego Aviator...');
        await page.goto('https://betplay.com.co/slots/launchGame?gameCode=SMS_JetX&flashClient=true&additionalParam=&integrationChannelCode=PARIPLAY', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Esperando el marco del juego...');
        await page.waitForSelector('iframe', { timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 20000)); // Espera adicional para asegurarse de que los frames se carguen completamente

        const frames = await page.frames();
        console.log('Frames disponibles:');
        frames.forEach(frame => {
            console.log(`${frame.name()}: ${frame.url()}`);
            const childFrames = frame.childFrames();
            childFrames.forEach(innerFrame => console.log(`Child frame: ${innerFrame.name()}: ${innerFrame.url()}`));
        });

        const frame = frames.find(f => f.url().includes('JetXNode31/JetXLight/Board.aspx'));
        if (!frame) {
            throw new Error('Frame de JetXNode31 no encontrado');
        }

        console.log('Esperando el marco del juego...');
        //await new Promise(resolve => setTimeout(resolve, 20000)); // Espera adicional para asegurarse de que los frames se carguen completamente

        const innerFrame = frame;
        if (!innerFrame) {
            throw new Error('No se encontró ningún marco hijo');
        }

        await innerFrame.waitForSelector('body', { timeout: 30000 });

        return { page, innerFrame };
    } catch (error) {
        console.error(`Error durante la ejecución: ${error.message}`);
        await browser.close();
        process.exit(1);
    }
};

const obtenerTextoElemento = async (elemento) => {
    try {
        return await elemento.evaluate(el => el.textContent.trim());
    } catch (error) {
        console.error(`Error obteniendo el texto del elemento: ${error.message}`);
        return null;
    }
};

const guardarNumeroEnArchivo = (numero, io) => {
    const filePath = path.join(__dirname, 'numeros_extraidos.txt');
    fs.appendFile(filePath, `${numero}\n`, (err) => {
        if (err) {
            console.error('Error al guardar el número en el archivo:', err);
        } else {
            console.log(`Número ${numero} guardado en el archivo.`);
            
            // Contar la cantidad de números menores o iguales a 2 desde el último número mayor a 2
            let count = 0;
            const data = fs.readFileSync(filePath, 'utf-8').split('\n').map(Number).reverse();
            for (let i = 0; i < data.length; i++) {
                if (data[i] > 2) {
                    break;
                }
                count += 1;
            }
        }
    });
};

const esNumeroValido = (texto) => {
    return /^\d+(\.\d+)?$/.test(texto.trim());
};

const extraerIniciales = async (innerFrame, io) => {
    try {
        const elementos = await innerFrame.$$('div.history > div.row');
        const recientes = elementos.slice(2, 32).reverse();
        for (const elemento of recientes) {
            let resultado = await obtenerTextoElemento(elemento);
            if (resultado && esNumeroValido(resultado)) {
                let numero = parseFloat(resultado.replace(',', '.'));
                ultimoResultado = numero;
                resultadoFinal = numero;
                historialResultados.push(numero);
                console.log(`Número extraído: ${numero}`);
                guardarNumeroEnArchivo(numero, io);
                // Evaluar condiciones
                condiciones.forEach(condicion => {
                    if (evaluarCondicion(numero, condicion.condition)) {
                        io.emit('alertaCondicion', { message: condicion.alertMessage });
                    }
                });
            }
        }
        inicialExtraidos = true;
    } catch (error) {
        console.error(`Error extrayendo elementos iniciales: ${error.message}`);
    }
};

const resultado2 = async (innerFrame, io) => {
    try {
        const elementos = await innerFrame.$$('div.history > div.row');
        if (elementos.length > 1) {
            const elemento = elementos[1];
            let resultado = await obtenerTextoElemento(elemento);
            if (resultado && esNumeroValido(resultado)) {
                let numero = parseFloat(resultado.replace(',', '.'));
                if (numero !== ultimoResultado) {
                    ultimoResultado = numero;
                    resultadoFinal = numero;
                    historialResultados.push(numero);
                    console.log(`Número extraído: ${numero}`);
                    guardarNumeroEnArchivo(numero, io);
                    // Evaluar condiciones
                    condiciones.forEach(condicion => {
                        if (evaluarCondicion(numero, condicion.condition)) {
                            io.emit('alertaCondicion', { message: condicion.alertMessage });
                        }
                    });
                }
                return numero;
            }
        }
    } catch (error) {
        console.error(`Error encontrando elementos: ${error.message}`);
    }
    return null;
};

//const condiciones = require('./condiciones');

const ejecutora = async (innerFrame, io) => {
    if (!inicialExtraidos) {
        await extraerIniciales(innerFrame, io);
    }

    const prevNumeros = [];

    while (true) {
        const nuevoNumero = await resultado2(innerFrame, io);
        if (nuevoNumero !== null) {
            io.emit('nuevoNumero', { resultadoFinal, historialResultados });

            // Add the new number to the array of previous numbers
            prevNumeros.push(nuevoNumero);

            // Check if any condition is met
            for (const condicion of condiciones) {
                if (condicion.type === 'sequence') {
                    const sequence = prevNumeros.slice(-condicion.length);
                    if (sequence.length === condicion.length && sequence.every(num => evaluarCondicion(num, condicion.condition))) {
                        io.emit('alertaCondicion', { message: condicion.alertMessage });
                    }
                } else {
                    if (evaluarCondicion(nuevoNumero, condicion.condition)) {
                        io.emit('alertaCondicion', { message: condicion.alertMessage });
                    }
                }
            }

            // Remove the oldest number from the array of previous numbers
            if (prevNumeros.length > 10) {
                prevNumeros.shift();
            }

            try {
                await innerFrame.waitForFunction(
                    (ultimoNumero) => {
                        const elementos = document.querySelectorAll('div.history > div.row');
                        if (elementos.length > 1) {
                            const elemento = elementos[1];
                            const texto = elemento.textContent.trim();
                            const numero = texto.replace(',', '.');
                            return numero !== ultimoNumero;
                        }
                        return false;
                    },
                    { timeout: 120000 },
                    ultimoResultado
                );
            } catch (error) {
                console.error(`Error en la espera de nuevo número: ${error.message}`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
};

const ejecutarComandoSSH = (conn, comando) => {
    return new Promise((resolve, reject) => {
        conn.exec(comando, (err, stream) => {
            if (err) reject(err);
            let data = '';
            stream.on('close', (code, signal) => {
                resolve(data);
            }).on('data', (chunk) => {
                data += chunk;
            }).stderr.on('data', (chunk) => {
                console.error(`STDERR: ${chunk}`);
            });
        });
    });
};

const conectarSSH = async () => {
    const conn = new Client();
    conn.on('ready', async () => {
        console.log('Conexión SSH establecida.');
        try {
            const resultado = await ejecutarComandoSSH(conn, 'ls');
            console.log('Resultado del comando SSH:', resultado);
            // Puedes agregar aquí más comandos SSH que necesites ejecutar
        } catch (error) {
            console.error('Error ejecutando comando SSH:', error);
        } finally {
            conn.end();
        }
    }).connect(sshConfig);
};

(async () => {
    conectarSSH();

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=980,1020']
    });

    const { page, innerFrame } = await iniciarSesionYNavegar(browser, usuario, contrasena);

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    app.use(express.static(path.join(__dirname, 'public')));

app.get('/data', (req, res) => {
    res.json({ resultadoFinal, historialResultados });
});

app.post('/manual-entry', express.json(), (req, res) => {
    const { numero } = req.body;
    if (typeof numero === 'number') {
        resultadoFinal = numero;
        historialResultados.push(numero);
        io.emit('nuevoNumero', { resultadoFinal, historialResultados });
        res.status(200).send('Number added successfully');
    } else {
        res.status(400).send('Invalid number');
    }
});

app.delete('/manual-entry', (req, res) => {
    if (serieNumeros.length > 0) {
        serieNumeros.pop();
        historialResultados.pop();
        resultadoFinal = historialResultados[historialResultados.length - 1];
        io.emit('nuevoNumero', { resultadoFinal, historialResultados });
        res.status(200).send('Number deleted successfully');
    } else {
        res.status(400).send('No numbers to delete');
    }
});

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');
    socket.emit('initialData', { resultadoFinal, historialResultados });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

server.listen(3000, async () => {
    console.log('Servidor corriendo en http://localhost:3000');
    const newPage = await browser.newPage();
    await newPage.goto('http://localhost:3000');
});

    ejecutora(innerFrame, io);

    process.on('SIGINT', async () => {
        await browser.close();
        process.exit();
    });
})();
