const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');

let mainWindow;
let browser;

const usuario = "45449570";
const contrasena = "3138122109";

async function iniciarSesionYJugar() {
  try {
    browser = await puppeteer.launch({ headless: false, args: ['--disable-web-security'] });
    const page = await browser.newPage();
    await page.goto('https://betplay.com.co/');
    
    await page.type('#userName', usuario);
    await page.type('#password', contrasena);
    await page.click('#btnLoginPrimary');
    
    await page.waitForNavigation();
    await page.goto("https://betplay.com.co/slots/launchGame?gameCode=SPB_aviator&flashClient=true&additionalParam=&integrationChannelCode=PARIPLAY");
    
    const frame = await page.frames().find(f => f.name() === 'gameFrame');
    const subFrame = await frame.childFrames().find(f => f.name() === 'spribe-game');
    
    const element = await subFrame.waitForSelector('app-stats-widget div:nth-child(1)', { timeout: 30000 });
    return subFrame.evaluate(el => el.textContent, element);
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    if (browser) browser.close();
  }
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('iniciar-sesion', async () => {
  const result = await iniciarSesionYJugar();
  return result;
});
