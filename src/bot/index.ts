import { Bot } from 'grammy';
import { config } from '../config.js';
import { runAgentLoop } from '../agent/loop.js';
import { dbService } from '../db/index.js';

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
    await ctx.reply("¡Hola! Soy OpenTronixx, tu agente de IA personal. Funciono de manera local y 100% privada. Envíame un mensaje para comenzar a operar.");
});

bot.command("clear", async (ctx) => {
    if (ctx.from) {
        await dbService.clearHistory(ctx.from.id);
        await ctx.reply("Historial de memoria borrado exitosamente.");
    }
});

// Manejo de mensajes de texto
bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    // Indicador de "Escribiendo..." en Telegram
    await ctx.replyWithChatAction("typing");

    try {
        const replyText = await runAgentLoop(userId, userMessage);
        
        // Telegram tiene un límite de 4096 caracteres. Haremos un corte preventivo si es enorme.
        if (replyText.length > 4000) {
            await ctx.reply(replyText.slice(0, 4000) + "\n\n[Mensaje truncado por longitud...]");
        } else {
            await ctx.reply(replyText);
        }
    } catch (e: any) {
        console.error("[Bot] Error en runAgentLoop:", e);
        const errorMsg = e.message ? String(e.message) : String(e);
        await ctx.reply(`Ocurrió un error interno: ${errorMsg.substring(0, 500)}`);
    }
});
