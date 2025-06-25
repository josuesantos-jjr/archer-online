import { NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Content, // Importa o tipo Content para o histórico
} from '@google/generative-ai';

// Define interfaces para clareza
interface MessagePart {
  text: string;
}
 
interface HistoryEntry {
  role: 'user' | 'model'; // Define os papéis possíveis
  parts: MessagePart[];
}
 
interface Client {
  id: string;
  nome: string; // Adicione a propriedade 'nome'
  ativo: boolean; // Adicione a propriedade 'ativo' (ou outras relevantes)
  // Adicione outras propriedades esperadas do cliente se necessário
}
 
interface Log {
  id: string;
  timestamp: string;
  level: string;
  message: string;
}
 
import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import * as fs from 'node:fs'; // Importar fs síncrono para existsSync
 
 // Função local para encontrar cliente pelo nome da pasta
 async function findClientByNameLocal(clientName: string): Promise<Client[]> {
     const baseDir = path.join(process.cwd(), 'clientes');
     const clientTypes = ['ativos', 'cancelados', 'modelos']; // Tipos de pasta de cliente
     const foundClients: Client[] = [];
 
     for (const type of clientTypes) {
         const typeDir = path.join(baseDir, type);
         if (fs.existsSync(typeDir)) { // Usar fs síncrono para verificar existência
             const entries = await fsPromises.readdir(typeDir, { withFileTypes: true });
             for (const entry of entries) {
                 if (entry.isDirectory()) {
                     // Comparação case-insensitive e removendo espaços extras
                     if (entry.name.toLowerCase().trim() === clientName.toLowerCase().trim()) {
                         foundClients.push({
                             id: `${type}/${entry.name}`, // ID local é o caminho da pasta
                             nome: entry.name,
                             ativo: type === 'ativos', // Exemplo simples de status
                             // Adicionar outras propriedades se necessário (lendo .env, etc.)
                         });
                         // Se encontrarmos uma correspondência exata, podemos parar ou continuar buscando por outras (depende da regra de negócio)
                         // Por enquanto, retorna a primeira correspondência exata encontrada
                         return foundClients;
                     }
                 }
             }
         }
     }
 
     return foundClients; // Retorna array vazio se não encontrar
 }
 
 // Função local para obter logs recentes do arquivo log.txt
 async function getRecentClientLogsLocal(clientId: string, limit: number): Promise<Log[]> {
     const logFilePath = path.join(process.cwd(), 'clientes', clientId, 'config', 'Erros', 'log.txt');
     const recentLogs: Log[] = [];
 
     if (!fs.existsSync(logFilePath)) { // Usar fs síncrono para verificar existência
         console.warn(`Arquivo de log não encontrado para o cliente ${clientId} em ${logFilePath}`);
         return []; // Retorna array vazio se o arquivo não existir
     }
 
     try {
         const logContent = await fsPromises.readFile(logFilePath, 'utf-8');
         const lines = logContent.split('\n').filter(line => line.trim() !== ''); // Ignora linhas vazias
 
         // Processa as últimas 'limit' linhas
         const startIndex = Math.max(0, lines.length - limit);
         for (let i = startIndex; i < lines.length; i++) {
             const line = lines[i];
             // Tenta parsear a linha do log. Assumindo um formato simples como "[TIMESTAMP][LEVEL] MESSAGE"
             const logMatch = line.match(/^\[(.*?)\]\[(.*?)\]\s*(.*)$/);
             if (logMatch && logMatch[1] && logMatch[2] && logMatch[3]) {
                 recentLogs.push({
                     id: `log-${i}`, // ID simples baseado na linha
                     timestamp: logMatch[1].trim(),
                     level: logMatch[2].trim(),
                     message: logMatch[3].trim(),
                 });
             } else {
                 // Se a linha não corresponder ao formato esperado, adiciona como log bruto
                 recentLogs.push({
                     id: `log-${i}`,
                     timestamp: new Date().toISOString(), // Usa timestamp atual como fallback
                     level: 'RAW',
                     message: line,
                 });
                 console.warn(`Linha de log com formato inesperado para cliente ${clientId}: ${line}`);
             }
         }
 
         return recentLogs;
 
     } catch (error) {
         console.error(`Erro ao ler arquivo de log para cliente ${clientId} em ${logFilePath}:`, error);
         return []; // Retorna array vazio em caso de erro de leitura
     }
 }
 
 // --- Configuração da API Gemini ---
 
 
 // --- Função da Rota POST ---
 export async function POST(request: Request) {
   const geminiApiKey = process.env.GEMINI_API_KEY;
 
   const genAI = new GoogleGenerativeAI(geminiApiKey || ''); // Passa string vazia se nulo, mas a verificação acima deve pegar
   const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
 
   const generationConfig = {
     temperature: 0.9,
     topK: 1,
     topP: 1,
     maxOutputTokens: 2048,
   };
 
   const safetySettings = [
     { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
     { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
     { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
     { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
   ];
 
   // Instrução do sistema para definir o papel da IA
   const systemInstruction = `Você é Ana, minha assistente virtual especializada neste sistema de gerenciamento de clientes. Sua função é me ajudar a obter informações sobre clientes, leads, configurações e logs do sistema. Responda de forma clara, concisa e útil, utilizando os dados fornecidos quando disponíveis. Se precisar de informações específicas de um cliente, mencione o nome dele. Se a informação não estiver disponível nos dados fornecidos, informe que não a encontrou.`;
 
   // Verifica a chave da API aqui dentro para retornar a resposta HTTP corretamente
   if (!geminiApiKey) {
     console.error('GEMINI_API_KEY não configurada no servidor.');
     return NextResponse.json(
       { error: 'Configuração do serviço de IA indisponível.' },
       { status: 503 } // Service Unavailable
     );
   }
 
   try {
     const { prompt, history } = await request.json() as { prompt: string; history: HistoryEntry[] };
 
     if (!prompt || !Array.isArray(history)) { // Verifica se history é um array
       return NextResponse.json(
         { error: 'Prompt (string) e history (array) são obrigatórios' },
         { status: 400 }
       );
     }
 
     let retrievedData = ''; // Dados recuperados do Firestore (ou outras fontes)
     let finalPrompt = prompt; // O prompt final a ser enviado para a IA
 
     // --- Placeholder para Detecção de Intenção ---
     const lowerCasePrompt = prompt.toLowerCase();
     let intent = { scope: 'general', clientName: null as string | null, dataType: 'unknown' };
 
     const clientMatch = lowerCasePrompt.match(/cliente\s+([a-zA-Z0-9\s]+)/); // Regex ajustado para nomes com espaços
     if (clientMatch && clientMatch[1]) {
         intent.scope = 'specific_client';
         intent.clientName = clientMatch[1].trim(); // Remove espaços extras
         console.log(`Intenção detectada: Buscar dados do cliente ${intent.clientName}`);
         if (lowerCasePrompt.includes('log') || lowerCasePrompt.includes('disparo') || lowerCasePrompt.includes('histórico')) {
             intent.dataType = 'logs';
         }
         // Adicionar mais 'else if' para outros tipos de dados (config, leads, etc.)
     } else {
         console.log('Intenção detectada: Requisição geral');
     }
     // --- Fim do Placeholder ---
 
 
     // Se a intenção for buscar dados de um cliente específico...
     if (intent.scope === 'specific_client' && intent.clientName) {
       console.log(`Buscando dados para o cliente: ${intent.clientName}`);
       // Buscar cliente localmente
       const clients = await findClientByNameLocal(intent.clientName);
       const client = clients.length > 0 ? clients[0] as Client : null; // Pega o primeiro cliente encontrado ou null
 
       if (client) {
         const clientId = client.id; // O ID local será o caminho da pasta (ex: ativos/Alpha)
         console.log(`Cliente encontrado localmente: ID ${clientId}`);
         retrievedData += `\n--- Informações do Cliente ${intent.clientName} [Fonte: Local] ---\n`;
         retrievedData += `ID: ${clientId}\n`;
         // Adicione outras informações básicas do cliente se disponíveis localmente (ex: lendo o .env)
 
         // Se a intenção pedir por logs (ou como padrão se não especificado)
         if (intent.dataType === 'logs' || intent.dataType === 'unknown') {
             try {
               console.log(`Buscando logs recentes localmente para o cliente ID: ${clientId}`);
               const recentLogs = await getRecentClientLogsLocal(clientId, 10) as Log[]; // Asserção de tipo
 
               // Verifica se retornou um array e se tem itens
               if (Array.isArray(recentLogs) && recentLogs.length > 0) {
                 retrievedData += '\n--- Últimos Logs Relevantes [Fonte: Local] ---\n';
 
                 // *** INÍCIO DA SEÇÃO CORRIGIDA ***
                 recentLogs.forEach((log: Log, index: number) => { // Usa a interface Log
                   try {
                     // Verifica se 'log' é um objeto válido
                     if (log && typeof log === 'object') {
                       const level = log.level ?? 'INFO'; // Valor padrão se 'level' for null/undefined
                       const message = log.message ?? ''; // Valor padrão (string vazia) se 'message' for null/undefined
 
                       // --- Tratamento do Timestamp ---
                       // O timestamp já vem formatado como string de getRecentClientLogsLocal
                       const formattedTimestamp = log.timestamp;
                       // --- Fim do Tratamento do Timestamp ---
 
                       // Garante que a mensagem seja tratada como string
                       const messageStr = String(message);
                       const truncatedMessage = messageStr.substring(0, 200) + (messageStr.length > 200 ? '...' : '');
 
                       retrievedData += `[${formattedTimestamp}][${level}] ${truncatedMessage}\n`;
 
                     } else {
                       console.warn(`Item inválido encontrado no índice ${index} dos logs recentes:`, log);
                       retrievedData += `[LOG INVÁLIDO NO ÍNDICE ${index}]\n`;
                     }
                   } catch (loopError) {
                       console.error(`Erro ao processar log no índice ${index}:`, loopError, 'Log original:', log);
                       retrievedData += `[ERRO AO PROCESSAR LOG NO ÍNDICE ${index}: ${loopError}]\n`; // Informa sobre o erro no output
                   }
                 });
                 // *** FIM DA SEÇÃO CORRIGIDA ***
 
                 console.log(`${recentLogs.length} logs encontrados e processados (ou com erro).`);
 
               } else if (Array.isArray(recentLogs)) { // Verifica se é array vazio
                 retrievedData += 'Nenhum log relevante recente encontrado localmente para este cliente.\n';
                 console.log('Nenhum log encontrado localmente.');
               } else {
                 // Caso getRecentClientLogsLocal retorne algo inesperado (não um array)
                 retrievedData += 'Não foi possível obter os logs recentes localmente (formato inesperado).\n';
                  console.warn('Retorno inesperado de getRecentClientLogsLocal:', recentLogs);
               }
             } catch (error) {
               console.error(`Erro ao buscar logs recentes localmente para cliente ${clientId}:`, error);
               retrievedData += 'Erro ao buscar logs recentes localmente.\n';
             }
         }
         // Adicionar lógica para buscar outros tipos de dados (config, etc.) aqui
         // else if (intent.dataType === 'config') { ... }
 
         // Adiciona os dados recuperados ao início do prompt para dar contexto à IA
         finalPrompt = `${retrievedData}\n\nCom base nas informações acima (se houver), responda à seguinte solicitação:\n${prompt}`;
 
       } else {
         console.log(`Cliente "${intent.clientName}" não encontrado localmente.`);
         // Informa ao usuário que o cliente não foi encontrado e prossegue sem dados específicos
         finalPrompt = `Tentei buscar informações para o cliente "${intent.clientName}", mas não o encontrei no sistema local. Respondendo à solicitação geral:\n${prompt}`;
       }
     }
 
     // Prepara o histórico para o modelo, incluindo a instrução do sistema
     const chatHistory: Content[] = [
          { role: 'user', parts: [{ text: systemInstruction }] },
          { role: 'model', parts: [{ text: "Entendido. Estou pronta para ajudar." }] }, // Resposta simulada da IA à instrução
         // Mapeia o histórico recebido para o formato esperado pela API Gemini
         ...history.map(h => ({
             role: h.role,
             parts: h.parts,
         })) as Content[], // Faz a asserção para Content[]
     ];
 // Inicia o chat com o histórico formatado
     const chat = model.startChat({
       history: chatHistory,
       generationConfig,
       safetySettings,
     });
 // Envia o prompt final (com ou sem dados recuperados)
     console.log("Enviando prompt para o modelo Gemini:", finalPrompt);
     const result = await chat.sendMessage(finalPrompt);
     const response = await result.response;
     const text = response.text();
 // Retorna a resposta do modelo
     console.log("Resposta recebida do modelo Gemini.");
     return NextResponse.json({ response: text });
 
   } catch (error: any) {
     console.error('Erro na API /api/chat-ana:', error);
     let errorMessage = 'Erro desconhecido';
     if (error instanceof Error) {
       errorMessage = error.message;
     }
     const errorDetails = process.env.NODE_ENV === 'development' ? errorMessage : undefined;
 
     return NextResponse.json(
       { error: 'Erro interno ao processar a solicitação do chat.', details: errorDetails },
       { status: 500 }
     );
   }
 }
