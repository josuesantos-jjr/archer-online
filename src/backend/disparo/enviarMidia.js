import path from 'node:path';
// Função para enviar imagem (adaptada)
export const sendImage = async (client, chatId, filePath, caption = '', messageId) => {
    try {
        if (typeof client.sendImage === 'function') {
            await client.sendImage(chatId, filePath, path.basename(filePath), caption, messageId);
            console.log(`Imagem enviada com sucesso para:`, chatId);
        }
        else {
            console.error("client.sendImage is not a function");
            throw new Error("client.sendImage is not a function");
        }
    }
    catch (error) {
        console.error(`Erro ao enviar imagem para ${chatId}:`, error);
        throw error; // Propaga o erro para ser tratado na função de disparo
    }
};
// Função para enviar áudio como PTTS
export const sendPtt = async (client, chatId, filePath) => {
    try {
        if (typeof client.sendPtt === 'function') { // Verifica se sendPtt existe
            // Wppconnect geralmente espera o caminho do arquivo para sendPtt/sendPtt
            await client.sendPtt(chatId, filePath);
            console.log(`Áudio (PTT) enviado com sucesso para:`, chatId);
        }
        else {
            // Se sendPtt não existir, tentar sendPtt com base64 (menos comum para arquivos locais)
            // const base64Data = fsSync.readFileSync(filePath, { encoding: 'base64' });
            // await client.sendPtt(chatId, base64Data, path.basename(filePath));
            console.error("client.sendPtt is not a function. sendPtt with base64 not implemented here.");
            throw new Error("client.sendPtt is not a function.");
        }
    }
    catch (error) {
        console.error(`Erro ao enviar áudio (PTT) para ${chatId}:`, error);
        throw error; // Propaga o erro para ser tratado na função de disparo
    }
};
export const sendVideo = async (client, chatId, filePath, caption = '') => {
    try {
        if (typeof client.sendVideo === 'function') {
            await client.sendVideo(chatId, filePath, path.basename(filePath), caption);
            console.log(`Vídeo enviado com sucesso para:`, chatId);
        }
        else {
            console.error("client.sendVideo is not a function");
            throw new Error("client.sendVideo is not a function");
        }
    }
    catch (error) {
        console.error(`Erro ao enviar vídeo para ${chatId}:`, error);
        throw error;
    }
};
export const sendFile = async (client, chatId, filePath, caption = '') => {
    try {
        if (typeof client.sendFile === 'function') {
            await client.sendFile(chatId, filePath, path.basename(filePath), caption);
            console.log(`Arquivo enviado com sucesso para:`, chatId);
        }
        else {
            console.error("client.sendFile is not a function");
            throw new Error("client.sendFile is not a function");
        }
    }
    catch (error) {
        console.error(`Erro ao enviar arquivo para ${chatId}:`, error);
        throw error;
    }
};
