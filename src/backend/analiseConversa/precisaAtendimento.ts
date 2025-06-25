import { mainGoogleBG } from './../service/googleBG.ts';
import path from 'path';
import fs from 'node:fs/promises';

const PROMPT_AT_HUMANO = "Você deve analisar a conversa e determinar se o cliente precisa de atendimento humano. Responda apenas 'sim' ou 'não'.";
const PROMPT_RESUMO_AT_HUMANO = "Gere um resumo conciso da conversa para notificar um atendente humano.";
const TARGET_CHATID = "XXXXXXXXXX@c.us"; // Substitua pelo chat ID do alvo
const GEMINI_PROMPT = "Utilize no máximo 200 caracteres para o resumo.";

async function precisaAtendimento(
  chatId: string,
  historicoConversa: string,
  client: any,
  clientePath: string
): Promise<void> {
  try {
    // Analisa se precisa de atendimento humano
    const promptAnalise = PROMPT_AT_HUMANO + 'segue orientação no sistema:' + GEMINI_PROMPT + 'Segue historico da conversa:' + historicoConversa;
    const responseAnalise = await mainGoogleBG({
        currentMessageBG: promptAnalise,
        chatId: chatId,
        clearHistory: false,
        __dirname: clientePath
    });

    if (responseAnalise.toLowerCase().includes('sim')) {
      // Gera o resumo da conversa
      const promptResumo = PROMPT_RESUMO_AT_HUMANO + 'segue orientação no sistema:' + GEMINI_PROMPT + 'Segue historico da conversa:' + historicoConversa;
      const summaryResponse = await mainGoogleBG({
        currentMessageBG: promptResumo,
        chatId: chatId,
        clearHistory: false,
        __dirname: clientePath
      });

      // Busca dados do cliente

      const dadosPath = path.join(clientePath, 'Chats', 'Historico', chatId, 'Dados.json');
      const dadosRaw = await fs.readFile(dadosPath, 'utf-8');
      const dados = JSON.parse(dadosRaw);
      const nomeClienteSimples = dados.name || 'Não identificado';

      // Busca lead atualizado
      let leadAtualizado = null;
      try {
          const leadPath = path.join(clientePath,'config','leads.json');
          const leadRaw = await fs.readFile(leadPath, 'utf-8');
          leadAtualizado = JSON.parse(leadRaw);
      } catch (error) {
          console.warn(`[precisaAtendimento] Arquivo leads.json não encontrado ou inacessível: ${error}`);
      }

      // Envia a notificação
      const mensagemNotificacao = `*Cliente precisa de atenção!* \n\n` +
                                  `*Cliente:* ${nomeClienteSimples}\n` +
                                  `*Nome:* ${leadAtualizado?.nome || 'Não identificado'}\n` +
                                  `*Telefone:* ${leadAtualizado?.telefone || chatId.split('@')[0]}\n` +
                                  (leadAtualizado?.listaOrigemNome ? `*Origem:* Lista "${leadAtualizado.listaOrigemNome}"\n` : '') +
                                  `*Resumo da Conversa:*\n${summaryResponse || 'Resumo não gerado.'}`; // Inclui o resumo

      await client.sendText(TARGET_CHATID, mensagemNotificacao);
      console.log(`[precisaAtendimento] Notificação enviada para ${TARGET_CHATID} sobre o chat ${chatId}`);
    } else {
      console.log(`[precisaAtendimento] Não foi identificado necessidade de atendimento humano para o chat ${chatId}`);
    }

  } catch (error) {
    console.error(`[precisaAtendimento] Erro ao analisar conversa ${chatId}:`, error);
  }
}

export { precisaAtendimento };