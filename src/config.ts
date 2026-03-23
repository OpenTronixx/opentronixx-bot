import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno desde .env
dotenv.config();

function getEnv(key: string, required: boolean = true, defaultValue: string = ''): string {
    // Depuración agresiva
    if (key === 'TELEGRAM_BOT_TOKEN') {
        const keys = Object.keys(process.env).sort();
        console.log(`--- [DEBUG] LISTA DE VARIABLES DETECTADAS (${keys.length}) ---`);
        keys.forEach(k => {
            if (!k.startsWith('npm_')) console.log(`  > ${k}`);
        });
        console.log(`--- [DEBUG] FIN DE LISTA ---`);
        console.log(`--- [DEBUG] Valor de PORT: ${process.env.PORT} ---`);
    }

    const value = process.env[key] || defaultValue;
    if (required && !value) {
        console.error(`[Config] ERROR: Falta la variable de entorno: ${key}`);
        throw new Error(`[Config] Falta la variable de entorno requerida: ${key}`);
    }
    console.log(`[Config] Variable ${key} cargada correctamente.`);
    return value;
}

export const config = {
    telegram: {
        botToken: getEnv('TELEGRAM_BOT_TOKEN'),
        // Soporta múltiples IDs separados por comas
        allowedUserIds: getEnv('TELEGRAM_ALLOWED_USER_IDS')
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id)),
    },
    llm: {
        groqApiKey: getEnv('GROQ_API_KEY'),
        openRouterApiKey: getEnv('OPENROUTER_API_KEY', false), // Opcional fallback
        openRouterModel: getEnv('OPENROUTER_MODEL', false, 'openrouter/free'),
    },
    db: {
        path: getEnv('DB_PATH', false, './memory.db'),
    },
    server: {
        port: parseInt(getEnv('PORT', false, '8080'), 10),
        webhookUrl: getEnv('WEBHOOK_URL', false), // URL pública para Cloud Run
    }
};

if (config.telegram.allowedUserIds.length === 0) {
    throw new Error('[Config] Debe especificarse al menos un TELEGRAM_ALLOWED_USER_IDS válido.');
}
