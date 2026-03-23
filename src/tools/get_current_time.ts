export const getCurrentTimeDef = {
    type: "function" as const,
    function: {
        name: "get_current_time",
        description: "Obtiene la hora y fecha local actual del sistema.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

export async function getCurrentTime(): Promise<string> {
    const now = new Date();
    return now.toISOString();
}
