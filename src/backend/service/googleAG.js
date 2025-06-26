import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs';
import path from 'node:path';
const activeChats = new Map();
const getOrCreateChatSession = (chatId, __dirname) => {
    const configPath = path.join(__dirname, './config/infoCliente.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const intervalo_aleatorio = Math.random() * (20 - 15) + 5;
    const genAI = new GoogleGenerativeAI(config.GEMINI_KEY_CHAT);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const generationConfig = {
        temperature: 0.5,
        topP: 0.8,
        topK: 64,
        maxOutputTokens: 819200,
        responseMimeType: 'text/plain',
    };
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
                    text: Array.isArray(config.GEMINI_PROMPT)
                        ? config.GEMINI_PROMPT.map((item) => {
                            // Concatena todos os valores de cada objeto em uma string
                            return Object.values(item).join('\n');
                        }).join('\n\n') // Junta os prompts de cada objeto com duas quebras de linha
                        : config.GEMINI_PROMPT ?? 'oi', // Mantém compatibilidade com string antiga
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
export const mainGoogleAG = async ({ currentMessageBG, chatId, clearHistory, maxRetries = 500, // Define o número máximo de tentativas
__dirname, }) => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const chat = getOrCreateChatSession(chatId, __dirname);
            const configPath = path.join(__dirname, './config/infoCliente.json');
            const dadosPath = JSON.parse(fs.readFileSync(path.join(__dirname, 'Chats', 'Historico', chatId, 'Dados.json'), 'utf-8'));
            const clientConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')); // Renomeado para clientConfig para evitar conflito
            const promptAgendamento = clientConfig.PROMPT_AGENDAMENTO || ``;
            const name = dadosPath.name;
            const promptParts = [{ text: currentMessageBG + '\n\n' + promptAgendamento + '\n\n' + name }]; // Crie um array de Part
            const result = await chat.sendMessage(promptParts); // Passe o array de Part
            // Verificar se a resposta da API está no formato esperado
            if (!result || !result.response) {
                throw new Error('Resposta inválida da API Gemini.');
            }
            const response = result.response;
            let text = response.text();
            // Verifica se a resposta contém os caracteres indesejados
            if (text.includes('{\n') ||
                text.includes('429 Too Many Requests') ||
                text.includes('503 Service Unavailable') ||
                text.includes('messageBufferPerChatId.get is not a function') ||
                text.includes('[500 Internal Server Error]')) {
                console.log('Resposta contém caracteres indesejados, refazendo a requisição...');
                // Refaz a requisição com o mesmo prompt
                text = await mainGoogleAG({
                    currentMessageBG: currentMessageBG,
                    chatId,
                    clearHistory,
                    maxRetries,
                    __dirname,
                });
            }
            // Verifica se a resposta é repetida
            const lastMessage = await getLastMessageFromIA(chatId, __dirname);
            const intervalo_aleatorio = Math.random() * (20 - 15) + 15;
            if (text === lastMessage) {
                console.log(`Mensagem repetida: ${text}, Refazendo a requisição em ${intervalo_aleatorio} segundos...`);
                await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
                const gereOutraresposta = 'Gere uma resposta diferente, utilize outras palavras mas de uma resposta diferente que faça sentido com o assunto. é extremamente importante que você não repita a mesma frase. É extremamente importante que você responda como se fosse uma pessoa real'; // Mantido
                const NovaResposta = `${currentMessageBG}. ${gereOutraresposta}`; // Usar currentMessageBG original
                // Refaz a requisição com o mesmo prompt
                text = await mainGoogleAG({
                    currentMessageBG: NovaResposta,
                    chatId,
                    clearHistory,
                    maxRetries,
                    __dirname,
                });
            }
            if (clearHistory) {
                activeChats.delete(chatId); // Remove o histórico se clearHistory for true
            }
            else {
                activeChats.set(chatId, [
                    ...activeChats.get(chatId),
                    {
                        role: 'user',
                        parts: [
                            {
                                text: currentMessageBG, // Usar currentMessageBG original
                            },
                        ],
                    },
                    {
                        role: 'model',
                        parts: [
                            {
                                text: text,
                            },
                        ],
                    },
                ]);
            }
            console.log('Resposta Gemini: ', text);
            return text;
        }
        catch (error) {
            console.error('Erro ao processar a mensagem GoogleBG:', error);
            retries++;
            console.log(`Tentativa ${retries} de ${maxRetries}...`);
            // Aguarda um tempo antes de tentar novamente
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
    // Se todas as tentativas falharem, retorna uma mensagem de erro
    return 'Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.';
};
// Função para obter a última mensagem enviada pela IA no chat
async function getLastMessageFromIA(chatId, __dirname) {
    try {
        const filePath = path.join(__dirname, 'Chats', 'Historico', `${chatId}`, `${chatId}.json`);
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
        return null;
    }
    catch (error) {
        console.error('Erro ao ler o arquivo de mensagens:', error);
        return null;
    }
}
