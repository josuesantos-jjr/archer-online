import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import fs from 'node:fs';
import path from 'node:path';
async function readJsonFile(filePath) {
    try {
        if (!existsSync(filePath)) {
            // Cria o arquivo com um objeto vazio se não existir
            writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
            return [];
        }
        const fileContent = readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
    }
    catch (error) {
        console.error('Erro ao ler ou criar o arquivo JSON:', error);
        return null;
    }
}
async function getLastSendMessage(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].fromMe === true) {
            return messages[i].content;
        }
    }
    return undefined;
}
async function checkForExistingMessage(lastSendMessage, chatMessages) {
    if (!chatMessages || chatMessages.length === 0) {
        return true; // Retorna true se o arquivo não existir ou estiver vazio
    }
    const iaMessages = chatMessages.filter((msg) => msg.type === "IA");
    if (iaMessages.length === 0) {
        return true; // Retorna true se não houver mensagens da IA
    }
    const lastIAMessage = iaMessages[iaMessages.length - 1].message.trim();
    if (lastSendMessage && !lastIAMessage.includes(lastSendMessage.trim())) {
        return false; // Retorna false apenas se houver mensagens da IA e lastSendMessage não estiver contida na última
    }
    return true;
}
export async function IgnoreLead(chatId, __dirname) {
    const messagesPath = join(__dirname, 'Chats', 'Historico', chatId, 'messagesCheck.json');
    const chatMessagesPath = join(__dirname, 'Chats', 'Historico', chatId, `${chatId}.json`);
    try {
        const messages = await readJsonFile(messagesPath);
        const chatMessages = await readJsonFile(chatMessagesPath);
        if (!chatMessages) {
            return undefined; // Retorna undefined se o arquivo de histórico não existir
        }
        const lastSendMessage = await getLastSendMessage(messages);
        const result = await checkForExistingMessage(lastSendMessage, chatMessages);
        if (result) {
            console.log("IA ainda esta atendendo o cliente ou arquivo não encontrado, ou sem mensagens IA");
            return undefined;
        }
        else {
            console.log("Atendimento já em andamento pelo celular!");
            await adicionarChatIdIgnorado(chatId, __dirname);
            console.log(chatId + " Lead ignorado!");
            return chatId + " Lead ignorado!";
        }
    }
    catch (error) {
        console.error('Erro ao ler os arquivos:', error);
        return undefined;
    }
}
async function adicionarChatIdIgnorado(chatId, __dirname) {
    const ignoredChatIdsFilePath = path.join(__dirname, 'config', 'ignoredChatIds.json');
    let ignoredChatIds = [];
    try {
        if (fs.existsSync(ignoredChatIdsFilePath)) {
            const ignoredChatIdsFileContent = fs.readFileSync(ignoredChatIdsFilePath, 'utf-8');
            ignoredChatIds = JSON.parse(ignoredChatIdsFileContent);
            console.log(`Arquivo ignoredChatIds.json carregado com sucesso!`);
        }
        else {
            // Explicitly create the file with an empty array if it doesn't exist
            fs.writeFileSync(ignoredChatIdsFilePath, JSON.stringify([], null, 2), 'utf-8');
            console.log(`Arquivo ignoredChatIds.json criado com sucesso!`);
        }
        if (!ignoredChatIds.includes(chatId)) {
            ignoredChatIds.push(chatId);
            fs.writeFileSync(ignoredChatIdsFilePath, JSON.stringify(ignoredChatIds, null, 2), 'utf-8');
            console.log(`ChatId ${chatId} adicionado ao ignoredChatIds.json com sucesso!`);
        }
    }
    catch (error) {
        console.error('Erro ao gerenciar ignoredChatIds.json:', error);
    }
}
