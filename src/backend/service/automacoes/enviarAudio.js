import fs from 'node:fs';
import path from 'node:path';
async function enviarAudio(client, chatId, clientePath) {
    // Ajustando o caminho para garantir que ele seja relativo ao diretório raiz do projeto
    const filePath = path.join(clientePath, 'config', 'abordagens', 'LISTA_PROSPEC', 'pitch de vendas.mp3');
    console.log(filePath); // Print the file path for verification
    if (fs.existsSync(filePath)) { // Check if the file exists
        try {
            await client.sendPtt(chatId, filePath, 'pitch de vendas.mp3', '');
            console.log('Áudio de pitch de vendas enviado para o chatID:', chatId);
        }
        catch (error) {
            console.error('Erro ao enviar áudio de pitch de vendas:', error);
        }
    }
    else {
        console.error('Arquivo de áudio não encontrado:', filePath);
    }
}
export { enviarAudio };
