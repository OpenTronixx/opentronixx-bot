import { Bot, InputFile } from 'grammy';
import { config } from '../config.js';
import { runAgentLoop } from '../agent/loop.js';
import { dbService } from '../db/index.js';
import { transcribeAudio, synthesizeSpeech } from '../agent/voice.js';
import fs from 'fs';
import path from 'path';

export const bot = new Bot(config.telegram.botToken);

// Middleware de Whitelist de seguridad: Solo permitir usuarios configurados
bot.use(async (ctx, next) => {
    if (!ctx.from || !config.telegram.allowedUserIds.includes(ctx.from.id)) {
        console.warn(`[Bot] Acceso denegado al usuario intruso: ${ctx.from?.id} (@${ctx.from?.username})`);
        return; // Ignorar silenciosamente
    }
    await next();
});

bot.command("start", async (ctx) => {
    await ctx.reply("¡Hola! Soy OpenTronixx, tu agente de IA personal. Ahora también puedo escuchar tus mensajes de voz. Envíame un mensaje o un audio para comenzar.");
});

bot.command("clear", async (ctx) => {
    if (ctx.from) {
        await dbService.clearHistory(ctx.from.id);
        await ctx.reply("Historial de memoria borrado exitosamente.");
    }
});

// Manejo de mensajes de texto
bot.on("message:text", async (ctx) => {
    await handleMessage(ctx, ctx.message.text, false);
});

// Manejo de mensajes de voz
bot.on("message:voice", async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        await ctx.replyWithChatAction("record_voice");
        
        // 1. Obtener y descargar el archivo
        const file = await ctx.getFile();
        const tempPath = path.join(process.cwd(), `voice_${Date.now()}.oga`);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(tempPath, Buffer.from(buffer));

        // 2. Transcribir
        await ctx.replyWithChatAction("typing");
        const transcribedText = await transcribeAudio(tempPath);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        // 3. Informar y procesar (con flag de voz para responder por voz)
        console.log(`[Bot] Voz de ${userId} transcrita: "${transcribedText}"`);
        await ctx.reply(`🎤 _He escuchado:_ "${transcribedText}"`, { parse_mode: "Markdown" });
        
        await handleMessage(ctx, transcribedText, true);

    } catch (e: any) {
        console.error("[Bot] Error procesando voz:", e);
        await ctx.reply("Lo siento, no pude entender tu mensaje de voz.");
    }
});

// Función auxiliar para procesar los mensajes
async function handleMessage(ctx: any, text: string, respondWithVoice: boolean) {
    const userId = ctx.from.id;
    await ctx.replyWithChatAction("typing");

    try {
        const replyText = await runAgentLoop(userId, text);
        
        // 1. Enviar el texto siempre
        if (replyText.length > 4000) {
            await ctx.reply(replyText.slice(0, 4000) + "\n\n[Mensaje truncado por longitud...]");
        } else {
            await ctx.reply(replyText);
        }

        // 2. Si venimos de un mensaje de voz, enviar también el audio
        if (respondWithVoice) {
            try {
                await ctx.replyWithChatAction("record_voice");
                const audioPath = await synthesizeSpeech(replyText);
                if (audioPath && fs.existsSync(audioPath)) {
                    // Usar InputFile de grammy para enviar el archivo local
                    await ctx.replyWithVoice(new InputFile(audioPath));
                    fs.unlinkSync(audioPath); // Limpiar después de enviar
                }
            } catch (ttsErr) {
                console.error("[Bot] Error generando respuesta de voz:", ttsErr);
            }
        }

    } catch (e: any) {
        console.error("[Bot] Error en runAgentLoop:", e);
        const errorMsg = e.message ? String(e.message) : String(e);
        await ctx.reply(`Ocurrió un error interno: ${errorMsg.substring(0, 500)}`);
    }
}
