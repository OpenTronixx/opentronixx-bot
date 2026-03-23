import { askLLM, LLMMessage } from '../llm/client.js';
import { executeTool } from '../tools/registry.js';
import { dbService, MessageRow } from '../db/index.js';

const SYSTEM_PROMPT = `Eres OpenTronixx, un asistente de IA personal potente y seguro, operando a través de Telegram. 
Prioriza respuestas concisas, útiles y siempre en español (a menos que se te pida lo contrario).
Tienes acceso a herramientas y memoria persistente a través de una base de datos en la nube (Firestore).`;

const MAX_ITERATIONS = 5;

// Convertir de DB (MessageRow) a la interfaz del LLM
function formatHistory(rows: MessageRow[]): LLMMessage[] {
    return rows.map(r => {
        const msg: LLMMessage = {
            role: r.role as "system" | "user" | "assistant" | "tool",
            content: r.content
        };
        // Las herramientas guardadas en JSON deben ser restauradas
        if (r.tool_calls) {
            msg.tool_calls = JSON.parse(r.tool_calls);
        }
        if (r.tool_call_id) {
            msg.tool_call_id = r.tool_call_id;
        }
        if (msg.role === "tool") {
            msg.name = "get_current_time"; // Prevenir error estricto de Groq API
        }
        return msg;
    });
}

export async function runAgentLoop(userId: number, userMessage: string): Promise<string> {
    // 1. Guardar mensaje del usuario
    await dbService.addMessage(userId, 'user', userMessage);

    // 2. Cargar historial
    const historyRows = await dbService.getRecentMessages(userId, 20);
    const messages: LLMMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...formatHistory(historyRows)
    ];

    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
        iterations++;
        
        // Llamada al LLM
        const response = await askLLM(messages);
        const responseMessage = response.choices[0].message;

        messages.push(responseMessage);

        // Guardar la respuesta del assistant (usar || null evita errores si content es undefined)
        await dbService.addMessage(
            userId, 
            'assistant', 
            responseMessage.content || null, 
            responseMessage.tool_calls || null
        );

        // Si hay llamadas a herramientas
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            for (const toolCall of responseMessage.tool_calls) {
                const funcName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || "{}");

                try {
                    console.log(`[Agent] Ejecutando herramienta ${funcName} con argumentos:`, args);
                    const result = await executeTool(funcName, args);
                    const toolResultMsg: LLMMessage = {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: funcName,
                        content: typeof result === 'string' ? result : JSON.stringify(result)
                    };
                    
                    messages.push(toolResultMsg);
                    
                    // Guardar el resultado en la BD
                    await dbService.addMessage(
                        userId, 
                        'tool', 
                        toolResultMsg.content || null, 
                        null, 
                        toolCall.id
                    );

                } catch (err: any) {
                    console.error(`[Agent] Error en herramienta ${funcName}:`, err);
                    const errorMsg: LLMMessage = {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: funcName,
                        content: `Error al ejecutar herramienta: ${err.message}`
                    };
                    messages.push(errorMsg);
                    await dbService.addMessage(userId, 'tool', errorMsg.content || null, null, toolCall.id);
                }
            }
        } else {
            // Ya no hay tool calls, devolvemos el contenido final al usuario.
            return responseMessage.content || "Sin respuesta";
        }
    }

    return "He alcanzado el límite de iteraciones de lógica interna. Por favor, sé un poco más específico.";
}
