import { config } from '../config.js';
import { toolsDefinition } from '../tools/registry.js';

export interface LLMMessage {
    role: "system" | "user" | "assistant" | "tool";
    content?: string | null;
    name?: string;
    tool_calls?: any[];
    tool_call_id?: string;
}

export async function askLLM(messages: LLMMessage[]) {
    const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
    const groqModel = "llama-3.3-70b-versatile"; 

    const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

    const payload = {
        model: groqModel,
        messages,
        tools: toolsDefinition,
        tool_choice: "auto",
        temperature: 0.7,
    };

    try {
        const response = await fetch(groqUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.llm.groqApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
            return await response.json();
        }

        console.warn(`[LLM] Groq falló con status ${response.status}. Intentando OpenRouter...`);
    } catch (e: any) {
        console.warn(`[LLM] Error llamando a Groq: ${e.message}. Intentando OpenRouter...`);
    }

    if (!config.llm.openRouterApiKey) {
        throw new Error("[LLM] Groq falló y no hay API Key de OpenRouter configurada.");
    }

    // Fallback a OpenRouter
    const fallbackPayload = {
        ...payload,
        model: config.llm.openRouterModel
    };
    
    const fallbackResponse = await fetch(openRouterUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.llm.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/opentronixx",
            "X-Title": "OpenTronixx"
        },
        body: JSON.stringify(fallbackPayload),
        signal: AbortSignal.timeout(15000)
    });

    if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        throw new Error(`[LLM] Fallback de OpenRouter también falló: ${fallbackResponse.status} - ${errorText}`);
    }

    return await fallbackResponse.json();
}
