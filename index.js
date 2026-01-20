require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode'); // Necesitas instalarlo: npm install qrcode
const cron = require('node-cron');
const fs = require('fs');
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURACIÓN EXPRESS (Para Render y ver el QR) ---
const app = express();
const port = process.env.PORT || 3000;
const QR_PATH = path.join(__dirname, 'qr.png');

app.get('/', (req, res) => {
    if (fs.existsSync(QR_PATH)) {
        res.send(`
            <div style="text-align:center; font-family:sans-serif;">
                <h2>Escanea el QR para la Academia 🏐</h2>
                <img src="/qr-image" style="border: 10px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                <p>Si ya escaneaste, espera a que el bot se conecte.</p>
            </div>
        `);
    } else {
        res.send('<h2>Bot de la Academia Activo 🏐</h2><p>El QR se está generando o ya estás conectado.</p>');
    }
});

app.get('/qr-image', (req, res) => {
    if (fs.existsSync(QR_PATH)) {
        res.sendFile(QR_PATH);
    } else {
        res.status(404).send('QR no disponible');
    }
});

// ESCUCHA EN 0.0.0.0 (Obligatorio para Render)
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor web en puerto ${port}`);
});

// --- LÓGICA DEL BOT ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const DB_PATH = './alumnos.json';
const ID_GRUPO_VOLEY = process.env.ID_GRUPO_VOLEY;

const delay = ms => new Promise(res => setTimeout(res, ms));

const leerAlumnos = () => {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH));
};

async function generarTextoIA(nombre, contexto) {
    try {
        const prompt = `Actúa como el encargado amigable de una academia de voley. 
        Escribe un mensaje muy corto (máximo 2 líneas) para WhatsApp.
        Alumno: ${nombre}. Contexto: ${contexto}. 
        Usa emojis de voley y mucha motivación.`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        return `¡Hola ${nombre}! 🏐 ${contexto}`;
    }
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
            '--single-process', '--disable-gpu'
        ]
    }
});

// GUARDAR QR EN ARCHIVO Y MOSTRAR EN TERMINAL
client.on('qr', async (qr) => {
    qrcodeTerminal.generate(qr, { small: true });
    await QRCode.toFile(QR_PATH, qr); // Guarda la imagen qr.png
    console.log('✨ Nuevo código QR generado y guardado en vista.');
});

client.on('ready', () => {
    console.log('✅ WhatsApp con IA Conectado');
    if (fs.existsSync(QR_PATH)) fs.unlinkSync(QR_PATH); // Borra el QR al conectar
    iniciarTareasProgramadas();
});

async function enviarMensajes() {
    const ahora = new Date();
    const hoyFull = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const hoyMMDD = hoyFull.slice(5, 10);
    const alumnos = leerAlumnos();

    for (const alumno of alumnos) {
        if (alumno.vencimiento === hoyFull) {
            try {
                const chatId = `${alumno.telefono}@c.us`;
                const mensajeIA = await generarTextoIA(alumno.nombre, "recordarle amablemente que hoy vence su mensualidad");
                await client.sendMessage(chatId, mensajeIA, { sendSeen: false });
                console.log(`✅ Pago enviado a ${alumno.nombre}`);
                await delay(5000);
            } catch (e) { console.log(`⚠️ Error pago ${alumno.nombre}`); }
        }

        if (alumno.cumple === hoyMMDD) {
            try {
                const mensajeIA = await generarTextoIA(alumno.nombre, "felicitarlo por su cumple en el grupo");
                await client.sendMessage(ID_GRUPO_VOLEY, mensajeIA, { sendSeen: false });
                console.log(`✅ Cumple enviado para ${alumno.nombre}`);
                await delay(5000);
            } catch (e) { console.log(`⚠️ Error cumple ${alumno.nombre}`); }
        }
    }
}

function iniciarTareasProgramadas() {
    cron.schedule('00 22 * * *', () => {
        console.log('⏰ Iniciando envío programado...');
        enviarMensajes();
    }, { scheduled: true, timezone: "America/Lima" });
}

client.initialize();