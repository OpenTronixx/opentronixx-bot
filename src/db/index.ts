import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { config } from '../config.js';
import fs from 'fs';

// Intentar extraer credenciales de variable de entorno (para la nube) o de archivo local (desarrollo)
const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

// Inicializar Firebase Admin SDK si no se ha inicializado
if (!getApps().length) {
    try {
        let credentialObj;

        if (serviceAccountEnv) {
            // Opción 1: Prioridad a la variable de entorno JSON (más seguro/fácil en Render)
            credentialObj = JSON.parse(serviceAccountEnv);
            console.log('[Firebase] Inicializando usando string JSON de entorno.');
        } else if (fs.existsSync(serviceAccountPath)) {
            // Opción 2: Leer desde archivo local (útil para desarrollo)
            credentialObj = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            console.log(`[Firebase] Inicializando usando archivo: ${serviceAccountPath}`);
        }

        if (credentialObj) {
            initializeApp({
                credential: cert(credentialObj),
                projectId: process.env.FIREBASE_PROJECT_ID || 'opentronixx',
            });
        } else {
            // Opción 3: Fallback a credenciales por defecto (si están configuradas en el entorno)
            console.warn('[Firebase] No se detectaron credenciales explícitas. Usando inicialización por defecto.');
            initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID || 'opentronixx',
            });
        }
    } catch (error) {
        console.error('[Firebase] Error crítico al inicializar SDK:', error);
        // Último intento sin credenciales explícitas
        if (!getApps().length) {
            initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID || 'opentronixx',
            });
        }
    }
}

export const db = getFirestore();

export interface MessageRow {
    id?: string;
    user_id: number;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_calls: string | null;
    tool_call_id: string | null;
    created_at: string;
}

export const dbService = {
    addMessage: async (
        userId: number, 
        role: string, 
        content: string | null, 
        toolCalls: any = null, 
        toolCallId: string | null = null
    ) => {
        const messageData = {
            user_id: userId,
            role,
            content: content || null,
            tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
            tool_call_id: toolCallId || null,
            created_at: FieldValue.serverTimestamp(),
        };

        // Guardamos en la colección principal "messages"
        await db.collection('messages').add(messageData);
    },

    getRecentMessages: async (userId: number, limit: number = 30): Promise<MessageRow[]> => {
        // Obtiene los últimos N mensajes del usuario ordenados cronológicamente
        const snapshot = await db.collection('messages')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();
        
        const rows: MessageRow[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            rows.push({
                id: doc.id,
                user_id: data.user_id,
                role: data.role,
                content: data.content,
                tool_calls: data.tool_calls,
                tool_call_id: data.tool_call_id,
                created_at: data.created_at ? data.created_at.toDate().toISOString() : new Date().toISOString()
            } as MessageRow);
        });
        
        return rows.reverse();
    },
    
    clearHistory: async (userId: number) => {
        const snapshot = await db.collection('messages')
            .where('user_id', '==', userId)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`[Firebase] Historial borrado para usuario ${userId}. Documentos: ${snapshot.size}`);
    }
};
