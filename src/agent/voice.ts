import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

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

/**
 * Convierte texto a un archivo de audio MP3 usando el motor gratuito de Google.
 * Limitado a ~200 caracteres por las restricciones del URL.
 */
export async function synthesizeSpeech(text: string): Promise<string | null> {
    // Limpiar texto para el URL y limitar longitud
    const cleanText = text.replace(/[*_`]/g, '').substring(0, 200); 
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=es&client=tw-ob`;
    
    const tempPath = path.join(process.cwd(), `response_${Date.now()}.mp3`);

    try {
        console.log(`[Voice] Generando audio de respuesta (TTS)...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0' // Google bloquea si no hay User-Agent
            }
        });

        if (!response.ok) throw new Error("Google TTS falló");

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(tempPath, Buffer.from(buffer));
        
        return tempPath;
    } catch (err) {
        console.error("[Voice] Error en TTS:", err);
        return null;
    }
}
