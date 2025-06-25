import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Whatsapp } from '@wppconnect-team/wppconnect';
import { sendImage, sendPtt, sendVideo, sendFile } from '../../disparo/enviarMidia.ts';
import { getPasta } from '../../disparo/disparo.ts';

export interface Gatilho {
  id: string; // Adicionar um ID para cada gatilho
  nome: string;
  frase_ativacao: string;
  arquivo_midia?: string; // Caminho relativo ou absoluto para o arquivo de mídia (opcional se varios_arquivos for true)
  tipo_midia?: 'image' | 'audio' | 'video' | 'document'; // Tipo de mídia (opcional se varios_arquivos for true)
  varios_arquivos?: boolean; // Novo campo para indicar múltiplos arquivos
  arquivos_midia?: string[]; // Novo campo para armazenar caminhos de múltiplos arquivos
  ativo: boolean;
}

interface ConfigGatilhos {
  ativar_funcao_gatilhos: boolean;
  gatilhos: Gatilho[];
}

const getConfigPath = (__dirname: string): string => {

  console.warn(`[Gatilhos] TODO: Implementar getConfigPath para ${__dirname}`);
  const clientePath = getPasta(__dirname);
  if (!clientePath) {
    console.error(`[Gatilhos] Caminho do cliente não encontrado para ${__dirname}`);
    return '';
  }

  return path.join(clientePath, 'config'); // Exemplo
};

const readGatilhosConfig = (clientConfigPath: string): ConfigGatilhos | null => {
  const configFilePath = path.join(clientConfigPath, 'gatilhos.json');
  try {
    if (fs.existsSync(configFilePath)) {
      const configFileContent = fs.readFileSync(configFilePath, 'utf-8');
      return JSON.parse(configFileContent) as ConfigGatilhos;
    } else {
      console.log(`[Gatilhos] Arquivo de configuração não encontrado: ${configFilePath}. Função de gatilhos não será ativada.`);
      return null;
    }
  } catch (error) {
    console.error(`[Gatilhos] Erro ao ler arquivo de configuração ${configFilePath}:`, error);
    return null;
  }
};

export const processTriggers = async (
  client: Whatsapp,
  targetNumber: string,
  messagePart: string,
  __dirname: string // Pode ser necessário passar __dirname ou o caminho base do projeto
): Promise<void> => {
  console.log(`[Gatilhos] Processando gatilhos para ${targetNumber} com parte da mensagem: "${messagePart.substring(0, 50)}..."`);

  const clientConfigPath = getConfigPath(__dirname); // Obter o caminho da configuração do cliente
  

  if (!clientConfigPath) {
      console.error(`[Gatilhos] Não foi possível determinar o caminho de configuração para ${targetNumber}`);
      return;
  }

  const config = readGatilhosConfig(clientConfigPath);

  if (!config || !config.ativar_funcao_gatilhos) {
    console.log('[Gatilhos] Função de gatilhos desativada ou configuração inválida.');
    return;
  }

  console.log('[Gatilhos] Função de gatilhos ativada. Verificando gatilhos individuais...');

  for (const gatilho of config.gatilhos) {
    if (gatilho.ativo && messagePart.toLowerCase().includes(gatilho.frase_ativacao.toLowerCase())) {
      console.log(`[Gatilhos] Gatilho "${gatilho.nome}" ativado pela frase "${gatilho.frase_ativacao}"`);

      if (gatilho.varios_arquivos && gatilho.arquivos_midia && gatilho.arquivos_midia.length > 0) {
        // Enviar múltiplos arquivos
        console.log(`[Gatilhos] Enviando múltiplos arquivos para o gatilho "${gatilho.nome}"`);
        for (const arquivoRelativo of gatilho.arquivos_midia) {
          // Construir o caminho completo do arquivo usando o caminho base do projeto e o caminho relativo salvo no JSON
          // O caminho relativo salvo no JSON é relativo a clientes/ativos/(nomeCliente)
          const projectBasePath = process.cwd(); // Caminho base do projeto
          const mediaFilePath = path.join(__dirname, arquivoRelativo);

          // Verificar se o arquivo de mídia existe antes de tentar enviar
          if (!fs.existsSync(mediaFilePath)) {
              console.error(`[Gatilhos] Arquivo de mídia não encontrado para o gatilho "${gatilho.nome}": ${mediaFilePath}`);
              continue; // Pula para o próximo arquivo
          }

          try {
            const fileType = getFileType(mediaFilePath); // Determinar o tipo de mídia
            switch (fileType) {
              case 'image':
                await sendImage(client, targetNumber, mediaFilePath);
                break;
              case 'audio':
                await sendPtt(client, targetNumber, mediaFilePath); // Assumindo que sendPtt é para áudio
                break;
              case 'video':
                await sendVideo(client, targetNumber, mediaFilePath);
                break;
              case 'document':
                await sendFile(client, targetNumber, mediaFilePath);
                break;
              default:
                console.warn(`[Gatilhos] Tipo de mídia desconhecido para o arquivo "${mediaFilePath}" do gatilho "${gatilho.nome}": ${fileType}`);
            }
            console.log(`[Gatilhos] Arquivo "${path.basename(mediaFilePath)}" do gatilho "${gatilho.nome}" enviado com sucesso.`);
          } catch (error) {
            console.error(`[Gatilhos] Erro ao enviar arquivo "${path.basename(mediaFilePath)}" para o gatilho "${gatilho.nome}":`, error);
          }
        }
      } else if (gatilho.arquivo_midia && gatilho.tipo_midia) {
        // Enviar arquivo único (lógica existente adaptada)
        console.log(`[Gatilhos] Enviando arquivo único para o gatilho "${gatilho.nome}"`);
        // Construir o caminho completo do arquivo único usando o caminho base do projeto e o caminho relativo salvo no JSON
        // O caminho relativo salvo no JSON é relativo a clientes/ativos/(nomeCliente)
        const projectBasePath = process.cwd(); // Caminho base do projeto
        const mediaFilePath = path.join(__dirname, gatilho.arquivo_midia);

        // Verificar se o arquivo de mídia existe antes de tentar enviar
        if (!fs.existsSync(mediaFilePath)) {
            console.error(`[Gatilhos] Arquivo de mídia não encontrado para o gatilho "${gatilho.nome}": ${mediaFilePath}`);
            // Não continue aqui, pois pode haver outros gatilhos
        } else {
            try {
              switch (gatilho.tipo_midia) {
                case 'image':
                  await sendImage(client, targetNumber, mediaFilePath);
                  break;
                case 'audio':
                  await sendPtt(client, targetNumber, mediaFilePath); // Assumindo que sendPtt é para áudio
                  break;
                case 'video':
                  await sendVideo(client, targetNumber, mediaFilePath);
                  break;
                case 'document':
                  await sendFile(client, targetNumber, mediaFilePath);
                  break;
                default:
                  console.warn(`[Gatilhos] Tipo de mídia desconhecido para o gatilho "${gatilho.nome}": ${gatilho.tipo_midia}`);
              }
              console.log(`[Gatilhos] Mídia do gatilho "${gatilho.nome}" enviada com sucesso.`);
            } catch (error) {
              console.error(`[Gatilhos] Erro ao enviar mídia para o gatilho "${gatilho.nome}":`, error);
            }
        }
      } else {
          console.warn(`[Gatilhos] Gatilho "${gatilho.nome}" ativado, mas sem mídia configurada.`);
      }
    }
  }
};

// Helper function to determine file type (copiada do endpoint de upload)
const getFileType = (filePath: string): 'image' | 'audio' | 'video' | 'document' | 'other' => {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return 'image';
  } else if (['.mp3', '.wav', '.ogg', '.aac', '.opus'].includes(ext)) {
    return 'audio';
  } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(ext)) {
    return 'video';
  } else if (['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
    return 'document';
  }
  return 'other';
};