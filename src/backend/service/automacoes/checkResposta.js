import fs from 'node:fs';
import path from 'node:path';
import { IgnoreLead } from '../braim/stop.ts';
export async function checkResposta(client, clientePath, chatId, answer) {
    const infoClientePath = path.join(clientePath, './config/infoCliente.json');
    const infoClienteRaw = fs.readFileSync(infoClientePath, 'utf-8');
    const infoCliente = JSON.parse(infoClienteRaw);
    const TARGET_CHAT_ID = infoCliente.TARGET_CHAT_ID || ``;
    // Verifica se houve a solicitação de exclusão e bloqueia o contato
    if (answer.includes("excluimos seu contato e não iremos mais mandar mensagens")) {
        console.log('ALERTA LGPD');
        try {
            await client.sendText(TARGET_CHAT_ID, `Alerta de LGPD ${chatId}`);
            const intervalo_aleatorio = Math.random() * (20 - 15) + 15;
            await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 10000));
            await IgnoreLead(chatId, clientePath);
            console.log(`Contato ${chatId} bloqueado com sucesso.`);
            await client.sendText(TARGET_CHAT_ID, `Contato bloqueado ${chatId}`);
            console.log(`Contato ${chatId} bloqueado com sucesso.`);
        }
        catch (error) {
            console.error(`Erro ao bloquear o contato ${chatId}:`, error);
        }
    }
    ;
    // Adicione outras verificações
}
;
