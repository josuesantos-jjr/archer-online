import { type ChatSession, GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();
const intervalo_aleatorio = Math.random() * (20 - 15) + 5;


const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_CHAT!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const generationConfig = {
  temperature: 0.5,
  topP: 0.8,
  topK: 64,
  maxOutputTokens: 819200,
  responseMimeType: "text/plain",
};
const activeChats = new Map();

const getOrCreateChatSession = (chatId: string): ChatSession => {
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
      parts: [{ text: process.env.GEMINI_PROMPT ?? 'oi' }],
    },
    {
      role: 'model',
      parts: [{ text: 'Olá, certo!' }],
    },
  ];
  activeChats.set(chatId, history);
  return model.startChat({
    history,
  });
};

export const mainGoogleChat = async ({
  currentMessageChat,
  chatId,
  clearHistory,
  maxRetries = 500, // Define o número máximo de tentativas
  __dirname
}: {
  currentMessageChat: string;
  chatId: string;
  clearHistory: boolean;
  maxRetries?: number; // Parâmetro opcional para definir o número máximo de tentativas
  __dirname: string
}): Promise<string> => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const chat = getOrCreateChatSession(chatId);
      const prompt = currentMessageChat;
      const result = await chat.sendMessage(prompt);

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
      text.includes('[500 Internal Server Error]')      
      ) {
        console.log('Resposta contém caracteres indesejados, refazendo a requisição...');
        // Refaz a requisição com o mesmo prompt
        text = await mainGoogleChat({
          currentMessageChat: prompt,
          chatId,
          clearHistory,
          maxRetries,
          __dirname
        });
      }      

      // Verifica se a resposta é repetida
      const lastMessage = await getLastMessageFromIA(chatId, __dirname);
      const intervalo_aleatorio = Math.random() * (20 - 15) + 15;

      if (text === lastMessage) {
        console.log(`Mensagem repetida: ${text}, Refazendo a requisição em ${intervalo_aleatorio} segundos...`);
        await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));

        const gereOutraresposta= ('Gere uma resposta diferente, utilize outras palavras mas de uma resposta diferente que faça sentido com o assunto. é extremamente importante que você não repita a mesma frase. É extremamente importante que você responda como se fosse uma pessoa real');
        const NovaResposta = `${prompt}. ${gereOutraresposta}`;

        // Refaz a requisição com o mesmo prompt
        text = await mainGoogleChat({
          currentMessageChat: NovaResposta,
          chatId,
          clearHistory,
          maxRetries,
          __dirname
        });
      }

      if (clearHistory) {
        activeChats.delete(chatId); // Remove o histórico se clearHistory for true
      } else {
        activeChats.set(chatId, [
          ...activeChats.get(chatId),
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
          {
            role: 'model',
            parts: [{ text: text }],
          },
        ]);
      }

      

      console.log('Resposta Gemini: ', text);
      return text;
    } catch (error) {
      console.error('Erro ao processar a mensagem GoogleFollow:', error);
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
async function getLastMessageFromIA(chatId: string, __dirname: string): Promise<string | null> {
  try {
    const filePath = path.join(__dirname, 'Chats', 'Historico', `${chatId}`, `${chatId}.json`)
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
  } catch (error) {
    console.error('Erro ao ler o arquivo de mensagens:', error);
    return null;
  }
}