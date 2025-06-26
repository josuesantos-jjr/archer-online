import { mainGoogleBG } from '../service/googleBG.ts';
export async function identificarAgendamento(conversation, geminiKey, chatId, clientePath) {
    try {
        const promptAgendamento = `Identifique se há um agendamento na conversa a seguir e retorne a data e horário agendados e retorne exatamente data_agendada: "{data identificada}" e horario_agendado: "{horario identificado}". Preciso que retorne para a data dessa forma dd/mm/yyyy levando em consideração o dia de hojé e o horário atual, e para hora apenas os numeros de hora eminutos tipo 12:35. Conversa: ${conversation}`;
        const response = await mainGoogleBG({
            currentMessageBG: promptAgendamento,
            chatId,
            clearHistory: false,
            maxRetries: 3,
            __dirname: clientePath,
        });
        // Processar a resposta da IA para extrair data e horário agendados
        const regexData = /data_agendada: "(.*?)"/;
        const regexHorario = /horario_agendado: "(.*?)"/;
        const dataAgendada = response.match(regexData)?.[1] || '';
        const horarioAgendado = response.match(regexHorario)?.[1] || '';
        return { data_agendada: dataAgendada, horario_agendado: horarioAgendado };
    }
    catch (error) {
        console.error('Erro ao identificar agendamento:', error);
        return { data_agendada: '', horario_agendado: '' };
    }
}
