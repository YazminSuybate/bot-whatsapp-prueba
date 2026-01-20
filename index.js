require('dotenv').config(); 
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
        Alumno: ${nombre}. 
        Contexto: ${contexto}. 
        Usa emojis de voley y mucha motivación. No uses saludos formales como "Estimado".`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        return `¡Hola ${nombre}! 🏐 ${contexto}`;
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
    console.log('✅ WhatsApp con IA Conectado');
    iniciarTareasProgramadas();
});

async function enviarMensajes() {
    const ahora = new Date();
    const hoyFull = ahora.toLocaleDateString('en-CA', {timeZone: 'America/Lima'}); 
    const hoyMMDD = hoyFull.slice(5, 10);
    
    console.log(`🔎 Revisando fecha: ${hoyFull}`);
    const alumnos = leerAlumnos();

    for (const alumno of alumnos) {
        if (alumno.vencimiento === hoyFull) {
            try {
                const chatId = `${alumno.telefono}@c.us`;
                const mensajeIA = await generarTextoIA(alumno.nombre, "recordarle amablemente que hoy vence su mensualidad");
                
                await client.sendMessage(chatId, mensajeIA, { sendSeen: false });
                console.log(`✅ Pago enviado a ${alumno.nombre}`);
                await delay(5000); 
            } catch (e) {
                console.log(`⚠️ Error en mensaje de pago para ${alumno.nombre}`);
            }
        }

        // --- PROCESO DE CUMPLE ---
        if (alumno.cumple === hoyMMDD) {
            try {
                const mensajeIA = await generarTextoIA(alumno.nombre, "felicitarlo por su cumpleaños en el grupo del equipo");
                
                await client.sendMessage(ID_GRUPO_VOLEY, mensajeIA, { sendSeen: false });
                console.log(`✅ Cumple enviado para ${alumno.nombre}`);
                await delay(5000); 
            } catch (e) {
                console.log(`⚠️ Error en mensaje de cumple para ${alumno.nombre}`);
            }
        }
    }
}

function iniciarTareasProgramadas() {
    cron.schedule('00 22 * * *', () => {
        console.log('⏰ Iniciando envío programado...');
        enviarMensajes();
    }, {
        scheduled: true,
        timezone: "America/Lima"
    });
}

client.initialize();