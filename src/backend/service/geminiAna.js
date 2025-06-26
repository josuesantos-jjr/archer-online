// src/backend/service/geminiAna.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY não está definida nas variáveis de ambiente');
}
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-exp-03-25' });
export async function generateResponse(prompt, history, pageContent) {
    try {
        const systemInstruction = `Você é Ana, minha assistente virtual especializada neste sistema de gerenciamento de clientes. Seu objetivo é me ajudar a tomar as melhores decisões sobre meus clientes e projetos. Analise as informações disponíveis, incluindo o histórico de conversas, dados de clientes (quando fornecidos) e o conteúdo da página atual.

Suas principais funções são:
- Analisar conversas com contatos e sugerir melhorias na comunicação.
- Fornecer insights e relatórios sobre o progresso dos clientes.
- Responder perguntas sobre clientes, projetos e dados do sistema com base nas informações disponíveis.
- Ajudar na tomada de decisões estratégicas relacionadas aos clientes.

Seja proativa, analítica e forneça respostas claras e úteis. Lembre-se de usar o conteúdo da página atual como contexto adicional sempre que relevante.`;
        // Prepend system instruction to the history if it's not already there (or handle based on API specifics)
        // For Gemini, we often include it as the first 'user' or 'system' message, or use a dedicated parameter if available.
        // Let's add it as the first part of the history context for the model.
        const chatHistory = [
            // Representing system instruction - Gemini API might prefer 'user'/'model' pairs.
            // Let's try adding it implicitly before the user's first message if history is empty,
            // or structure it as part of the initial context.
            // A common pattern is to start with a user message containing the instruction,
            // followed by a model acknowledgment, but let's try prepending directly.
            { role: 'user', parts: [{ text: systemInstruction }] },
            {
                role: 'model',
                parts: [
                    { text: 'Entendido. Sou Ana, sua assistente. Como posso ajudar?' },
                ],
            },
            ...history.map((message) => ({
                // Append actual chat history
                role: message.role === 'assistant' ? 'model' : message.role,
                parts: [{ text: message.text }],
            })),
        ];
        const chat = model.startChat({
            history: chatHistory,
        });
        // Include page content in the user's prompt
        const enhancedPrompt = `Considerando o conteúdo da página atual:\n${pageContent}\n\n${prompt}`;
        const result = await chat.sendMessage(enhancedPrompt);
        const response = await result.response;
        return response.text();
    }
    catch (error) {
        console.error('Erro ao gerar resposta:', error);
        throw error;
    }
}
