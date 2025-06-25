import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { format } from 'date-fns';
// Importar o SDK do Gemini (ou outra biblioteca de IA, como axios para chamadas HTTP)
// Exemplo: import { GoogleGenerativeAI } from "@google/generative-ai";

// Tipos (ajustar conforme necessário)
interface ChatMessage {
    date: string; // Formato "dd/MM/yyyy" ou "dd/MM/yy"
    time: string;
    type: 'User' | 'IA';
    message: string;
}

interface AnaliseResultado {
    resumoGeral: string;
    resumosIndividuais: Array<{ chatId: string, resumo: string }>;
}

// Função principal para analisar conversas
export async function analisarConversasDoDia(clientePath: string, dataRelatorio: Date): Promise<AnaliseResultado> {
    console.log(`Iniciando análise de IA para ${clientePath} em ${format(dataRelatorio, 'dd/MM/yyyy')}`);

    const dataAlvoString = format(dataRelatorio, 'dd/MM/yyyy');
    const pastaHistorico = path.join(clientePath, 'Chats', 'Historico');
    const resumosIndividuais: Array<{ chatId: string, resumo: string }> = [];
    let resumoGeral = "Nenhum resumo geral gerado.";
    let todasConversasDoDia = ""; // String para acumular todas as conversas para o resumo geral

// Carregar geminiApiKey de infoCliente.json
const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
let geminiApiKey = '';
try {
    const infoConfig = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    geminiApiKey = infoConfig.GEMINI_KEY_CHAT || infoConfig.GEMINI_KEY || '';
    if (!geminiApiKey) {
        console.warn(`Chave GEMINI_KEY_CHAT ou GEMINI_KEY não encontrada em infoCliente.json de ${clientePath}. Análise de IA não pode prosseguir.`);
        return { resumoGeral: "Erro: Chave da API Gemini não configurada.", resumosIndividuais: [] };
    }
} catch (error) {
    console.error(`Erro ao ler infoCliente.json para chave Gemini em ${clientePath}: ${error}`);
    return { resumoGeral: "Erro ao ler configuração da API Gemini.", resumosIndividuais: [] };
}

    // Configurar cliente Gemini (exemplo)
    // const genAI = new GoogleGenerativeAI(geminiApiKey);
    // const model = genAI.getGenerativeModel({ model: "gemini-pro"}); // Ou outro modelo adequado

    // 2. Iterar sobre os chats
    try {
        const chatIds = await fs.readdir(pastaHistorico);

        for (const chatId of chatIds) {
            const caminhoChatId = path.join(pastaHistorico, chatId);
            try {
                const stats = await fs.stat(caminhoChatId);
                if (!stats.isDirectory()) continue;

                const arquivoChat = path.join(caminhoChatId, `${chatId}.json`);
                 try {
                    await fs.access(arquivoChat);
                 } catch { continue; } // Pula se arquivo do chat não existe

                const conteudoArquivo = await fs.readFile(arquivoChat, 'utf-8');
                const mensagens: ChatMessage[] = JSON.parse(conteudoArquivo);

                // 3. Filtrar mensagens do dia e formatar histórico
                const historicoDoDia = mensagens
                    .filter(msg => {
                        try {
                            const [dia, mes, anoStr] = msg.date.split('/');
                            const ano = anoStr.length === 2 ? parseInt(`20${anoStr}`) : parseInt(anoStr);
                            if (!dia || !mes || !ano) return false;
                            const dataMsg = new Date(ano, parseInt(mes) - 1, parseInt(dia));
                            return format(dataMsg, 'dd/MM/yyyy') === dataAlvoString;
                        } catch { return false; } // Ignora mensagens com data inválida
                    })
                    .map(msg => `${msg.type} (${msg.time}): ${msg.message}`)
                    .join('\n');

                if (historicoDoDia.trim().length > 0) {
                    console.log(`Analisando chat: ${chatId} para ${dataAlvoString}`);
                    todasConversasDoDia += `--- Chat ID: ${chatId} ---\n${historicoDoDia}\n\n`;

                    // 4. Chamar IA para resumo individual (IMPLEMENTAR CHAMADA REAL)
                    try {
                        // Exemplo de prompt para resumo individual
                        const promptIndividual = `Resuma a seguinte conversa do dia ${dataAlvoString} para o chat ${chatId} em poucas frases, focando no resultado ou próximo passo:\n\n${historicoDoDia}`;
                        console.log(`Gerando resumo individual para ${chatId}...`);
                        // const resultIndividual = await model.generateContent(promptIndividual);
                        // const responseIndividual = await resultIndividual.response;
                        // const resumoIAIndividual = responseIndividual.text();
                        const resumoIAIndividual = `Resumo IA para ${chatId} (simulado)`; // Placeholder

                        resumosIndividuais.push({ chatId, resumo: resumoIAIndividual });
                        console.log(`Resumo individual para ${chatId} gerado.`);

                    } catch (iaError) {
                        console.error(`Erro da IA ao gerar resumo individual para ${chatId}: ${iaError}`);
                        resumosIndividuais.push({ chatId, resumo: "Erro ao gerar resumo pela IA." });
                    }
                     // Adicionar um pequeno delay entre chamadas para evitar rate limit (ajustar conforme necessário)
                     await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                }

            } catch (erro) {
                console.error(`Erro ao processar chat ${chatId} para análise IA: ${erro}`);
            }
        }

        // 5. Chamar IA para resumo geral (se houver conversas)
        if (todasConversasDoDia.trim().length > 0) {
             console.log(`Gerando resumo geral para ${dataAlvoString}...`);
             try {
                 // Exemplo de prompt para resumo geral
                 const promptGeral = `Com base em todas as conversas do dia ${dataAlvoString} listadas abaixo, forneça um resumo geral conciso dos atendimentos, destacando pontos chave, sucessos ou problemas recorrentes:\n\n${todasConversasDoDia}`;
                 // const resultGeral = await model.generateContent(promptGeral);
                 // const responseGeral = await resultGeral.response;
                 // resumoGeral = responseGeral.text();
                 resumoGeral = `Resumo geral IA para ${dataAlvoString} (simulado)`; // Placeholder
                 console.log(`Resumo geral gerado.`);

             } catch (iaError) {
                 console.error(`Erro da IA ao gerar resumo geral: ${iaError}`);
                 resumoGeral = "Erro ao gerar resumo geral pela IA.";
             }
        } else {
            resumoGeral = "Nenhuma conversa encontrada para análise neste dia.";
        }

    } catch (erro) {
        console.error(`Erro ao ler a pasta ${pastaHistorico} para análise IA: ${erro}`);
        resumoGeral = "Erro ao acessar histórico de conversas.";
    }

    return { resumoGeral, resumosIndividuais };
}