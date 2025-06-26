import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
dotenv.config();
const intervalo_aleatorio = Math.random() * (20 - 15) + 5;
const generationConfig = {
    temperature: 0.5,
    topP: 0.8,
    topK: 64,
    maxOutputTokens: 819200,
    responseMimeType: "text/plain",
};
const activeChats = new Map();
const getOrCreateChatSession = (chatId) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_AQ);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    console.log('activeChats.has(chatId)', activeChats.has(chatId));
    if (activeChats.has(chatId)) {
        const currentHistory = activeChats.get(chatId);
        console.log({ currentHistory, chatId });
        return model.startChat({
            history: currentHistory,
        });
    }
    const history = [
        {
            role: 'user',
            parts: [
                {
                    text: process.env.GEMINI_PROMPT ?? 'oi',
                },
            ],
        },
        {
            role: 'model',
            parts: [
                {
                    text: 'Olá, certo!',
                },
            ],
        },
    ];
    activeChats.set(chatId, history);
    return model.startChat({
        history,
    });
};
export const mainGoogleBG = async ({ currentMessageBG, chatId, clearHistory, maxRetries = 1, // Define o número máximo de tentativas
 }) => {
    let retries = 0;
    // Se todas as tentativas falharem, retorna um pedaço aleatório do AQ_PROMPT
    const promptParts = (process.env.AQ_PROMPT ?? 'Comece a história').split(/[.!?]/); // Divide o prompt em frases
    const randomIndex = Math.floor(Math.random() * promptParts.length); // Gera um índice aleatório
    const text = promptParts[randomIndex].trim(); // Retorna a frase aleatória
    return text;
};
// Função para obter a última mensagem enviada pela IA no chat
async function getLastMessageFromIA(chatId) {
    try {
        const filePath = path.join(process.cwd(), 'src', 'Chats', 'Historico', `${chatId}`, `${chatId}.json`);
        const data = await fs.promises.readFile(filePath, 'utf-8');
        const messages = JSON.parse(data);
        // Encontra a última mensagem enviada pela IA
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].type === 'IA') {
                return messages[i].message;
            }
        }
        console.log(`ultima mensagem: ${messages[messages.length - 1].message}`);
        // Se não encontrar nenhuma mensagem da IA, retorna null
        return ('oi');
    }
    catch (error) {
        console.error('Erro ao ler o arquivo de mensagens:', error);
        return ('oi');
    }
}
