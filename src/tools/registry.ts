import { getCurrentTime, getCurrentTimeDef } from './get_current_time.js';

export const toolsDefinition = [
    getCurrentTimeDef,
];

export async function executeTool(name: string, args: any): Promise<any> {
    switch (name) {
        case "get_current_time":
            return await getCurrentTime();
        default:
            throw new Error(`[Tools] Herramienta desconocida: ${name}`);
    }
}
