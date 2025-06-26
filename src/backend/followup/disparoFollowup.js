import * as fsSync from 'node:fs';
import path from 'node:path';
import { getDay, addDays } from 'date-fns';
import { gerarMensagemFollowUp } from './gerarMensagemFollowUp.ts';
import { getFollowUpConfig } from '../followup/config.ts';
import { getPasta } from '../disparo/disparo.ts';
import * as fs from 'node:fs/promises';
import { analisarNecessidadeFollowUp, removerFollowUp } from './analise.ts';
import { sendImage, sendPtt, sendVideo, sendFile } from '../disparo/enviarMidia.ts'; // Importar funções de envio de mídia
// Helper function to determine file type (copiada de src/backend/service/braim/gatilhos.ts)
const getFileType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        return 'image';
    }
    else if (['.mp3', '.wav', '.ogg', '.aac', '.opus'].includes(ext)) {
        return 'audio';
    }
    else if (['.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(ext)) {
        return 'video';
    }
    else if (['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
        return 'document';
    }
    return 'other';
};
export const dispararFollowupsAgendados = async (client, clienteIdCompleto, __dirname) => {
    console.log(`[dispararFollowupsAgendados] Iniciando...`);
    await analisarNecessidadeFollowUp(clienteIdCompleto);
    const clientePath = getPasta(clienteIdCompleto);
    if (!clientePath) {
        console.log(`[dispararFollowupsAgendados] Caminho inválido para cliente ${clienteIdCompleto}`);
        return;
    }
    try {
        const regrasFilePath = path.join(getPasta(clienteIdCompleto), 'config', 'regrasDisparo.json');
        let regras;
        try {
            const regrasContent = fsSync.readFileSync(regrasFilePath, 'utf-8');
            regras = JSON.parse(regrasContent);
        }
        catch (err) {
            console.log(`[dispararFollowupsAgendados] Erro ao ler regras de disparo para ${clienteIdCompleto}:`, err);
            return;
        }
        let horarioValido = false;
        if (regras && regras.DIA_INICIAL && regras.DIA_FINAL && regras.HORARIO_INICIAL && regras.HORARIO_FINAL) {
            horarioValido = diaDaSemanaValido(regras.DIA_INICIAL, regras.DIA_FINAL) && await dentroDoHorario(regras.HORARIO_INICIAL, regras.HORARIO_FINAL);
        }
        else {
            console.warn(`[dispararFollowupsAgendados] Regras de dia/horário incompletas para ${clienteIdCompleto}. Pulando verificação de horário.`);
            return;
        }
        if (!horarioValido) {
            console.log(`[dispararFollowupsAgendados] Fora do dia da semana ou horário permitido para ${clienteIdCompleto}. Pulando disparo de followups.`);
            return;
        }
        // Carrega followups do arquivo followups.json
        const followupsFilePath = path.join(clientePath, 'config', 'followups.json');
        let followups = [];
        try {
            if (fsSync.existsSync(followupsFilePath)) {
                const followupsContent = fsSync.readFileSync(followupsFilePath, 'utf-8');
                followups = JSON.parse(followupsContent);
            }
            else {
                console.log(`[dispararFollowupsAgendados] Arquivo followups.json não encontrado. Criando um novo.`);
                fsSync.writeFileSync(followupsFilePath, '[]', 'utf-8');
                followups = [];
            }
        }
        catch (err) {
            console.log(`[dispararFollowupsAgendados] Erro ao ler/criar arquivo de followups para ${clienteIdCompleto}:`, err);
            return;
        }
        for (const followup of followups) {
            const { chatid: chatId, nivel_followup: nivelAtual } = followup;
            const dadosFilePath = path.join(clientePath, 'Chats', 'Historico', chatId, 'Dados.json');
            let dados;
            let configFollowUp;
            try {
                const dadosContent = fsSync.readFileSync(dadosFilePath, 'utf-8');
                dados = JSON.parse(dadosContent);
                configFollowUp = await getFollowUpConfig(clientePath);
            }
            catch (err) {
                console.log(`[dispararFollowupsAgendados] Erro ao ler dados do chat ${chatId}:`, err);
                continue;
            }
            // Verifica o interesse do cliente
            if (dados?.interesse === 'não') {
                console.info(`[dispararFollowupsAgendados] Interesse é 'não' para ${chatId}. Removendo follow-up.`);
                await removerFollowUp(clientePath, chatId);
                continue;
            }
            // Verifica se o nível de follow-up é válido
            if (!nivelAtual) {
                console.warn(`[dispararFollowupsAgendados] Nível de follow-up não definido para ${chatId}. Pulando disparo.`);
                continue;
            }
            // Obtém o intervalo de dias para o nível atual
            const intervaloDias = configFollowUp.intervalosDias?.[nivelAtual - 1];
            if (intervaloDias === undefined) {
                console.warn(`[dispararFollowupsAgendados] Intervalo de dias não definido para o nível ${nivelAtual} para ${chatId}. Pulando disparo.`);
                continue;
            }
            // Calcula a data de disparo
            if (!dados.data_ultima_mensagem_enviada) {
                console.log(`[dispararFollowupsAgendados] data_ultima_mensagem_enviada não definida para ${chatId}.`);
                continue;
            }
            const dataUltimaMensagem = new Date(dados.data_ultima_mensagem_enviada);
            const dataDisparo = addDays(dataUltimaMensagem, intervaloDias);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas as datas
            if (dataDisparo > hoje) {
                console.log(`[dispararFollowupsAgendados] Ainda não é dia de disparar follow-up para ${chatId}. Próximo disparo em ${dataDisparo}.`);
                continue;
            }
            // Pega o histórico do chat
            const conversationHistory = await readLocalConversationHistory(clientePath, chatId);
            // Pega o prompt do nível
            let promptBase = '';
            if (configFollowUp.promptGeral) {
                promptBase = configFollowUp.prompt || '';
            }
            else if (configFollowUp.promptsPorNivel && configFollowUp.promptsPorNivel[nivelAtual - 1]) {
                promptBase = configFollowUp.promptsPorNivel[nivelAtual - 1];
            }
            else {
                console.log(`[dispararFollowupsAgendados] Prompt não encontrado para o nível ${nivelAtual} para ${chatId}.`);
                // Se não há prompt, mas há mídia, ainda podemos enviar a mídia.
                // Se não há prompt nem mídia, pulamos.
                if (!(configFollowUp.midiaPorNivel?.[nivelAtual - 1]?.ativado && configFollowUp.midiaPorNivel[nivelAtual - 1].arquivos.length > 0)) {
                    continue;
                }
            }
            // Gera a mensagem de follow-up (se houver prompt)
            let mensagemParaEnviar = null;
            if (promptBase) {
                mensagemParaEnviar = await gerarMensagemFollowUp(clienteIdCompleto, chatId, nivelAtual, conversationHistory);
            }
            if (!mensagemParaEnviar && promptBase) { // Se tinha prompt mas IA não gerou
                console.warn(`[dispararFollowupsAgendados] IA não gerou mensagem para ${chatId} (Nível ${nivelAtual}). Usando mensagem genérica.`);
                mensagemParaEnviar = "Olá, tudo bem? Passando para saber se você ainda tem interesse.";
            }
            const midiaConfig = configFollowUp.midiaPorNivel?.[nivelAtual - 1];
            const shouldSendMedia = midiaConfig?.ativado && midiaConfig.arquivos && midiaConfig.arquivos.length > 0;
            if (mensagemParaEnviar || shouldSendMedia) {
                if (mensagemParaEnviar) {
                    console.log(`[dispararFollowupsAgendados] Mensagem final para ${chatId}: ${mensagemParaEnviar.substring(0, 100)}...`);
                }
                else {
                    console.log(`[dispararFollowupsAgendados] Nenhuma mensagem de texto para enviar para ${chatId}, apenas mídia.`);
                }
                try {
                    if (mensagemParaEnviar) {
                        await client.sendText(chatId, mensagemParaEnviar);
                        console.log(`[dispararFollowupsAgendados] Mensagem enviada com sucesso para ${chatId}.`);
                        // Salva a mensagem no histórico
                        await saveMessageToFile(clientePath, chatId, mensagemParaEnviar, 'IA');
                        console.log(`[dispararFollowupsAgendados] Histórico local salvo para ${chatId}.`);
                    }
                    // Enviar mídia se configurado para o nível atual
                    if (shouldSendMedia) {
                        console.log(`[dispararFollowupsAgendados] Enviando mídia para o nível ${nivelAtual} para ${chatId}.`);
                        for (let i = 0; i < midiaConfig.arquivos.length; i++) {
                            const arquivoRelativo = midiaConfig.arquivos[i];
                            const tipoMidia = midiaConfig.tipos[i];
                            const mediaFilePath = path.join(clientePath, arquivoRelativo); // Caminho absoluto da mídia
                            if (!fsSync.existsSync(mediaFilePath)) {
                                console.error(`[dispararFollowupsAgendados] Arquivo de mídia não encontrado: ${mediaFilePath}. Pulando.`);
                                continue;
                            }
                            try {
                                switch (tipoMidia) {
                                    case 'image':
                                        await sendImage(client, chatId, mediaFilePath);
                                        break;
                                    case 'audio':
                                        await sendPtt(client, chatId, mediaFilePath);
                                        break;
                                    case 'video':
                                        await sendVideo(client, chatId, mediaFilePath);
                                        break;
                                    case 'document':
                                        await sendFile(client, chatId, mediaFilePath);
                                        break;
                                    default:
                                        console.warn(`[dispararFollowupsAgendados] Tipo de mídia desconhecido para ${arquivoRelativo}: ${tipoMidia}.`);
                                }
                                console.log(`[dispararFollowupsAgendados] Mídia ${arquivoRelativo} enviada com sucesso para ${chatId}.`);
                            }
                            catch (mediaSendError) {
                                console.error(`[dispararFollowupsAgendados] Erro ao enviar mídia ${arquivoRelativo} para ${chatId}:`, mediaSendError);
                            }
                        }
                    }
                    // Atualiza o updateLastSentMessageDate no dados.json
                    // Atualiza a data da última mensagem enviada diretamente no objeto dados
                    dados.data_ultima_mensagem_enviada = new Date().toISOString();
                    console.log(`[dispararFollowupsAgendados] data_ultima_mensagem_enviada atualizada para ${chatId}.`);
                    // Atualiza o nível de follow-up
                    const proximoNivel = nivelAtual + 1;
                    dados.nivel_followup = proximoNivel.toString();
                    await fs.writeFile(dadosFilePath, JSON.stringify(dados, null, 2), 'utf-8');
                    // Atualiza o nível de follow-up no followups.json
                    followup.nivel_followup = proximoNivel;
                    await fs.writeFile(followupsFilePath, JSON.stringify(followups, null, 2), 'utf-8');
                }
                catch (sendError) {
                    console.log(`[dispararFollowupsAgendados] Erro ao enviar mensagem ou mídia para ${chatId}:`, sendError);
                }
            }
            else {
                console.warn(`[dispararFollowupsAgendados] Nenhuma mensagem ou mídia para enviar para ${chatId}. Pulando disparo.`);
            }
        }
    }
    catch (error) {
        console.log('[dispararFollowupsAgendados] Erro geral ao verificar e disparar followups:', error);
    }
};
function diaDaSemanaValido(diaInicial, diaFinal) {
    const diasDaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const hoje = getDay(new Date());
    const indexDiaInicial = diasDaSemana.indexOf(diaInicial.toLowerCase());
    const indexDiaFinal = diasDaSemana.indexOf(diaFinal.toLowerCase());
    if (indexDiaInicial === -1 || indexDiaFinal === -1) {
        console.log("Dias inicial ou final inválidos nas regras de disparo.");
        return false;
    }
    if (indexDiaInicial <= indexDiaFinal) {
        return hoje >= indexDiaInicial && hoje <= indexDiaFinal;
    }
    else {
        return hoje >= indexDiaInicial || hoje <= indexDiaFinal;
    }
}
async function dentroDoHorario(horarioInicial, horarioFinal) {
    const agora = new Date();
    const inicio = new Date(agora);
    const fim = new Date(agora);
    let [horaInicialNum, minutoInicialNum] = horarioInicial.split(':').map(Number);
    let [horaFinalNum, minutoFinalNum] = horarioFinal.split(':').map(Number);
    inicio.setHours(horaInicialNum, minutoInicialNum, 0, 0);
    fim.setHours(horaFinalNum, minutoFinalNum, 59, 999);
    if (fim < inicio) {
        return agora >= inicio || agora <= fim;
    }
    else {
        return agora >= inicio && agora <= fim;
    }
}
async function readLocalConversationHistory(clientePath, chatId) {
    const filePath = path.join(clientePath, `Chats`, `Historico`, chatId, `${chatId}.json`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const messagesFromFile = JSON.parse(fileContent);
        if (Array.isArray(messagesFromFile)) {
            return messagesFromFile.map(m => `${m.type}: ${m.message}`).join('\n');
        }
        console.warn(`[readLocalConversationHistory] Conteúdo de ${filePath} não é um array de mensagens.`);
        return '';
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`[readLocalConversationHistory] Arquivo de histórico local não encontrado em ${filePath}.`);
            return '';
        }
        console.log(`[readLocalConversationHistory] Erro ao ler histórico local ${filePath}:`, error);
        return '';
    }
}
async function saveMessageToFile(clientePath, chatId, message, type) {
    const chatDir = path.join(clientePath, `Chats`, `Historico`, chatId);
    const fileName = `${chatId}.json`;
    const filePath = path.join(clientePath, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
    try {
        await fs.mkdir(chatDir, { recursive: true });
        const dadosFilePath = path.join(clientePath, `Chats`, `Historico`, `${chatId}`, `Dados.json`);
        if (!fsSync.existsSync(dadosFilePath)) {
            console.log(`Criando arquivo Dados.json para o chatId:`, chatId);
            await fs.writeFile(dadosFilePath, `{}`, `utf-8`);
        }
        const now = new Date();
        const date = now.toLocaleDateString(`pt-BR`);
        const time = now.toLocaleTimeString(`pt-BR`, { hour: `2-digit`, minute: `2-digit`, second: `2-digit` });
        const messageData = {
            date: date,
            time: time,
            type: type,
            message: message,
        };
        let messages = [];
        if (fsSync.existsSync(filePath)) {
            try {
                const fileContent = await fs.readFile(filePath, `utf-8`);
                messages = JSON.parse(fileContent);
                if (!Array.isArray(messages)) {
                    console.warn(`Conteúdo de ${filePath} não era um array, resetando.`);
                    messages = [];
                }
            }
            catch (e) {
                console.log(`Erro ao ler/parsear ${filePath}, resetando. Erro: ${e}`);
                messages = [];
            }
        }
        messages.push(messageData);
        try {
            await fs.writeFile(filePath, JSON.stringify(messages, null, 2), `utf-8`);
        }
        catch (e) {
            console.log(`Erro ao escrever em ${filePath}: ${e}`);
        }
    }
    catch (dirError) {
        console.log(`Erro ao criar diretório ou arquivo para chatId ${chatId}:`, dirError);
    }
}
