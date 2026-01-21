const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Configuración de la IA
const genAI = new GoogleGenerativeAI("AIzaSyD8LLKi6KoUc5k8P33LMldvBFaLpNNOcx4");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const DB_PATH = './alumnos.json';
const ID_GRUPO_VOLEY = '120363154406139745@g.us';

const leerAlumnos = () => {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH));
};

// --- FUNCIONES IA ---
async function generarSaludoIA(nombre) {
    try {
        const result = await model.generateContent(`Saluda brevemente por su cumpleaños a ${nombre}, alumno de voley. Divertido y con emojis.`);
        return result.response.text();
    } catch (e) {
        return `¡Feliz cumple ${nombre}! 🎉🏐`;
    }
}

async function generarRecordatorioPagoIA(nombre) {
    try {
        const result = await model.generateContent(`Hazle un recordatorio corto y motivador para ${nombre}: hoy vence su mensualidad de voley. Usa emojis.`);
        return result.response.text();
    } catch (e) {
        return `Hola ${nombre}, hoy vence tu mensualidad de voley 🏐.`;
    }
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        handleSIGINT: false 
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('✅ WhatsApp Conectado');
    console.log('⏳ Esperando a las 21:10 para enviar mensajes automáticos...');
    iniciarTareasProgramadas();
});

async function enviarMensajes() {
    const ahora = new Date();
    const hoyFull = ahora.toLocaleDateString('en-CA', {timeZone: 'America/Lima'}); 
    const hoyMMDD = hoyFull.slice(5, 10);
    
    console.log(`🚀 Ejecutando envío diario: ${ahora.toLocaleString('es-PE')}`);
    const alumnos = leerAlumnos();

    for (const alumno of alumnos) {
        if (alumno.vencimiento === hoyFull) {
            const msg = await generarRecordatorioPagoIA(alumno.nombre);
            await client.sendMessage(`${alumno.telefono}@c.us`, msg, { sendSeen: false });
            console.log(`✅ Pago enviado a ${alumno.nombre}`);
        }

        if (alumno.cumple === hoyMMDD) {
            const msg = await generarSaludoIA(alumno.nombre);
            await client.sendMessage(ID_GRUPO_VOLEY, msg, { sendSeen: false });
            console.log(`✅ Cumpleaños enviado a ${alumno.nombre}`);
        }
    }
}

function iniciarTareasProgramadas() {
    // Tarea principal: 9:15 PM
    cron.schedule('00 22 * * *', () => {
        enviarMensajes();
    }, {
        scheduled: true,
        timezone: "America/Lima"
    });

    // Tarea secundaria: Solo para que veas en consola que el bot sigue despierto cada hora
    cron.schedule('0 * * * *', () => {
        console.log(`Checking: El bot sigue activo. Hora actual: ${new Date().toLocaleTimeString()}`);
    });
}

client.initialize();