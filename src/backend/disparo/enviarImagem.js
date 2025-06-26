import fs from 'node:fs';
// Função para enviar uma imagem
export const sendImage = async (client, chatId, imagePath, caption, message) => {
    try {
        // Verifica se a imagem existe
        if (!fs.existsSync(imagePath)) {
            throw new Error(`A imagem ${imagePath} não existe.`);
        }
        // Envia a imagem com a legenda e a mensagem
        await client.sendImage(chatId, imagePath, caption);
        // Envia a mensagem após a imagem
        await client.editMessage(chatId, message); // Use editMessage instead of sendMessage
        console.log(`Imagem enviada com sucesso para ${chatId}`);
    }
    catch (error) {
        console.error(`Erro ao enviar imagem para ${chatId}: ${error}`);
    }
};
