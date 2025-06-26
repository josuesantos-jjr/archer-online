process.on('uncaughtException', (err) => {
  logger.error(`[UNCAUGHT EXCEPTION] Erro não capturado:`, err);
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`[UNHANDLED REJECTION] Promessa rejeitada não tratada:`, reason);
  process.exit(1);
});

logger.info(`[Script Main] Iniciando execução do script principal.`); // Log no início do script

import wppconnect from '@wppconnect-team/wppconnect';
import { initializeNewAIChatSession } from '../../../src/backend/service/openai.js';
import { splitMessages, sendMessagesWithDelay } from '../../../src/backend/util/index.js';
import { saveQRCodeImageAndJson } from './config/qrcode.js';
import logger from './config/logger.js';
import { mainGoogleBG } from '../../../src/backend/service/googleBG.js';
import { mainGoogleChat } from '../../../src/backend/service/googlechat.js';
import fs from 'node:fs';
import os from 'node:os';
import path, { resolve } from 'node:path';
import { dispararMensagens, getPasta, saveMessageToFile } from '../../../src/backend/disparo/disparo.js'; // Importando as funções
import { dispararFollowupsAgendados } from '../../../src/backend/followup/disparoFollowup.js'; // Importar a nova função
import { checkResposta } from '../../../src/backend/service/automacoes/checkResposta.js';
import { fileURLToPath } from 'node:url';
import { IgnoreLead } from '../../../src/backend/service/braim/stop.js';
import { setTimeout, clearTimeout } from 'timers';
import { monitorarConversa } from '../../../src/backend/analiseConversa/monitoramentoConversa.js';
import { updateLastReceivedMessageDate, updateLastSentMessageDate } from '../../../src/backend/util/chatDataUtils.js';
import { setQrCode, clearQrCode } from '../../../src/app/api/qr-code/qrCodeCache.js'; // Importa as funções do cache do novo local

interface Contato {
  id: string;
  telefone: string;
  nome: string;
  clientId: string;
}
// Interfaces
interface ChatIdObject { // Renomeado para evitar conflito com variável chatId
  user: string;
}

interface MessageBufferEntry {
  messages: string[];
  answered: boolean;
}

// Type guard para verificar se é um objeto ChatIdObject
function isChatIdObject(value: unknown): value is ChatIdObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'user' in value &&
    typeof (value as ChatIdObject).user === 'string'
  );
}

// Função formatChatId com type guard
function formatChatId(chatIdInput: string | ChatIdObject | unknown): string {
  if (isChatIdObject(chatIdInput)) {
    return chatIdInput.user;
  }
  if (typeof chatIdInput === 'string') {
    return chatIdInput.split('@')[0];
  }
  return String(chatIdInput);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



type AIOption = `GPT` | `GEMINI`;

const MESSAGE_BUFFER_FILE_PATH = path.join(__dirname, './config/messageBuffer.json');

// Carrega o buffer de mensagens do arquivo ao iniciar
let messageBufferPerChatId: Map<string, MessageBufferEntry[]> = new Map(); // Usa a interface
loadMessageBuffer();
const messageTimeouts = new Map<string, NodeJS.Timeout>();
// const orçamentoTimeouts = new Map<string, NodeJS.Timeout>(); // Removido
const leadSummaryTimeouts = new Map<string, { leadId: string, contatoId: string, timerId: NodeJS.Timeout }>(); // Mapa para timers de resumo de lead (adicionado contatoId)

// Extrai o ID completo do cliente (ex: 'ativos/Alpha')
const clienteIdCompleto = (() => {
    const clientePathParts = __dirname.split(path.sep);
    // Ajusta a lógica para pegar as duas últimas partes se a penúltima for 'clientes'
    if (clientePathParts.length >= 3 && clientePathParts[clientePathParts.length - 3] === 'clientes') {
        // Retorna 'tipo/nome', ex: 'ativos/Alpha'
        return path.join(clientePathParts[clientePathParts.length - 2], clientePathParts[clientePathParts.length - 1]).replace(/\\/g, '/'); // Garante barras normais
    }
    logger.error("Não foi possível determinar o ID completo do cliente (ex: ativos/Alpha) a partir do __dirname:", __dirname);
    return null; // Retorna null se não conseguir determinar
})();

// Carrega as configurações de infoCliente.json
const infoPath = path.join(__dirname, 'config', 'infoCliente.json');
const infoConfig = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

const cliente = infoConfig.CLIENTE || '';
const AI_SELECTED: AIOption = infoConfig.AI_SELECTED || `GEMINI`;
const TARGET_CHAT_ID = infoConfig.TARGET_CHAT_ID || ``;
const GEMINI_KEY = infoConfig.GEMINI_KEY || ``;

logger.info(`Cliente ID Completo: ${clienteIdCompleto}`);
logger.info(`Cliente (Nome): ${cliente}`);
logger.info(`AI Selected: ${AI_SELECTED}`);
logger.info(`Target Chat ID: ${TARGET_CHAT_ID}`);
logger.info(`Gemini Key: ${GEMINI_KEY}`);

// Substitui getCliente para usar infoConfig
export const getCliente = (): string => {
  return infoConfig.CLIENTE || '';
};
const clientePath = __dirname;

logger.info(`Pasta cliente: ${clientePath}`);

// Configuração para retentativas
const MAX_RETRIES_START = 300; // Número máximo de retentativas para nome
const MAX_RETRIES_NAME = 10; // Número máximo de retentativas para nome
const MAX_RETRIES_INTEREST = 10; // Número máximo de retentativas para interesse
const MAX_RETRIES_ORÇAMENTO = 10; // Número máximo de retentativas para orçamento
const MAX_RETRIES_RESUMO = 10; // Número máximo de retentativas para orçamento
const MAX_RETRIES_LEAD = 5; // Definido aqui para uso em makeRequestWithRetryLead
const INITIAL_BACKOFF_MS = 1000 * Math.random() * (20 - 1) + 5; // Tempo de espera inicial em milissegundos

let leadCount = 1; // Contador de leads

if (AI_SELECTED === `GEMINI` && !GEMINI_KEY) {
  throw Error(
    `Você precisa colocar uma key do Gemini no .env! Crie uma gratuitamente em https://aistudio.google.com/app/apikey?hl=pt-br`
  );
}

if (
  AI_SELECTED === `GPT` &&
  (!infoConfig.OPENAI_KEY || !infoConfig.OPENAI_ASSISTANT)
) {
  throw Error(
    `Para utilizar o GPT você precisa colocar no .env a sua key da openai e o id do seu assistente.`
  );
}

// Função para atualizar o arquivo .env
// Função para atualizar infoCliente.json
async function updateInfoCliente(key: string, value: any) {
  try {
    const infoPath = path.join(__dirname, 'config', 'infoCliente.json');
    let infoConfig = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    infoConfig[key] = value;
    fs.writeFileSync(infoPath, JSON.stringify(infoConfig, null, 2), 'utf-8');
    logger.info(`Chave "${key}" atualizada em infoCliente.json.`);
  } catch (error) {
    logger.error(`Erro ao atualizar infoCliente.json:`, error);
  }
}

  // Função para fazer a requisição com retentativas para o LEAD_PROMPT (Definição Única)
  async function makeRequestWithRetryLead(prompt: string, chatId: string, conversation: string, retries = 0): Promise<string | undefined> {
    try {
      const intervalo_aleatorio = Math.random() * (10 - 5) + 5;
      logger.info(`Fazendo requisição para a IA (Lead Check) aguardando ${intervalo_aleatorio.toFixed(1)}s...`);
      await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
      const response =
        AI_SELECTED === `GPT`
          ? '' // Placeholder se GPT for selecionado mas nenhuma chamada OpenAI for descomentada
          : await mainGoogleBG({ currentMessageBG: `${prompt}\n\n${conversation}`, chatId, clearHistory: true, __dirname });
      return response;
    } catch (error: any) {
      if (
        (error.message.includes(`429`) || error.message.includes(`503`) || error.message.includes(`500`)) &&
        retries < MAX_RETRIES_LEAD // Usa constante definida no escopo superior
      ) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(1.5, retries);
        logger.warn(`Erro na requisição da IA (Lead Check), tentando novamente em ${(backoffTime / 1000).toFixed(1)}s...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return await makeRequestWithRetryLead(prompt, chatId, conversation, retries + 1); // Chama a si mesma (recursão)
      } else {
        logger.error(`Erro ao obter resposta da IA (Lead Check) após ${retries} tentativas:`, error);
        return undefined;
      }
    }
  }

  // Função para fazer a requisição com retentativas para o SUMMARY_PROMPT
  async function makeRequestWithRetrySummary(prompt: string, chatId: string, conversation: string, retries = 0): Promise<string | undefined> {
    try {
      const intervalo_aleatorio = Math.random() * (15 - 8) + 8;
      logger.info(`Fazendo requisição para a IA (Resumo) aguardando ${intervalo_aleatorio.toFixed(1)}s...`);
      await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
      const response =
        AI_SELECTED === `GPT`
          ? '' // Placeholder se GPT for selecionado mas nenhuma chamada OpenAI for descomentada
          : await mainGoogleBG({ currentMessageBG: `${prompt}\n\n${conversation}`, chatId, clearHistory: true, __dirname });
      return response;
    } catch (error: any) {
      if (
        (error.message.includes(`429`) || error.message.includes(`503`) || error.message.includes(`500`)) &&
        retries < MAX_RETRIES_RESUMO
      ) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(1.5, retries);
        logger.warn(`Erro na requisição da IA (Resumo), tentando novamente em ${(backoffTime / 1000).toFixed(1)}s...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return await makeRequestWithRetrySummary(prompt, chatId, conversation, retries + 1);
      } else {
        logger.error(`Erro ao obter resposta da IA (Resumo) após ${retries} tentativas:`, error);
        return undefined;
      }
    }
  }

  // Função para fazer a requisição com retentativas para o nome
  async function makeRequestWithRetryName(prompt: string, chatId: string, conversation: string, retries = 0): Promise<string | undefined> {
    try {
      const intervalo_aleatorio = Math.random() * (20 - 15) + 15;
      logger.info(`Fazendo requisição para a IA (Nome) aguardando ${intervalo_aleatorio}...`);
      await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
      const response =
        AI_SELECTED === `GPT`
          ? // await mainOpenAI({ currentMessage: `${prompt}\n\n${conversation}`, chatId })
          await mainGoogleBG({ currentMessageBG: `${prompt}\n\n${conversation}`, chatId, clearHistory: true, __dirname })
          : await mainGoogleBG({ currentMessageBG: `${prompt}\n\n${conversation}`, chatId, clearHistory: true, __dirname });
      return response;
    } catch (error: any) {
      if (
        (error.message.includes(`429 Too Many Requests`) ||
          error.message.includes(`503 Service Unavailable`) ||
          error.message.includes(`messageBufferPerChatId.get is not a function`) ||
          error.message.includes(`[500 Internal Server Error]`)) &&
        retries < MAX_RETRIES_NAME
      ) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(1, retries);
        logger.info(`Muitas requisições, tentando novamente em ${backoffTime} segundos...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return await makeRequestWithRetryName(prompt, chatId, conversation, retries + 1);
      } else {
        logger.error(`Erro ao obter resposta da IA (Nome):`, error);
        return undefined; // Ignora o erro e continua
      }
    }
  }

  // Função para fazer a requisição com retentativas para o interesse
  async function makeRequestWithRetryInterest(prompt: string, chatId: string, conversation: string, retries = 0): Promise<string | undefined> {
    try {
      const intervalo_aleatorio = Math.random() * (15 - 10) + 10; // Ajustado intervalo
      logger.info(`Fazendo requisição para a IA (Interesse) aguardando ${intervalo_aleatorio.toFixed(1)}s...`);
      await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
      const response =
        AI_SELECTED === `GPT`
          ? '' // Placeholder se GPT for selecionado mas nenhuma chamada OpenAI for descomentada
          : await mainGoogleBG({ currentMessageBG: `${prompt}\n\n${conversation}`, chatId, clearHistory: true, __dirname });
      return response;
    } catch (error: any) {
      if (
        (error.message.includes(`429`) || error.message.includes(`503`) || error.message.includes(`500`)) &&
        retries < MAX_RETRIES_INTEREST // Usa constante definida no escopo superior
      ) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(1.5, retries);
        logger.warn(`Erro na requisição da IA (Interesse), tentando novamente em ${(backoffTime / 1000).toFixed(1)}s...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return await makeRequestWithRetryInterest(prompt, chatId, conversation, retries + 1); // Chama a si mesma (recursão)
      } else {
        logger.error(`Erro ao obter resposta da IA (Interesse) após ${retries} tentativas:`, error);
        return undefined;
      }
    }
  }

  // Função para fazer a requisição com retentativas para o orçamento
  async function makeRequestWithRetryOrçamento(prompt: string, chatId: string, conversation: string, retries = 0): Promise<string | undefined> {
    try {
      const intervalo_aleatorio = Math.random() * (20 - 15) + 15;
      logger.info(`Fazendo requisição para a IA (Orçamento) aguardando ${intervalo_aleatorio}...`);
      await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
      const response =
        AI_SELECTED === `GPT`
          ? '' // Placeholder se GPT for selecionado mas nenhuma chamada OpenAI for descomentada
          : await mainGoogleBG({ currentMessageBG: `${prompt}\n\n${conversation}`, chatId, clearHistory: true, __dirname });
      return response;
    } catch (error: any) {
      if (
        (error.message.includes(`429 Too Many Requests`) ||
          error.message.includes(`503 Service Unavailable`) ||
          error.message.includes(`messageBufferPerChatId.get is not a function`) ||
          error.message.includes(`[500 Internal Server Error]`)) &&
        retries < MAX_RETRIES_ORÇAMENTO
      ) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(1, retries);
        logger.info(`Muitas requisições, tentando novamente em ${backoffTime} segundos...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return await makeRequestWithRetryOrçamento(prompt, chatId, conversation, retries + 1);
      } else {
        logger.error(`Erro ao obter resposta da IA (Orçamento):`, error);
        return undefined; // Ignora o erro e continua
      }
    }
  }

// --- FUNÇÕES AUXILIARES GERAIS (FORA DE START) ---

// Adiciona client como primeiro parâmetro
async function getMessages(client: wppconnect.Whatsapp, chatId: string, getMessagesParam = {}): Promise<any> {
  return client.getMessages(chatId, getMessagesParam);
}

/**
* Refatorado: Verifica/cria contato principal, verifica/cria lead do cliente e inicia timer. (Definição Única)
*/

async function findOrCreateContatoPrincipal(telefone: string, nome: string, clientId: string): Promise<{ id: string; isNovo: boolean }> {
   const filePath = path.join(__dirname, 'config', 'contatos.json');
   let contatos: Contato[] = [];
   if (fs.existsSync(filePath)) {
       const data = fs.readFileSync(filePath, 'utf-8');
       if (data) {
           try {
               contatos = JSON.parse(data);
           } catch (error) {
               logger.error('Erro ao analisar o arquivo contatos.json, resetando arquivo:', error);
               contatos = [];
               fs.writeFileSync(filePath, JSON.stringify(contatos, null, 2), 'utf-8');
           }
       }
   } else {
       // Cria o arquivo se ele não existir
       fs.writeFileSync(filePath, JSON.stringify(contatos, null, 2), 'utf-8');
       logger.info(`Arquivo ${filePath} criado.`);
   }

   let contato = contatos.find((c: any) => c.telefone === telefone);
   if (contato) {
       return { id: contato.id, isNovo: false };
   } else {
       const novoContato = { id: Math.random().toString(36).substring(2, 15), telefone, nome, clientId };
       contatos.push(novoContato);
       fs.writeFileSync(filePath, JSON.stringify(contatos, null, 2), 'utf-8');
       return { id: novoContato.id, isNovo: true };
   }
}

async function findLeadByChatId(clientId: string, chatId: string): Promise<any | undefined> {
   const filePath = path.join(__dirname, 'config', 'leads.json');
   if (fs.existsSync(filePath)) {
       const data = fs.readFileSync(filePath, 'utf-8');
       if (data) {
           try {
               const leads = JSON.parse(data);
               return leads.find((lead: any) => lead.chatId === chatId && lead.clientId === clientId);
           } catch (error) {
               logger.error('Erro ao analisar o arquivo leads.json, resetando arquivo:', error);
               return undefined;
           }
       }
   } else {
       // Cria o arquivo se ele não existir
       fs.writeFileSync(filePath, '[]', 'utf-8');
       logger.info(`Arquivo ${filePath} criado.`);
       return undefined;
   }
   return undefined;
}

async function saveLead(clientId: string, contatoId: string, leadData: any): Promise<string | undefined> {
   const now = new Date();
   const year = now.getFullYear();
   const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Mês 0-11, adiciona 1 e formata
   const day = now.getDate().toString().padStart(2, '0'); // Formata o dia

   // Cria o caminho do diretório baseado na data
   const leadsDir = path.join(__dirname, 'config', 'leads', year.toString(), month, day);
   const filePath = path.join(leadsDir, 'leads.json');

   // Cria os diretórios se não existirem
   if (!fs.existsSync(leadsDir)) {
       fs.mkdirSync(leadsDir, { recursive: true });
       logger.info(`Diretório de leads criado: ${leadsDir}`);
   }

   let leads = [];
   if (fs.existsSync(filePath)) {
       const data = fs.readFileSync(filePath, 'utf-8');
       if (data) {
           try {
               leads = JSON.parse(data);
           } catch (error) {
               logger.error(`Erro ao analisar o arquivo leads.json em ${filePath}, resetando arquivo:`, error);
               leads = []; // Reseta se o arquivo estiver corrompido
           }
       }
   }
   
   // Adiciona timestamp de identificação e formata a data para o objeto lead
   const newLead = {
       id: Math.random().toString(36).substring(2, 15),
       clientId,
       contatoId,
       ...leadData,
       timestampIdentificacao: now.toISOString(), // Salva timestamp completo
       dataIdentificacao: `${year}-${month}-${day}` // Salva data formatada
   };

   leads.push(newLead);
   try {
       fs.writeFileSync(filePath, JSON.stringify(leads, null, 2), 'utf-8');
       logger.info(`Novo lead salvo em ${filePath} com ID: ${newLead.id}`);
   } catch (error) {
       logger.error(`Erro ao salvar o arquivo leads.json em ${filePath}:`, error);
       return undefined;
   }
   return newLead.id;
}

async function updateLeadSummary(clientId: string, leadId: string, contatoId: string, summary: string): Promise<boolean> {
   const filePath = path.join(__dirname, 'config', 'leads.json');
   if (fs.existsSync(filePath)) {
       const data = fs.readFileSync(filePath, 'utf-8');
       if (data) {
           try {
               const leads = JSON.parse(data);
               const leadIndex = leads.findIndex((lead: any) => lead.id === leadId && lead.clientId === clientId);
               if (leadIndex !== -1) {
                  leads[leadIndex].summary = summary;
                   try {
                      fs.writeFileSync(filePath, JSON.stringify(leads, null, 2), 'utf-8');
                   } catch (error) {
                      logger.error('Erro ao salvar o arquivo leads.json:', error);
                      return false;
                   }
                  return true;
               } else {
                  logger.warn(`Lead com ID ${leadId} não encontrado para o cliente ${clientId}.`);
                  return false;
               }
           } catch (error) {
               logger.error('Erro ao analisar o arquivo leads.json:', error);
               return false;
           }
       }
   }
   return false;
}


async function saveChatMessage(clienteIdCompleto: string, chatId: string, messageData: any, clientePath: string): Promise<void> {
   const chatIdFormatted = chatId.replace(/@c\.us/g, '');
   const dirPath = path.join(__dirname, 'Chats', 'Historico', `${chatIdFormatted}@c.us`);
   const filePathChat = path.join(dirPath, `${chatIdFormatted}.json`);
   const filePathDados = path.join(dirPath, 'dados.json');
   let messages = [];

   // Cria o diretório se não existir
   if (!fs.existsSync(dirPath)) {
       fs.mkdirSync(dirPath, { recursive: true });
   }

   // Salva no arquivo de chat

   if (fs.existsSync(filePathChat)) {
       const data = fs.readFileSync(filePathChat, 'utf-8');
       if (data) {
           try {
               messages = JSON.parse(data);
           } catch (error) {
               logger.error('Erro ao analisar o arquivo de histórico de mensagens:', error);
           }
       }
   }

   messages.push(messageData);
   fs.writeFileSync(filePathChat, JSON.stringify(messages, null, 2), 'utf-8');

   // Salva no arquivo de dados (Dados.json)
   // Verifica se o arquivo Dados.json existe
   if (!fs.existsSync(filePathDados)) {
       // Se não existir, cria um novo objeto com a estrutura desejada
       const initialData = {
           name: 'Não identificado',
           number: chatId.split('@')[0],
           tags: [],
           listaNome: null,
       };
       fs.writeFileSync(filePathDados, JSON.stringify(initialData, null, 2), 'utf-8');
   }
}

async function handleLeadIdentification(client: wppconnect.Whatsapp, clientId: string, chatId: string, nome: string, telefone: string, listaOrigemId: string | null = null, listaOrigemNome: string | null = null, tagsIniciais: string[] = []) {
   logger.info("Iniciando identificação de lead para cliente " + clientId + ", chatId: " + chatId);
   try {
       // 1. Encontra ou Cria o Contato Principal
       const { id: contatoId, isNovo: isNewContato } = await findOrCreateContatoPrincipal(telefone, nome, clientId);
       if (!contatoId) {
           throw new Error("Falha ao obter ID do contato principal.");
       }
       logger.info("Contato principal " + (isNewContato ? 'criado' : 'encontrado') + ": " + contatoId);

       // 2. Verifica se já existe um lead *para este cliente*
       const existingLead = await findLeadByChatId(clientId, chatId);

       if (!existingLead) {
           logger.info("Lead não encontrado para " + chatId + " neste cliente. Salvando novo lead...");
           const leadData = {
               chatId: chatId,
               nome: nome || 'Não identificado',
               telefone: telefone || chatId.split('@')[0], // Usa telefone normalizado do contato principal?
               listaOrigemId: listaOrigemId,
               listaOrigemNome: listaOrigemNome,
               tags: tagsIniciais, // Adiciona tags iniciais
               // timestampIdentificacao será adicionado por saveLead
           };
           // Chama saveLead com os 3 argumentos corretos
           const newLeadId = await saveLead(clientId, contatoId, leadData);

           if (newLeadId) {
               logger.info("Novo lead salvo com ID: " + newLeadId + ". Iniciando timer para resumo.");
               // Passa o objeto client para startLeadSummaryTimer
               startLeadSummaryTimer(client, clientId, chatId, newLeadId, contatoId); // Passa client

               // A notificação de Novo Lead foi movida para generateAndSaveSummary
               // para incluir o resumo.
               // Lógica de notificação removida daqui.

           } else {
               logger.error("Falha ao salvar novo lead para chatId: " + chatId);
           }
       } else {
           logger.info("Lead " + existingLead.id + " já existe para chatId: " + chatId + ". Verificando timer de resumo.");
           // Garante que o timer seja iniciado se não estiver ativo
           if (!leadSummaryTimeouts.has(chatId)) {
               logger.info("Timer de resumo não encontrado para lead existente " + existingLead.id + ". Iniciando...");
               // Correção: Usa contatoId como fallback seguro
               // Verifica se existingLead e existingLead.contatoPrincipalId existem antes de usar
               const leadContatoId = existingLead && existingLead.contatoPrincipalId ? existingLead.contatoPrincipalId : contatoId;
               // Passa o objeto client para startLeadSummaryTimer
               startLeadSummaryTimer(client, clientId, chatId, existingLead.id, leadContatoId); // Passa client
           }
       }
   } catch (error) {
       logger.error("Erro em handleLeadIdentification para " + chatId + ":", error);
   }
}


// Função para iniciar/reiniciar o timer de resumo do lead (adicionado contatoId)
function startLeadSummaryTimer(client: wppconnect.Whatsapp, clientId: string, chatId: string, leadId: string, contatoId: string) {
 if (!contatoId) {
     logger.error("[startLeadSummaryTimer] ContatoId não fornecido para lead " + leadId + ". Timer não iniciado.");
     return;
 }
 if (leadSummaryTimeouts.has(chatId)) {
   clearTimeout(leadSummaryTimeouts.get(chatId)!.timerId);
   logger.info("Timer de resumo anterior para " + chatId + " limpo.");
 }

 logger.info("Iniciando timer de 10 minutos para resumo do lead " + leadId + " (contato: " + contatoId + ", chat: " + chatId + ").");
 const timerId = setTimeout(() => {
   logger.info("Timer de 10 minutos expirado para " + chatId + ". Gerando resumo...");
   // Passa client, clientePath, AI_SELECTED e contatoId para a função
   generateAndSaveSummary(client, clientId, chatId, leadId, contatoId, clientePath, AI_SELECTED); // Passa client
   leadSummaryTimeouts.delete(chatId);
 }, 10 * 60 * 1000);

 leadSummaryTimeouts.set(chatId, { leadId, contatoId, timerId }); // Armazena contatoId
}

/**
*/
async function generateAndSaveSummary(client: wppconnect.Whatsapp, clientId: string, chatId: string, leadId: string, contatoId: string, clientePath: string, aiSelected: AIOption) {
   if (!clientId || !contatoId) {
       logger.error(`[generateAndSaveSummary] clientId ou contatoId ausente. Abortando.`);
       return;
   }
   try {
       const summaryPrompt = infoConfig.SUMMARY_PROMPT || '';
       if (!summaryPrompt) {
           logger.warn(`SUMMARY_PROMPT não encontrado no .env para cliente ${clientId}. Não é possível gerar resumo.`);
           return;
       }

       const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
       let conversation = '';
       if (fs.existsSync(filePath)) {
           conversation = fs.readFileSync(filePath, `utf-8`);
           try {
               const messagesFromFile = JSON.parse(conversation);
               if (Array.isArray(messagesFromFile)) {
                   conversation = messagesFromFile.map(m => `${m.type}: ${m.message}`).join('\n');
               }
           } catch { /* Ignora erro de parse, usa conteúdo bruto */ }
       } else {
           logger.warn(`Arquivo de histórico local ${filePath} não encontrado para gerar resumo.`);
       }

       if (!conversation.trim()) {
           logger.warn(`Histórico de conversa vazio para ${chatId}. Não é possível gerar resumo.`);
           return;
       }

       logger.info(`Gerando resumo para lead ${leadId} (contato: ${contatoId}, chat: ${chatId})...`);
       const summaryResponse = await makeRequestWithRetrySummary(summaryPrompt, chatId, conversation);

       if (summaryResponse) {
           logger.info(`Resumo gerado pela IA: ${summaryResponse.substring(0, 100)}...`);
           // Chama updateLeadSummary com os 4 argumentos corretos
           await updateLeadSummary(clientId, leadId, contatoId, summaryResponse);
           // Não verifica mais o retorno booleano
           
           logger.info(`Resumo salvo para lead ${leadId}.`);

           // --- Lógica de Notificação de Novo Lead (MOVIDA PARA CÁ) ---
           if (TARGET_CHAT_ID) {
               const nomeClienteSimples = path.basename(clientePath); // Obtém o nome simples do cliente (ex: GlobalTur)
               // Busca os dados do lead novamente para ter as informações mais recentes (incluindo o resumo)
               const leadAtualizado = await findLeadByChatId(clientId, chatId);
               const dadosFilePath = path.join(__dirname, 'Chats', 'Historico', chatId, 'Dados.json');
               const dadosFileContent = fs.readFileSync(dadosFilePath, 'utf-8');
               const dados = JSON.parse(dadosFileContent); 
               const mensagemNotificacao = `🎉 *Novo Lead Identificado!* 🎉\n\n` +
                                           `*Cliente:* ${nomeClienteSimples}\n` +
                                           `*Nome:* ${dados.name || 'Não identificado'}\n` +
                                           `*Telefone:* ${leadAtualizado?.telefone || chatId.split('@')[0]}\n` +
                                           (leadAtualizado?.listaOrigemNome ? `*Origem:* Lista "${leadAtualizado.listaOrigemNome}"\n` : '') +
                                           `*Data:* ${new Date(leadAtualizado?.timestampIdentificacao || Date.now()).toLocaleDateString('pt-BR')} ${new Date(leadAtualizado?.timestampIdentificacao || Date.now()).toLocaleTimeString('pt-BR')}\n\n` +
                                           `*Resumo da Conversa:*\n${summaryResponse || 'Resumo não gerado.'}`; // Inclui o resumo
               logger.info(`Enviando notificação de novo lead (com resumo) para ${TARGET_CHAT_ID}`);
               try {
                   // Usa a função sendMessage existente
                   await sendMessage(client, clientePath, TARGET_CHAT_ID, mensagemNotificacao);
               } catch (notifyError) {
                   logger.error(`Falha ao enviar notificação de novo lead (com resumo) para ${TARGET_CHAT_ID}:`, notifyError);
               }
           } else {
               logger.warn(`TARGET_CHAT_ID não configurado. Notificação de novo lead (com resumo) não enviada.`);
           }
           // --- FIM Lógica de Notificação ---
       } else {
           logger.error(`Falha ao gerar resumo para lead ${leadId}.`);
       }
    } catch (error) {
        logger.error(`Erro na função generateAndSaveSummary para lead ${leadId}:`, error);
    }
}

// Função formatChatId já definida no topo com type guard

// Funções de buffer local (mantidas)
function loadMessageBuffer() {
  try {
    if (fs.existsSync(MESSAGE_BUFFER_FILE_PATH)) {
      const data = fs.readFileSync(MESSAGE_BUFFER_FILE_PATH, 'utf-8');
      if (data && data.trim().startsWith('{') && data.trim().endsWith('}')) {
          messageBufferPerChatId = new Map(Object.entries(JSON.parse(data)));
      } else if (data) {
           logger.warn('Arquivo de buffer parece corrompido. Iniciando buffer vazio.');
           messageBufferPerChatId = new Map();
           fs.writeFileSync(MESSAGE_BUFFER_FILE_PATH, '{}', 'utf-8');
       } else {
           messageBufferPerChatId = new Map();
       }
    }
  } catch (error) {
    logger.error('Erro ao carregar o buffer de mensagens:', error);
    messageBufferPerChatId = new Map();
  }
}

function saveMessageBuffer() {
  try {
    const dataToSave: { [key: string]: MessageBufferEntry[] } = {}; // Adiciona tipo explícito
    messageBufferPerChatId.forEach((value, key) => {
      dataToSave[key] = value;
    });
    fs.writeFileSync(
      MESSAGE_BUFFER_FILE_PATH,
      JSON.stringify(dataToSave, null, 2),
      'utf-8'
    );
  } catch (error) {
    logger.error('Erro ao salvar o buffer de mensagens local:', error);
  }
}

function markMessagesAsAnswered(chatId: string) {
    const messages = messageBufferPerChatId.get(chatId);
    if (messages) {
        messages.forEach(m => m.answered = true);
        saveMessageBuffer();
    }
}

// Função para remover emojis (mantida)
function removeEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}]/gu, ``) // Emoticons
               .replace(/[\u{1F300}-\u{1F5FF}]/gu, ``) // Símbolos e pictogramas
               .replace(/[\u{1F680}-\u{1F6FF}]/gu, ``) // Transporte e símbolos de mapa
               .replace(/[\u{1F700}-\u{1F77F}]/gu, ``) // Símbolos alfanuméricos
               .replace(/[\u{1F780}-\u{1F7FF}]/gu, ``) // Símbolos geométricos
               .replace(/[\u{1F800}-\u{1F8FF}]/gu, ``) // Símbolos suplementares
               .replace(/[\u{1F900}-\u{1F9FF}]/gu, ``) // Símbolos e pictogramas suplementares
               .replace(/[\u{1FA00}-\u{1FA6F}]/gu, ``) // Símbolos adicionais
               .replace(/[\u{1FA70}-\u{1FAFF}]/gu, ``) // Símbolos adicionais
               .replace(/[\u{2600}-\u{26FF}]/gu, ``)   // Diversos símbolos e pictogramas
               .replace(/[\u{2700}-\u{27BF}]/gu, ``);  // Dingbats
}

// Função para enviar mensagem (Definição Única e Exportada)
async function sendMessage(client: wppconnect.Whatsapp, clientePath: string, chatId: string, message: string) {
  try {
    await client.sendText(chatId, message);
    logger.info(`Mensagem enviada para ${chatId}: ${message}`);
    // Atualiza a data da última mensagem enviada
    await updateLastSentMessageDate(clientePath, chatId);
  } catch (error) {
    logger.error(`Erro ao enviar mensagem para ${chatId}:`, error);
  }
}
export { sendMessage };

const qrCodeTimeouts = new Map<string, NodeJS.Timeout>();

// Função para limpar os arquivos de QR Code de um cliente específico
async function clearClientQrCodeFiles(clientName: string) {
  const qrCodeDir = path.join(__dirname, 'config', 'qrcode');
  try {
    const files = await fs.promises.readdir(qrCodeDir);
    const clientQrCodeFiles = files.filter(file => file.startsWith(`${clientName}_`) && (file.endsWith('.png') || file.endsWith('.json')));

    for (const file of clientQrCodeFiles) {
      const filePath = path.join(qrCodeDir, file);
      await fs.promises.unlink(filePath);
      logger.info(`Arquivo de QR Code excluído: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Erro ao limpar arquivos de QR Code para o cliente ${clientName}:`, error);
  }
}

// --- INICIALIZAÇÃO ---
logger.info(`[WppConnect Init] Tentando criar instância WppConnect para o cliente: ${cliente}`);
wppconnect
  .create(
    cliente, // sessionName
    async (base64Qrimg: string, asciiQR: string, attempts: number, urlCode: string | undefined) => {
      logger.info(`[WppConnect QR] Terminal qrcode: `, asciiQR);
      logger.info(`[WppConnect QR] Tentativas: ${attempts}`);
      if (urlCode) {
        logger.info(`[WppConnect QR] URL do QR Code disponível.`);
        try {
          // Limpa todos os arquivos de QR Code antigos antes de salvar o novo
          await clearClientQrCodeFiles(clienteIdCompleto!);

          const { imagePath, jsonPath } = await saveQRCodeImageAndJson(urlCode, clienteIdCompleto!);
          setQrCode(clienteIdCompleto!, base64Qrimg); // Armazena o QR code Base64 no cache usando o ID completo
          logger.info(`[WppConnect QR] QR Code Base64 armazenado em cache para o cliente: ${clienteIdCompleto}`);
          logger.info(`[WppConnect QR] QR Code imagem salva em: ${imagePath}`);
          logger.info(`[WppConnect QR] QR Code JSON salvo em: ${jsonPath}`);

          // Define um timer para excluir a imagem e o JSON após 60 segundos
          const qrCodeTimeout = setTimeout(() => {
            logger.warn(`[WppConnect QR] Timer de 60s expirado. Excluindo arquivos de QR Code para ${clienteIdCompleto}.`);
            try {
              fs.unlinkSync(imagePath);
              fs.unlinkSync(jsonPath);
              logger.info(`[WppConnect QR] QR Code imagem e JSON excluídos após 60 segundos: ${imagePath}, ${jsonPath}`);
            } catch (err) {
              logger.error(`[WppConnect QR] Erro ao excluir QR Code imagem ou JSON:`, err);
            }
            clearQrCode(clienteIdCompleto!); // Limpa o QR code do cache também
          }, 60 * 1000); // 60 segundos

          // Armazena o timeout para poder limpá-lo se o QR code for lido antes
          qrCodeTimeouts.set(clienteIdCompleto!, qrCodeTimeout);

        } catch (error) {
          logger.error(`[WppConnect QR] Erro ao salvar QR Code imagem ou JSON:`, error);
        }
      } else {
        logger.warn(`[WppConnect QR] URL do QR Code NÃO disponível.`);
      }
    },
    async (statusSession: string, session: string) => {
      logger.info(`[WppConnect Status] Status Session: `, statusSession);
      logger.info(`[WppConnect Status] Session name: `, session);
      if (statusSession) {
        await updateInfoCliente('STATUS_SESSION', statusSession);
        // Se o status indica que o QR code não é mais válido, limpa o cache
        if (statusSession === 'qrReadError' || statusSession === 'qrReadFail' || statusSession === 'inChat' || statusSession === 'desconnectedMobile' || statusSession === 'autocloseCalled') {
          logger.info(`[WppConnect Status] Status ${statusSession} detectado. Limpando QR Code e timers.`);
          clearQrCode(clienteIdCompleto!); // Limpa o QR code do cache usando o ID completo
          logger.info(`[WppConnect Status] QR Code limpo do cache para o cliente: ${clienteIdCompleto}`);
          // Limpa o timer de exclusão se o QR code for lido ou a sessão desconectada
          if (qrCodeTimeouts.has(clienteIdCompleto!)) {
            clearTimeout(qrCodeTimeouts.get(clienteIdCompleto!)!);
            qrCodeTimeouts.delete(clienteIdCompleto!);
            logger.info(`[WppConnect Status] Timer de exclusão do QR Code limpo para o cliente: ${clienteIdCompleto}`);
          }
          // Adiciona a lógica para limpar os arquivos da pasta qrcode
          await clearClientQrCodeFiles(clienteIdCompleto!);
        }
      }
    },
    undefined, // onLoadingScreen
    undefined, // catchLinkCode
    { // options
      headless: `new` as any,
      autoClose: 0, // Desativa o fechamento automático para depuração e estabilidade (0 para nunca fechar)
      puppeteerOptions: {
        protocolTimeout: 120000, // Aumenta o tempo limite do protocolo para 120 segundos
        args: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote',
          '--disable-accelerated-2d-canvas',
          '--disable-features=site-per-process',
          '--disable-infobars',
          '--disable-extensions',
          '--window-size=1920,1080',
          '--lang=en-US',
          '--disable-background-networking', // Reduz o uso de rede
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-speech-api',
          '--disable-sync',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
        ],
        executablePath: '/usr/bin/google-chrome-stable', // Define o caminho explícito para o Chrome
        userDataDir: `/tmp/wppconnect-data/${cliente}`, // Usa o nome do cliente para o diretório de dados do usuário
      },
    }
  )
   .then((client: wppconnect.Whatsapp) => { // Chama a função start passando o objeto client
     logger.info(`[WppConnect Init] WppConnect inicializado com sucesso. Chamando start().`);
     start(client);
   })
   .catch((erro: any) => {
     logger.error(`[WppConnect Error] Erro FATAL na inicialização do WppConnect:`, erro); // Log mais explícito no catch
     // Força a saída do processo com código de erro para que o PM2 possa tentar reiniciar
     process.exit(1); 
   });

   
// --- FUNÇÃO PRINCIPAL DE PROCESSAMENTO DE MENSAGENS ---
async function start(client: wppconnect.Whatsapp): Promise<void> {
  logger.info(`[Script Start] Função start iniciada.`); // Log no início da função start

  // Chame a função dispararMensagens (disparo inicial)
  dispararMensagens(client, clientePath)
      .then(() => logger.info(`Disparo inicial de mensagens concluído!`))
      .catch((error) => logger.error(`Erro no disparo inicial de mensagens:`, error));

  // Agendar verificação e disparo de followups a cada 60 minutos
  setInterval(async () => {
      logger.info(`Verificando e disparando followups agendados...`);
      try {
          // Use clienteIdCompleto para o ID do cliente
          if (clienteIdCompleto) {
              await dispararFollowupsAgendados(client, clienteIdCompleto, __dirname); // Chama a nova função
              logger.info(`Verificação e disparo de followups concluído.`);
          } else {
              logger.error(`clienteIdCompleto não definido. Não é possível disparar followups.`);
          }
      } catch (error) {
          logger.error(`Erro na verificação/disparo de followups:`, error);
      }
  }, 6 * 60 * 1000); // 60 minutos em milissegundos

  // Verifica se há mensagens não respondidas no buffer (lógica local mantida)
  Array.from(messageBufferPerChatId.entries()).forEach(([chatId, messages]) => {
      const unansweredMessages = messages.filter(m => !m.answered);
      if (unansweredMessages.length > 0) {
          logger.info(`Mensagens não respondidas encontradas para o chatId: ${chatId}`);
          const groupedMessages = unansweredMessages
              .map(message => message.messages[0])
              .filter(msg => msg)
              .join('\n');
          const mockMessage = { body: groupedMessages, from: chatId };

          const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
          let conversation = '';
          if (fs.existsSync(filePath)) {
              conversation = fs.readFileSync(filePath, `utf-8`);
          }
          const messageToGemini = `${conversation}\n\n${groupedMessages}`;
          logger.info(`Mensagens agrupadas para ${chatId}:`, groupedMessages);
          // Chama responderChat (definido abaixo) passando client
          responderChat(client, mockMessage, chatId, messageToGemini);
      }
  });

  // --- DEFINIÇÃO DO HANDLER onMessage DENTRO DE START ---
  client.onMessage((message: wppconnect.Message) => {
    logger.info(`Mensagem recebida:`, message.type);
    (async () => {
          // Chama identifyNameAndInterest ao receber QUALQUER mensagem de chat (texto ou áudio)
          if (message.type === `chat` || message.type === `ptt` || message.type === `audio`) {
              const chatId: string = message.chatId as string;
              // Passa o objeto client para identifyNameAndInterest
              identifyNameAndInterest(client, chatId); // Chama identifyNameAndInterest aqui, passando client e chatId
          }

          if (message.type === `ptt` || message.type === `audio`) {
              logger.info(`Mensagem de áudio recebida!`);
              const chatId: string = message.chatId as string;
              const intervalo_aleatorio = Math.random() * (20 - 15) + 15;
              await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1000));
              await client.startTyping(chatId); // client está acessível
              const audioDir = path.join(__dirname, 'config', 'transcrever');
              if (!fs.existsSync(audioDir)) {
                  fs.mkdirSync(audioDir, { recursive: true });
                  logger.info(`Diretório ${audioDir} criado.`);
              }
              const audioPath = path.join(audioDir, `${Date.now()}.mp3`);
              try {
                  // Usa decryptAndSaveFile para baixar e salvar o arquivo de áudio
                  await client.decryptAndSaveFile(message, audioPath);
                  logger.info(`Áudio salvo em: ${audioPath}`);

                  // Importa a função de transcrição
                  const transcribeModule = await import('../../../src/backend/tollsIA/transcrever_audio.cjs'); // Corrigido: toolsIA -> tollsIA
                  const transcribeAudio = transcribeModule.default; // Acessa a exportação padrão
                  const transcription = await transcribeAudio(audioPath, clientePath); // Chama a função corretamente, passando clientePath
                  logger.info(`Transcrição do áudio: ${transcription}`);

                  // Simula uma mensagem de texto com a transcrição
                  const mockMessage = {
                      type: 'chat',
                      body: transcription,
                      chatId: chatId,
                      from: chatId,
                      isGroupMsg: false,
                  };

// Continua a lógica como se fosse uma mensagem de texto
                  saveMessageToFile(clienteIdCompleto || '', clientePath, chatId, transcription, 'User');
                  logger.info(`[Local Save] Mensagem (transcrição de áudio) de ${chatId} salva localmente.`);
                  // Atualiza a data da última mensagem recebida
                  updateLastReceivedMessageDate(clientePath, chatId);

                  if (AI_SELECTED === `GPT`) {
                      logger.info(`Inicializando nova sessão de chat com GPT...`);
                      await initializeNewAIChatSession(chatId);
                  }
                  if (!messageBufferPerChatId.has(chatId)) {
                      messageBufferPerChatId.set(chatId, []);
                  }
                  messageBufferPerChatId.set(chatId, [
                      ...(messageBufferPerChatId.get(chatId) || []),
                      { messages: [transcription], answered: false },
                  ]);
                  try {
                      saveMessageBuffer();
                  } catch (error) {
                      logger.error('Erro ao salvar o buffer de mensagens:', error);
                  }

                  if (messageTimeouts.has(chatId)) {
                      clearTimeout(messageTimeouts.get(chatId));
                  }
                  logger.info(`Aguardando novas mensagens do cliente ${chatId}...`);

                  const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
                  let conversation = '';
                  if (fs.existsSync(filePath)) {
                      conversation = fs.readFileSync(filePath, `utf-8`);
                  }
                  const messageToGemini = `${conversation}\n\n${transcription}`;

                  if (leadSummaryTimeouts.has(chatId)) {
                      const { leadId, contatoId } = leadSummaryTimeouts.get(chatId)!;
                      logger.info(`Nova mensagem (transcrição) recebida para lead ${leadId}. Reiniciando timer de resumo.`);
                      startLeadSummaryTimer(client, clienteIdCompleto!, chatId, leadId, contatoId); // Passa client
                  }

                  messageTimeouts.set(
                      chatId,
                      setTimeout(() => {
                          (async () => {
                              responderChat(client, mockMessage, chatId, messageToGemini); // Passa client e mockMessage
                          })();
                      }, Math.random() * (20 - 15) * 1000 + 15 * 1000)
                  );
              } catch (error) {
                  logger.error('Erro ao processar mensagem de áudio:', error);
                  sendMessage(client, clientePath, chatId, "O áudio não está carregando aqui. Consegue escrever?"); // client está acessível
              }
          } else {
              // logger.info(`Tipo de mensagem não suportado:`, message.type);
          }

          if (
              message.type === `chat` &&
              !message.isGroupMsg &&
              message.chatId !== `status@broadcast`
          ) {
              const chatId: string = message.chatId as string;
              logger.info(`Mensagem recebida de ${chatId}:`, message.body);

              // Salvar mensagem localmente usando a função unificada
              saveMessageToFile(clienteIdCompleto || '', clientePath, chatId, message.body || '', 'User');
              logger.info(`[Local Save] Mensagem recebida de ${chatId} salva localmente.`);
              // Atualiza a data da última mensagem recebida
              updateLastReceivedMessageDate(clientePath, chatId);

              // --- Monitoramento da Conversa (após receber mensagem) ---
              logger.info(`[Monitoramento Trigger] Iniciando análise de intenção/tags para ${chatId} após receber mensagem.`);
              let chatListaNome: string | null = null;
              const chatDadosPath = path.join(__dirname, `Chats`, `Historico`, chatId, `Dados.json`);
              if (fs.existsSync(chatDadosPath)) {
                  try {
                      const fileContent = fs.readFileSync(chatDadosPath, `utf-8`);
                      const fileData = JSON.parse(fileContent);
                      chatListaNome = fileData.listaNome || null;
                  } catch (err) {
                      logger.error(`Erro ao ler Dados.json para monitoramento de ${chatId}: ${err}`);
                  }
              }

              await monitorarConversa(clientePath, chatId, chatListaNome, client);
              logger.info(`[Monitoramento Trigger] Análise de intenção/tags concluída para ${chatId}.`);
              // --- FIM Monitoramento ---


              // Lógica de buffer local (mantida por enquanto) - Ajustar para usar o histórico unificado se necessário
              // A lógica de buffer parece separada do histórico principal para agrupar mensagens rápidas.
              // Manteremos o buffer por enquanto, mas a leitura para a IA deve usar o histórico principal.
              if (AI_SELECTED === `GPT`) {
                  logger.info(`Inicializando nova sessão de chat com GPT...`);
                  await initializeNewAIChatSession(chatId);
              }
              if (!messageBufferPerChatId.has(chatId)) {
                  messageBufferPerChatId.set(chatId, []);
              }
              messageBufferPerChatId.set(chatId, [
                  ...(messageBufferPerChatId.get(chatId) || []),
                  { messages: [message.body ? message.body : ``], answered: false },
              ]);
              try {
                  saveMessageBuffer();
              } catch (error) {
                  logger.error('Erro ao salvar o buffer de mensagens:', error);
              }

              if (messageTimeouts.has(chatId)) {
                  clearTimeout(messageTimeouts.get(chatId));
              }
              logger.info(`Aguardando novas mensagens do cliente ${chatId}...`);

              // Verifica se IGNORAR_CONTATO está definido como "sim" em infoCliente.json
              if (infoConfig.IGNORAR_CONTATO === "sim") {
                await IgnoreLead(chatId, __dirname);
              }
              
              // Verificar se o chatId deve ser ignorado (lógica local mantida)
              const ignoredChatIdsFilePath = path.join(__dirname, 'config', 'ignoredChatIds.json');
              let isChatIdIgnored = false;
              if (fs.existsSync(ignoredChatIdsFilePath)) {
                  try {
                      const ignoredChatIdsFileContent = fs.readFileSync(ignoredChatIdsFilePath, 'utf-8');
                      const ignoredChatIds = JSON.parse(ignoredChatIdsFileContent);
                      // Adiciona tipo 'string' ao parâmetro 'id' do some
                      if (ignoredChatIds.some((id: string) => formatChatId(message.chatId) === formatChatId(id))) {
                          logger.info(`ChatId ${message.chatId} ignorado.`);
                          isChatIdIgnored = true;
                          // Lógica de notificação mantida
                          const dadosFilePath = path.join(__dirname, 'Chats', 'Historico', chatId, 'Dados.json');
                          let nome = "Não identificado";
                          try {
                              if (fs.existsSync(dadosFilePath)) {
                                  const dadosFileContent = fs.readFileSync(dadosFilePath, 'utf-8');
                                  const dados = JSON.parse(dadosFileContent);
                                  nome = dados.name || nome;
                              }
                          } catch (error) { logger.error('Erro ao ler Dados.json (ignore):', error); }
                          const chatidContato = typeof message.chatId === 'string' ? message.chatId.split('@')[0] : '';
                          await sendMessage(client, clientePath, TARGET_CHAT_ID, `Lead ${nome} ${chatidContato} precisa de atencão. Por favor, responda o lead. Última mensagem:\n\n${message.body}`); // Passa client e clientePath
                          return;
                      }
                  } catch (ignoreError) {
                      logger.error("Erro ao ler/parsear ignoredChatIds.json:", ignoreError);
                  }
              }

              if (!isChatIdIgnored) {
                  const intervalo_aleatorio = Math.random() * (20 - 15) + 15;
                  const allMessages = messageBufferPerChatId.get(chatId) || [];
                  const unansweredMessages = allMessages.filter(m => !m.answered);
                  const currentMessage = unansweredMessages.map(m => m.messages).join(`\n`);

                  const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
                  let conversation = '';
                  if (fs.existsSync(filePath)) {
                      conversation = fs.readFileSync(filePath, `utf-8`);
                  }
                  const messageToGemini = `${conversation}\n\n${currentMessage}`;

                  if (leadSummaryTimeouts.has(chatId)) {
                      const { leadId, contatoId } = leadSummaryTimeouts.get(chatId)!;
                      logger.info(`Nova mensagem recebida para lead ${leadId}. Reiniciando timer de resumo.`);
                      startLeadSummaryTimer(client, clienteIdCompleto!, chatId, leadId, contatoId); // Passa client
                  }

                  messageTimeouts.set(
                      chatId,
                      setTimeout(() => {
                          (async () => {
                              responderChat(client, message, chatId, messageToGemini); // Passa client
                          })();
                      }, intervalo_aleatorio * 1000)
                  );
              }
          }
      })();
  });} // <-- FIM DO client.onMessage

  // --- DEFINIÇÃO DAS FUNÇÕES CHAMADAS PELO onMessage DENTRO DE START ---

  // Adiciona client como primeiro parâmetro
  async function responderChat(client: wppconnect.Whatsapp, message: any, chatId: string, messageToGemini: string) {
      const intervalo_aleatorio = Math.random() * (20 - 15) + 15;

      await new Promise((resolve) => setTimeout(resolve, intervalo_aleatorio * 1500));

      try {
          let answer = await mainGoogleChat({ currentMessageChat: messageToGemini, chatId, clearHistory: true, __dirname });
          if (answer === `_fim` || answer === undefined) return;

          // Verifica se deve remover emojis
          if (infoConfig.EMOJIS === "sim") {
            logger.info(`[responderChat] EMOJIS=sim. Removendo emojis da resposta para ${chatId}.`);
            answer = removeEmojis(answer);
          }

          const PROMPT_SPLIT = infoConfig.PROMPT_SPLIT || "Você precisa dividir essa mensagem? responda apenas SIM ou NÃO";
          const shouldSplit = await mainGoogleBG({ currentMessageBG: `${PROMPT_SPLIT}\n\n${answer}`, chatId, clearHistory: true, __dirname });

          let splitMessagesArray: string[];
          if (shouldSplit && shouldSplit.toUpperCase().includes("SIM")) {
              const filteredAnswer = answer;
              splitMessagesArray = splitMessages(filteredAnswer);
              logger.info(`Mensagem precisa ser dividida, enviando para splitMessages para ${chatId}...`);
          } else {
              splitMessagesArray = [answer];
              logger.info(`Mensagem não precisa ser dividida, enviando mensagem direta para ${chatId}...`);
          }

          logger.info(`Enviando mensagens para ${chatId}...`);
          await sendMessagesWithDelay({ client, messages: splitMessagesArray, targetNumber: message.from, __dirname });
          await markMessagesAsAnswered(chatId);
          checkResposta(client, clientePath, chatId, answer); // Passa client
          await updateLastSentMessageDate(clientePath, chatId);

       } catch (error: any) {
           logger.error(`Erro ao obter/enviar resposta da IA (chat) para ${chatId}:`, error);
           let retryCount = 0;
           const maxRetries = 3;
           while (retryCount < maxRetries) {
               try {
                   logger.info(`Tentando novamente (tentativa ${retryCount + 1} de ${maxRetries})...`);
                   let answerRetry = await mainGoogleChat({ currentMessageChat: messageToGemini, chatId, clearHistory: true, __dirname });
                   if (answerRetry === `_fim` || answerRetry === undefined) return;

                   // Verifica se deve remover emojis na tentativa
                   if (infoConfig.EMOJIS === "sim") {
                       logger.info(`[responderChat - Retry] EMOJIS=sim. Removendo emojis da resposta para ${chatId}.`);
                       answerRetry = removeEmojis(answerRetry);
                   }

                   const PROMPT_SPLIT_RETRY = infoConfig.PROMPT_SPLIT || "Você precisa dividir essa mensagem?";
                   const shouldSplitRetry = await mainGoogleBG({ currentMessageBG: `${PROMPT_SPLIT_RETRY}\n\n${answerRetry}`, chatId, clearHistory: true, __dirname });

                   let splitMessagesArrayRetry: string[];
                   if (shouldSplitRetry && shouldSplitRetry.toUpperCase().includes("SIM")) {
                       const filteredAnswerRetry = answerRetry;
                       splitMessagesArrayRetry = splitMessages(filteredAnswerRetry);
                       logger.info(`Mensagem precisa ser dividida (retry), enviando para splitMessages para ${chatId}...`);
                   } else {
                       splitMessagesArrayRetry = [answerRetry];
                       logger.info(`Mensagem não precisa ser dividida (retry), enviando mensagem direta para ${chatId}...`);
                   }

                   await sendMessagesWithDelay({ client, messages: splitMessagesArrayRetry, targetNumber: message.from, __dirname });
                   await markMessagesAsAnswered(chatId);
                   checkResposta(client, clientePath, chatId, answerRetry); // Passa client
                   await updateLastSentMessageDate(clientePath, chatId);

                   logger.info(`Mensagens (retry) respondidas com sucesso para ${chatId}.`);
                   // checkResposta(client, clientePath, chatId, answerRetry); // Passa client - Removido pois já é chamado acima
                   break;
               } catch (retryError) {
                   retryCount++;
                   logger.error(`Erro na tentativa ${retryCount} para ${chatId}:`, retryError);
                   if (retryCount < maxRetries) {
                       const retryDelay = 5000 * retryCount;
                       logger.info(`Aguardando ${retryDelay / 1000} segundos antes da próxima tentativa...`);
                       await new Promise(resolve => setTimeout(resolve, retryDelay));
                   }
               }
           }
           if (retryCount === maxRetries) {
               logger.error(`Falha definitiva ao enviar a mensagem para ${chatId} após ${maxRetries} tentativas.`);
               try {
                   sendMessage(client, clientePath, TARGET_CHAT_ID, `⚠️ Falha definitiva ao enviar mensagem para ${chatId} do cliente ${cliente}. Verificar logs.`); // Passa client, clientePath
               } catch (sendError) {
                   logger.error("Erro ao enviar mensagem de erro para admin:", sendError);
               }
           }
       } finally {
           // Nenhuma ação específica no finally por enquanto
       }
   } // <-- FIM DE responderChat
   
   // Adiciona client como primeiro parâmetro
   async function identifyNameAndInterest(client: wppconnect.Whatsapp, chatId: string) {
       if (!clienteIdCompleto) {
           logger.error("[identifyNameAndInterest] clienteIdCompleto não definido. Abortando.");
           return;
       }
       try {
           const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);
           if (!fs.existsSync(filePath)) {
               logger.warn(`Arquivo de histórico local não encontrado para ${chatId}. Não é possível analisar lead.`);
               return;
           }
           const conversation = fs.readFileSync(filePath, `utf-8`); // Usa histórico local por enquanto

           // Lê dados básicos do Dados.json local
           const dadosPath = path.join(__dirname, `Chats`, `Historico`, chatId, `Dados.json`);
           let chatData: any = {};
           if (fs.existsSync(dadosPath)) {
               try {
                   const fileContent = fs.readFileSync(dadosPath, `utf-8`);
                   chatData = JSON.parse(fileContent);
               } catch (err) {
                   logger.error(`Erro ao ler Dados.json para identifyNameAndInterest em ${chatId}: ${err}`);
                   // Se houver erro, inicializa com dados básicos
                   chatData = {
                       name: 'Não identificado',
                       sobrenome: '',
                       telefone: chatId.split('@')[0],
                       tags: [],
                       listaNome: null,
                       lead: 'não',
                   };
               }
           } else {
                // Se não existir, cria um novo objeto com a estrutura desejada
                const initialData = {
                    name: 'Não identificado',
                    sobrenome: '',
                    telefone: chatId.split('@')[0],
                    tags: [],
                    listaNome: null,
                    lead: 'não',
                };
                try {
                    fs.writeFileSync(dadosPath, JSON.stringify(initialData, null, 2), 'utf-8');
                    chatData = initialData;
                    logger.info(`Dados.json criado para ${chatId} em identifyNameAndInterest.`);
                } catch (writeErr) {
                    logger.error(`Erro CRÍTICO ao criar Dados.json para ${chatId}: ${writeErr}`);
                    return; // Não pode prosseguir sem Dados.json
                }
           }


           // 1. Identificar Nome se não existir
           if (chatData.name === 'Não identificado' || !chatData.name) {
               logger.info(`Nome não identificado para ${chatId}. Tentando identificar...`);
               const namePrompt = infoConfig.NAME_PROMPT || ''; // Assumindo que NAME_PROMPT existe em infoCliente.json
               if (namePrompt) {
                   const nameResponse = await makeRequestWithRetryName(namePrompt, chatId, conversation);
                   if (nameResponse && nameResponse.trim() !== '' && nameResponse.toUpperCase() !== 'NÃO IDENTIFICADO') {
                       chatData.name = nameResponse.trim();
                       logger.info(`Nome identificado pela IA: ${chatData.name}`);
                       updateLeadData(chatId, 'name', chatData.name); // Usa updateLeadData
                   } else {
                        logger.info(`IA não identificou o nome para ${chatId}. Resposta: ${nameResponse}`);
                   }
               } else {
                   logger.warn(`NAME_PROMPT não encontrado em infoCliente.json. Não é possível identificar o nome.`);
               }
           } else {
                logger.info(`Nome já identificado para ${chatId}: ${chatData.name}`);
           }

           // 2. Identificar Interesse
           logger.info(`Tentando identificar interesse para ${chatId}...`);
           const interestPrompt = infoConfig.INTEREST_PROMPT || ''; // Assumindo que INTEREST_PROMPT existe em infoCliente.json
           if (interestPrompt) {
                const interestResponse = await makeRequestWithRetryInterest(interestPrompt, chatId, conversation);
                if (interestResponse && interestResponse.trim() !== '') {
                    chatData.interest = interestResponse.trim();
                    logger.info(`Interesse identificado pela IA: ${chatData.interest}`);
                    updateLeadData(chatId, 'interest', chatData.interest); // Usa updateLeadData
                } else {
                    logger.info(`IA não identificou o interesse para ${chatId}. Resposta: ${interestResponse}`);
                }
           } else {
                logger.warn(`INTEREST_PROMPT não encontrado em infoCliente.json. Não é possível identificar o interesse.`);
           }

           // 3. Identificar Orçamento e Data do Orçamento (se aplicável)
           // Assumindo que existe um prompt específico para Orçamento em infoCliente.json (ex: ORCAMENTO_PROMPT)
           logger.info(`Tentando identificar orçamento e data para ${chatId}...`);
           const orcamentoPrompt = infoConfig.ORCAMENTO_PROMPT || '';
           if (orcamentoPrompt) {
               const orcamentoResponse = await makeRequestWithRetryOrçamento(orcamentoPrompt, chatId, conversation);
               if (orcamentoResponse && orcamentoResponse.trim() !== '') {
                   // A resposta da IA para orçamento pode precisar de parsing para separar valor e data
                   // Por enquanto, vamos salvar a resposta bruta e você pode refinar o parsing depois
                   chatData.orçamento = orcamentoResponse.trim(); // Salva a resposta bruta no campo orçamento
                   logger.info(`Orçamento/Data identificado pela IA: ${chatData.orçamento}`);
                   updateLeadData(chatId, 'orçamento', chatData.orçamento); // Usa updateLeadData
                   // Se a resposta contiver uma data, você pode tentar extraí-la e salvar em 'orçamentoData'
                   // Exemplo simples (pode precisar de lógica mais robusta):
                   const dateMatch = orcamentoResponse.match(/\d{1,2}\/\d{1,2}\/\d{4}/); // Exemplo: dd/mm/yyyy
                   if (dateMatch) {
                       chatData.orçamentoData = dateMatch[0];
                       logger.info(`Data de Orçamento identificada: ${chatData.orçamentoData}`);
                       updateLeadData(chatId, 'orçamentoData', chatData.orçamentoData); // Usa updateLeadData
                   }
               } else {
                   logger.info(`IA não identificou orçamento/data para ${chatId}. Resposta: ${orcamentoResponse}`);
               }
           } else {
               logger.warn(`ORCAMENTO_PROMPT não encontrado em infoCliente.json. Não é possível identificar orçamento/data.`);
           }


           // 4. Verificar condição de LEAD
           logger.info(`Verificando condição de lead para ${chatId}...`);
           const leadPrompt = infoConfig.LEAD_PROMPT || '';
           if (leadPrompt) {
               const leadCheckResponse = await makeRequestWithRetryLead(leadPrompt, chatId, conversation);

               if (leadCheckResponse && leadCheckResponse.toUpperCase().includes("LEAD: SIM")) {
                   logger.info(`Condição de lead atingida para ${chatId}!`);

                   // Atualiza Dados.json para marcar como lead
                   if (chatData.lead !== 'sim') {
                       chatData.lead = 'sim';
                       updateLeadData(chatId, 'lead', 'sim'); // Usa updateLeadData
                       logger.info(`Marcado como lead em Dados.json para ${chatId}.`);

                       // Chama handleLeadIdentification para salvar/atualizar em leads.json e iniciar timer de resumo
                       // Passa os dados atuais do chatData para handleLeadIdentification
                       try {
                           await handleLeadIdentification(
                               client, // Passa o objeto client
                               clienteIdCompleto,
                               chatId,
                               chatData.name,
                               chatData.telefone,
                               null, // listaOrigemId - precisa ser obtido se veio de disparo
                               chatData.listaNome, // listaOrigemNome - já está em Dados.json
                               chatData.tags // tagsIniciais - já estão em Dados.json
                           );
                       } catch (error) {
                           logger.error(`Erro ao chamar handleLeadIdentification para ${chatId}:`, error);
                       }
                   } else {
                        logger.info(`Já marcado como lead em Dados.json para ${chatId}.`);
                        // Se já é lead, apenas garante que o timer de resumo está ativo
                        const existingLead = await findLeadByChatId(clienteIdCompleto!, chatId);
                        if (existingLead && !leadSummaryTimeouts.has(chatId)) {
                            logger.info("Timer de resumo não encontrado para lead existente " + existingLead.id + ". Iniciando...");
                            const leadContatoId = existingLead && existingLead.contatoPrincipalId ? existingLead.contatoPrincipalId : chatData.contatoPrincipalId; // Tenta usar contatoPrincipalId do lead, fallback para Dados.json
                            startLeadSummaryTimer(client, clienteIdCompleto!, chatId, existingLead.id, leadContatoId); // Passa client
                        }
                   }


               } else {
                   logger.info(`Condição de lead NÃO atingida para ${chatId}. Resposta IA: ${leadCheckResponse}`);
               }
           } else {
                logger.warn(`LEAD_PROMPT não encontrado em infoCliente.json. Análise de lead desativada.`);
           }


           // A notificação de Novo Lead e a geração do resumo são tratadas por handleLeadIdentification e generateAndSaveSummary (via timer).


       } catch (error) {
           logger.error(`Erro na função identifyNameAndInterest para ${chatId}:`, error);
       }
   }  // <-- FIM DE identifyNameAndInterest

   // Função para atualizar os dados do lead no arquivo Dados.json
   function updateLeadData(chatId: string, field: `name` | `interest` | `phone` | `summary` | `orçamento` | `orçamentoData` | `lead`, value: any) {
     const fileName = `Dados.json`;
     const filePath = path.join(__dirname, `Chats`, `Historico`, `${chatId}`, fileName);

     // Lê o conteúdo do arquivo
     let fileContent = '{}';
     if (fs.existsSync(filePath)) {
         fileContent = fs.readFileSync(filePath, `utf-8`);
     }
     let fileData: any = {};
     try {
         fileData = JSON.parse(fileContent);
     } catch (error) {
         logger.error(`Erro ao parsear Dados.json para updateLeadData em ${chatId}:`, error);
         // Se houver erro de parse, inicializa com dados básicos
         fileData = {
             name: 'Não identificado',
             sobrenome: '',
             telefone: chatId.split('@')[0],
             tags: [],
             listaNome: null,
             lead: 'não',
         };
     }

     // Atualiza o campo no objeto
     fileData[field] = value;

     // Converte o objeto para JSON
     const updatedContent = JSON.stringify(fileData, null, 2); // Adiciona formatação

     // Escreve o conteúdo atualizado no arquivo
     try {
         fs.writeFileSync(filePath, updatedContent, `utf-8`);
         logger.info(`Atualização do lead em Dados.json para ${chatId}:`, { field, value });
     } catch (error) {
         logger.error(`Erro ao escrever em Dados.json para updateLeadData em ${chatId}:`, error);
     }
   }