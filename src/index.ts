import { bot } from './bot/index.js';
import { config } from './config.js';
import express from 'express';
import { webhookCallback } from 'grammy';

const app = express();
app.use(express.json());

// Endpoint de salud para Google Cloud Run
app.get('/health', (req, res) => res.send('OK'));

async function bootstrap() {
    console.log(`\n================================`);
    console.log(`[Init] Iniciando OpenTronixx...`);
    console.log(`[Init] IDs de Telegram autorizados: ${config.telegram.allowedUserIds.join(', ')}`);
    
    // Configurar manejo de cierre ordenado
    process.once("SIGINT", () => bot.stop());
    process.once("SIGTERM", () => bot.stop());

    if (config.server.webhookUrl) {
        // MODO WEBHOOK (Producción / Cloud Run)
        const secretPath = `/${config.telegram.botToken.split(':')[1]}`; // Ruta segura
        app.use(secretPath, webhookCallback(bot, 'express'));
        
        app.listen(config.server.port, async () => {
            console.log(`[Init] Servidor escuchando en puerto ${config.server.port}`);
            console.log(`[Init] Configurando Webhook en: ${config.server.webhookUrl}${secretPath}`);
            await bot.api.setWebhook(`${config.server.webhookUrl}${secretPath}`);
            console.log(`[Bot] Webhook configurado exitosamente.`);
        });
    } else {
        // MODO LONG POLLING (Desarrollo Local)
        console.log(`[Init] Conectando Bot vía Long Polling...`);
        console.log(`================================\n`);
        await bot.start({
            onStart: (botInfo) => {
                console.log(`[Bot] ¡Operativo localmente! Conectado como @${botInfo.username}`);
            }
        });
    }
}

bootstrap().catch(err => {
    console.error(`[Init] Error fatal al iniciar:`, err);
    process.exit(1);
});
