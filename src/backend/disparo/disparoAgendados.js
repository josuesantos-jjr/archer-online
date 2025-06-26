import * as fs from 'node:fs/promises';
import path from 'node:path';
import { mainGoogleAG } from '../service/googleAG.ts';
import { processTriggers } from '../service/braim/gatilhos.ts';
export async function disparoAgendados(client, clientePath) {
    try {
        const agendamentosPath = path.join(clientePath, 'config', 'agendamentos.json');
        const agendamentosRaw = await fs.readFile(agendamentosPath, 'utf-8');
        const agendamentos = JSON.parse(agendamentosRaw);
        const dataAtual = new Date().toLocaleDateString('pt-BR');
        const dataHoraAtual = new Date();
        for (const agendamento of agendamentos.agendamentos) {
            for (const detalhes of agendamento.detalhes_agendamento) {
                console.log(`Verificando agendamento para ${agendamento.chatId} - Data: ${detalhes.data_agendada} - Horário: ${detalhes.horario_agendado}`);
                if (detalhes.data_agendada === dataAtual && detalhes.agendamento_identificado === 'sim') {
                    console.log(`Agendamento encontrado para hoje: ${agendamento.chatId} - Data: ${detalhes.data_agendada} - Horário: ${detalhes.horario_agendado}`);
                    const [hora, minuto] = detalhes.horario_agendado.split(':');
                    const horarioDisparo = new Date(dataHoraAtual.getFullYear(), dataHoraAtual.getMonth(), dataHoraAtual.getDate(), parseInt(hora), parseInt(minuto), 0);
                    const tempoEspera = horarioDisparo.getTime() - dataHoraAtual.getTime();
                    if (tempoEspera <= 0) {
                        console.log(`Horário de disparo já passou. Disparando mensagem para ${agendamento.chatId}`);
                        const mensagem = await mainGoogleAG({
                            currentMessageBG: 'Mensagem de agendamento',
                            chatId: agendamento.chatId,
                            clearHistory: false,
                            maxRetries: 3,
                            __dirname: clientePath,
                        });
                        await client.sendText(agendamento.chatId, mensagem);
                        await processTriggers(client, agendamento.chatId, mensagem, __dirname);
                        detalhes.agendamento_realizado = 'sim';
                        detalhes.data_ultima_mensagem_enviada = new Date().toISOString();
                        const dadosPath = path.join(clientePath, 'Chats', 'Historico', agendamento.chatId, 'Dados.json');
                        const dadosRaw = await fs.readFile(dadosPath, 'utf-8');
                        const dados = JSON.parse(dadosRaw);
                        dados.detalhes_agendamento = dados.detalhes_agendamento.map((d) => {
                            if (d.data_agendada === detalhes.data_agendada && d.horario_agendado === detalhes.horario_agendado) {
                                return detalhes;
                            }
                            return d;
                        });
                        await fs.writeFile(dadosPath, JSON.stringify(dados, null, 2), 'utf-8');
                        agendamentos.agendamentos = agendamentos.agendamentos.filter((a) => a.chatId !== agendamento.chatId);
                    }
                    else {
                        console.log(`Agendamento agendado para ${detalhes.horario_agendado}. Aguardando ${tempoEspera}ms para disparo.`);
                        setTimeout(async () => {
                            const mensagem = await mainGoogleAG({
                                currentMessageBG: 'Mensagem de agendamento',
                                chatId: agendamento.chatId,
                                clearHistory: false,
                                maxRetries: 3,
                                __dirname: clientePath,
                            });
                            await client.sendText(agendamento.chatId, mensagem);
                            await processTriggers(client, agendamento.chatId, mensagem, __dirname);
                            detalhes.agendamento_realizado = 'sim';
                            detalhes.data_ultima_mensagem_enviada = new Date().toISOString();
                            const dadosPath = path.join(clientePath, 'Chats', 'Historico', agendamento.chatId, 'Dados.json');
                            const dadosRaw = await fs.readFile(dadosPath, 'utf-8');
                            const dados = JSON.parse(dadosRaw);
                            dados.detalhes_agendamento = dados.detalhes_agendamento.map((d) => {
                                if (d.data_agendada === detalhes.data_agendada && d.horario_agendado === detalhes.horario_agendado) {
                                    return detalhes;
                                }
                                return d;
                            });
                            await fs.writeFile(dadosPath, JSON.stringify(dados, null, 2), 'utf-8');
                            agendamentos.agendamentos = agendamentos.agendamentos.filter((a) => a.chatId !== agendamento.chatId);
                            await fs.writeFile(agendamentosPath, JSON.stringify(agendamentos, null, 2), 'utf-8');
                        }, tempoEspera);
                    }
                }
                else if (detalhes.data_agendada < dataAtual && detalhes.agendamento_identificado === 'sim' && detalhes.agendamento_realizado !== 'sim') {
                    console.log(`Disparando mensagem atrasada para ${agendamento.chatId} - Data: ${detalhes.data_agendada} - Horário: ${detalhes.horario_agendado}`);
                    const mensagem = await mainGoogleAG({
                        currentMessageBG: 'Mensagem de agendamento',
                        chatId: agendamento.chatId,
                        clearHistory: false,
                        maxRetries: 3,
                        __dirname: clientePath,
                    });
                    await client.sendText(agendamento.chatId, mensagem);
                    await processTriggers(client, agendamento.chatId, mensagem, __dirname);
                    detalhes.agendamento_realizado = 'sim';
                    detalhes.data_ultima_mensagem_enviada = new Date().toISOString();
                    const dadosPath = path.join(clientePath, 'Chats', 'Historico', agendamento.chatId, 'Dados.json');
                    const dadosRaw = await fs.readFile(dadosPath, 'utf-8');
                    const dados = JSON.parse(dadosRaw);
                    dados.detalhes_agendamento = dados.detalhes_agendamento.map((d) => {
                        if (d.data_agendada === detalhes.data_agendada && d.horario_agendado === detalhes.horario_agendado) {
                            return detalhes;
                        }
                        return d;
                    });
                    await fs.writeFile(dadosPath, JSON.stringify(dados, null, 2), 'utf-8');
                    agendamentos.agendamentos = agendamentos.agendamentos.filter((a) => a.chatId !== agendamento.chatId);
                }
            }
        }
        await fs.writeFile(agendamentosPath, JSON.stringify(agendamentos, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('Erro ao disparar agendamentos:', error);
    }
}
