import { saveMessageToFile } from '../util/saveMessage.ts';
import { processTriggers } from '../service/braim/gatilhos.ts';
export function splitMessages(text) {
    // Verifica se o texto contém os caracteres :, *, ;, - ou $
    if (/[:*;$*-]/.test(text)) {
        return splitSimpleMessages(text, true);
    }
    const blockPattern = /\*\*\*[\s\S]*?\*\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = blockPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return parts.flatMap(part => {
        if (part.startsWith("***") && part.endsWith("***")) {
            return part;
        }
        else {
            return splitSimpleMessages(part, false);
        }
    }).filter(part => part.trim() !== "");
}
function splitSimpleMessages(text, useSpecialSplit) {
    // Verifica se o texto contém *** (prioridade se useSpecialSplit for true)
    if (useSpecialSplit && text.includes('***')) {
        const parts = [];
        let lastIndex = 0;
        const regex = /\*\*\*/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index).trim());
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex).trim());
        }
        return parts.filter(part => part !== "");
    }
    // Se useSpecialSplit for true mas não contém ***, usa o splitPattern original
    if (useSpecialSplit) {
        const complexPattern = /(\([^\)]*\))|(http[s]?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+@[^\s]+\.[^\s]+)|(["'].*?["'])|(R\$\s*\d+(?:\.\d{3})*(?:,(?:[0-9]{2})))/g;
        const placeholders = text.match(complexPattern) ?? [];
        const placeholder = 'PLACEHOLDER_';
        let currentIndex = 0;
        const textWithPlaceholders = text.replace(complexPattern, () => `${placeholder}${currentIndex++}`);
        const splitPattern = /(?:[R$]\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*(?!\d))|[^.?!\n]+(?:[.?!\n]+["']?|(?<!\d|\d{1,3}(?:\.\d{3})+)[.](?!\d))/g;
        let parts = textWithPlaceholders.match(splitPattern) ?? [];
        if (placeholders.length > 0) {
            parts = parts.map((part) => {
                let currentPart = part;
                placeholders.forEach((val, idx) => {
                    currentPart = currentPart.replace(`${placeholder}${idx}`, val);
                });
                return currentPart;
            });
        }
        return parts;
    }
    // Se useSpecialSplit for false e não contém ***, divide por . ? !
    const parts = [];
    let currentPart = '';
    for (let i = 0; i < text.length; i++) {
        currentPart += text[i];
        if (['.', '?', '!'].includes(text[i])) {
            parts.push(currentPart.trim());
            currentPart = '';
        }
        else if (text[i] === '\n') {
            // Tratar quebras de linha como separadores de frase se não houver pontuação
            if (currentPart.trim() !== '') {
                parts.push(currentPart.trim());
            }
            currentPart = '';
        }
    }
    if (currentPart.trim() !== '') {
        parts.push(currentPart.trim());
    }
    return parts.filter(part => part !== "");
}
export async function sendMessagesWithDelay({ messages, client, targetNumber, __dirname, }) {
    console.log(`[sendMessagesWithDelay] Iniciando envio de mensagens para ${targetNumber}`);
    const messageQueue = messages.map((msg) => ({
        message: msg.replace(/\\n/g, '\n').trimStart(),
        delay: msg.length * 100,
    }));
    console.log(`[sendMessagesWithDelay] Fila de mensagens:`, messageQueue);
    async function sendMessageWithRetryAndTyping(client, messageData, __dirname, maxRetries = 3) {
        const { message, delay } = messageData;
        let retries = 0;
        console.log(`[sendMessageWithRetryAndTyping] Tentando enviar mensagem: "${message.substring(0, 50)}..." `); // Limita o log a 50 caracteres para evitar mensagens enormes no console
        while (retries < maxRetries) {
            try {
                console.log(`[sendMessageWithRetryAndTyping] Iniciando digitação (tentativa ${retries + 1})`);
                await client.startTyping(targetNumber);
                console.log(`[sendMessageWithRetryAndTyping] Aguardando delay de ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                console.log(`[sendMessageWithRetryAndTyping] Enviando mensagem (tentativa ${retries + 1})`);
                const result = await client.sendText(targetNumber, message);
                await client.stopTyping(targetNumber);
                await saveMessageToFile(targetNumber, message, `IA`, __dirname);
                // Processar gatilhos após envio da mensagem
                await processTriggers(client, targetNumber, message, __dirname);
                console.log(`[sendMessageWithRetryAndTyping] Mensagem enviada com sucesso`);
                return result;
            }
            catch (error) {
                retries++;
                console.error(`[sendMessageWithRetryAndTyping] Erro ao enviar mensagem (tentativa ${retries}):`, error);
                await client.stopTyping(targetNumber);
                const retryDelay = 2000 * retries;
                console.log(`[sendMessageWithRetryAndTyping] Tentando novamente em ${retryDelay / 1000} segundos...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        console.error(`[sendMessageWithRetryAndTyping] Falha ao enviar mensagem "${message.substring(0, 50)}..." após ${maxRetries} tentativas.`);
        await client.stopTyping(targetNumber);
        return null;
    }
    for (const messageData of messageQueue) {
        console.log(`[sendMessagesWithDelay] Processando mensagem da fila: "${messageData.message.substring(0, 50)}..."`);
        await sendMessageWithRetryAndTyping(client, messageData, __dirname);
    }
}
