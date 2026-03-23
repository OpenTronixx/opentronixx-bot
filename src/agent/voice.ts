import { config } from '../config.js';
import fs from 'fs';

export async function transcribeAudio(filePath: string): Promise<string> {
    const groqUrl = "https://api.groq.com/openai/v1/audio/transcriptions";
    const model = "whisper-large-v3";

    try {
        const fileBuffer = fs.readFileSync(filePath);
        const formData = new FormData();
        
        // Convertimos el buffer a un Blob/File compatible con FormData
        const blob = new Blob([fileBuffer], { type: 'audio/ogg' });
        formData.append('file', blob, 'voice.ogg');
        formData.append('model', model);
        formData.append('language', 'es'); // Forzamos español por defecto
        formData.append('response_format', 'json');

        console.log(`[Voice] Enviando a Groq para transcripción (${fileBuffer.length} bytes)...`);

        const response = await fetch(groqUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.llm.groqApiKey}`
                // El Content-Type se establece automáticamente para FormData
            },
            body: formData,
            signal: AbortSignal.timeout(30000) // 30 segundos límite
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq Transcription Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return result.text;
    } catch (error: any) {
        console.error(`[Voice] Error en transcripción:`, error.message);
        throw error;
    }
}
