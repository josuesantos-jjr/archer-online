// src/backend/followup/gerarMensagemFollowUp.ts
import { getFollowUpConfig } from './config.ts';
import { mainGoogleBG } from '../service/googleBG.ts';
import { getPasta } from '../disparo/disparo.ts';
/**
 * Gera a mensagem de follow-up usando IA.
 * @param clienteId - O ID do cliente.
 * @param chatId - O ID do chat.
 * @param level - O nível atual do follow-up.
 * @param conversationHistory - O histórico da conversa.
 * @returns {Promise<string | null>} - A mensagem gerada ou null em caso de erro.
 */
export async function gerarMensagemFollowUp(clienteId, chatId, level, conversationHistory) {
    const clientePath = getPasta(clienteId);
    if (!clientePath) {
        console.error(`[FollowUp Geração] Caminho inválido para cliente ${clienteId}`);
        return null;
    }
    try {
        const config = await getFollowUpConfig(clientePath);
        if (!config.ativo)
            return null; // Não gera se inativo
        let promptBase = '';
        if (config.promptGeral ||
            !config.promptsPorNivel ||
            config.promptsPorNivel.length < level ||
            !config.promptsPorNivel[level - 1]) {
            promptBase = config.prompt; // Usa prompt geral
        }
        else {
            promptBase = config.promptsPorNivel[level - 1]; // Usa prompt do nível
        }
        if (!promptBase) {
            console.error(`[FollowUp Geração] Prompt para nível ${level} não encontrado para cliente ${clienteId}.`);
            return null;
        }
        // Adiciona contexto ao prompt base
        const promptCompleto = `${promptBase}\n\nContexto da conversa anterior:\n${conversationHistory}\n\nInstrução: Gere APENAS a mensagem de follow-up.`;
        // A chave Gemini é global, não precisa buscar por cliente.
        // Chama a IA
        console.log(`[FollowUp Geração] Gerando mensagem nível ${level} para ${chatId} (Cliente: ${clienteId})...`);
        // Chama mainGoogleBG com clearHistory false
        const mensagemGerada = await mainGoogleBG({
            currentMessageBG: promptCompleto,
            chatId: chatId,
            clearHistory: false,
            __dirname: clientePath,
        });
        console.log(`[FollowUp Geração] Mensagem gerada para ${chatId}: ${mensagemGerada}`);
        return mensagemGerada.trim();
    }
    catch (error) {
        console.error(`[FollowUp Geração] Erro ao gerar mensagem de follow-up para ${chatId} (Cliente: ${clienteId}):`, error);
        return null;
    }
}
