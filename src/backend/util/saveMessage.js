import * as fs from 'fs';
import * as path from 'path';
export async function saveMessageToFile(chatId, message, type, __dirname) {
    const chatDir = path.join(__dirname, `Chats`, `Historico`, chatId);
    const fileName = `${chatId}.json`;
    const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
    // Cria o diretório se ele não existir
    if (!fs.existsSync(chatDir)) {
        console.log(`Criando diretório para o chatId:`, chatId);
        fs.mkdirSync(chatDir, { recursive: true });
    }
    // Cria o arquivo Dados.json se ele não existir
    const dadosFilePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `Dados.json`);
    if (!fs.existsSync(dadosFilePath)) {
        console.log(`Criando arquivo Dados.json para o chatId:`, chatId);
        fs.writeFileSync(dadosFilePath, `{}`, `utf-8`); // Cria um arquivo vazio
    }
    // Formata a data e a hora
    const now = new Date();
    const date = now.toLocaleDateString(`pt-BR`);
    const time = now.toLocaleTimeString(`pt-BR`, { hour: `2-digit`, minute: `2-digit`, second: `2-digit` });
    // Formata a mensagem
    const formattedMessage = `${type === `User` ? `User` : `Model`} ${time}: ${message}`;
    // Cria o objeto JSON da mensagem
    const messageData = {
        date: date,
        time: time,
        type: type,
        message: message,
    };
    // Verifica se o arquivo já existe
    let messages = [];
    if (fs.existsSync(filePath)) {
        console.log(`Arquivo já existe, lendo conteúdo...`);
        const fileContent = fs.readFileSync(filePath, `utf-8`);
        messages = JSON.parse(fileContent);
    }
    // Adiciona a nova mensagem ao array
    messages.push(messageData);
    // Escreve o array JSON no arquivo
    console.log(`Escrevendo mensagem no arquivo:`);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), `utf-8`); // Adiciona a formatação com 2 espaços de indentação
}
