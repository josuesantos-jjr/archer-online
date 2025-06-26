import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
dotenv.config();
const activeChats = new Map();
export async function initializeNewAIChatSession(chatId) {
    if (activeChats.has(chatId))
        return;
    activeChats.set(chatId, {});
}
export async function mainOpenAI({ currentMessage, chatId, }) {
    const clientePath = path.join(__dirname, '../../../clientes/ativos/Alpha');
    const openaiResponsesPath = path.join(clientePath, 'config/openai_responses.json');
    const openaiResponsesRaw = fs.readFileSync(openaiResponsesPath, 'utf-8');
    const openaiResponses = JSON.parse(openaiResponsesRaw);
    // Adapte a lógica para buscar a resposta predefinida com base no prompt
    let response = openaiResponses.summary_prompt[currentMessage] || 'Resposta predefinida';
    return response;
}
