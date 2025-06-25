import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import path from 'node:path';
import { getPasta } from '../disparo/disparo.ts';

/**
 * Analisa a necessidade de follow-up para todos os chats de um cliente.
 * @param clienteId - O ID do cliente.
 */
export async function analisarNecessidadeFollowUp(clienteId: string): Promise<void> {
  const clientePath = getPasta(clienteId);
  if (!clientePath) {
    console.error(`[FollowUp Analise] Caminho inválido para cliente ${clienteId}`);
    return;
  }

  const dadosDir = path.join(clientePath, 'Chats', 'Historico');
  try {
    const chatIds = await getChatIds(dadosDir);

    for (const chatId of chatIds) {
      const dadosPath = path.join(dadosDir, chatId, 'Dados.json');
      const followupPath = path.join(clientePath, 'config', 'followups.json');
      try {
        const dadosContent = await fs.readFile(dadosPath, 'utf-8');
        const dados = JSON.parse(dadosContent);

        if (dados?.interesse === 'não') {
          console.info(`[FollowUp Analise] Interesse é 'não' para ${chatId}. Removendo follow-up.`);
          await removerFollowUp(clientePath, chatId);
          continue;
        }

        if (!dados?.nivel_followup) {
          console.info(`[FollowUp Analise] Criando nivel_followup para ${chatId}.`);
          dados.nivel_followup = '1';
          await fs.writeFile(dadosPath, JSON.stringify(dados, null, 2), 'utf-8');

          // Atualiza o arquivo followups.json
          try {
            const followupPath = path.join(clientePath, 'config', 'followups.json');
            let followups: any[] = [];
            if (fsSync.existsSync(followupPath)) {
              const followupContent = await fs.readFile(followupPath, 'utf-8');
              followups = JSON.parse(followupContent);
            }

            const newFollowup = {
              chatid: chatId,
              nivel_followup: 1,
            };

            followups.push(newFollowup);
            await fs.writeFile(followupPath, JSON.stringify(followups, null, 2), 'utf-8');
            console.info(`[FollowUp Analise] Follow-up adicionado para ${chatId} em ${followupPath}.`);
          } catch (err) {
            console.error(`[FollowUp Analise] Erro ao atualizar followups.json para ${chatId}:`, err);
          }
        }

      } catch (err) {
        console.error(`[FollowUp Analise] Erro ao processar dados para ${chatId}:`, err);
      }
    }
  } catch (error) {
    console.error(`[FollowUp Analise] Erro ao listar ou processar chats para ${clienteId}:`, error);
  }
}

async function getChatIds(dadosDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dadosDir);
    return files.filter(file => fsSync.statSync(path.join(dadosDir, file)).isDirectory());
  } catch (error) {
    console.error("[FollowUp Analise] Erro ao ler diretório de chats:", error);
   return [];
 }
}

export async function removerFollowUp(clientePath: string, chatId: string): Promise<void> {
    const filePath = path.join(clientePath, 'config', 'followups.json');
    try {
        if (fsSync.existsSync(filePath)) {
            const data = await fs.readFile(filePath, 'utf-8');
            let followups = JSON.parse(data);
            followups = followups.filter((followup: any) => followup.chatId !== chatId);
            await fs.writeFile(filePath, JSON.stringify(followups, null, 2), 'utf-8');
            console.info(`[FollowUp Analise] Follow-up removido para ${chatId} em ${filePath}.`);
        } else {
            console.info(`[FollowUp Analise] Arquivo ${filePath} não encontrado.`);
        }
    } catch (error) {
        console.error(`[FollowUp Analise] Erro ao remover follow-up para ${chatId}:`, error);
    }
}

async function readLocalConversationHistory(clientePath: string, chatId: string): Promise<string> {
    const filePath = path.join(clientePath, `Chats`, `Historico`, chatId, `${chatId}.json`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const messagesFromFile = JSON.parse(fileContent);
        if (Array.isArray(messagesFromFile)) {
            return messagesFromFile.map(m => `${m.type}: ${m.message}`).join('\n');
        }
        console.warn(`[readLocalConversationHistory] Conteúdo de ${filePath} não é um array de mensagens.`);
        return '';
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.info(`[readLocalConversationHistory] Arquivo de histórico local não encontrado em ${filePath}.`);
            return '';
        }
        console.error(`[readLocalConversationHistory] Erro ao ler histórico local ${filePath}:`, error);
        return '';
    }
}
