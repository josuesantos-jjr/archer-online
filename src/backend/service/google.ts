import { type ChatSession, GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);
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

export const mainGoogle = async ({
  currentMessage,
  chatId,
}: {
  currentMessage: string;
  chatId: string;
}): Promise<string> => {
  const chat = getOrCreateChatSession(chatId);
  const prompt = currentMessage;
  const result = await chat.sendMessage(prompt);
  const response = await result.response;
  const text = response.text();

  activeChats.set(chatId, [
    ...activeChats.get(chatId),
    {
      role: 'user',
      parts: [
        {
          text: prompt,
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

  console.log('Resposta Gemini: ', text);
  return text;
};
