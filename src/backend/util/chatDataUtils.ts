import fs from 'node:fs';
import path from 'node:path';

/**
 * Atualiza a data da última mensagem recebida no arquivo dados.json de um chat.
 * @param clientePath O caminho base da pasta do cliente (ex: clientes/ativos/GlobalTur).
 * @param chatId O ID do chat (ex: 5511999999999@c.us).
 */
export function updateLastReceivedMessageDate(clientePath: string, chatId: string): void {
    const chatIdFormatted = chatId.replace(/@c\.us/g, '');
    const dirPath = path.join(clientePath, 'Chats', 'Historico', `${chatIdFormatted}@c.us`);
    const filePathDados = path.join(dirPath, 'dados.json');

    try {
        // Verifica se o diretório e o arquivo dados.json existem
        if (!fs.existsSync(dirPath)) {
            console.warn(`[updateLastReceivedMessageDate] Diretório não encontrado para chatId: ${chatId}. Criando...`);
            fs.mkdirSync(dirPath, { recursive: true });
        }

        let dados = {};
        if (fs.existsSync(filePathDados)) {
            const data = fs.readFileSync(filePathDados, 'utf-8');
            if (data) {
                try {
                    dados = JSON.parse(data);
                } catch (error) {
                    console.error(`[updateLastReceivedMessageDate] Erro ao analisar dados.json para ${chatId}:`, error);
                    // Em caso de erro de parse, inicializa com um objeto básico para não perder tudo
                    dados = {
                        name: 'Não identificado',
                        number: chatId.split('@')[0],
                        tags: [],
                        listaNome: null,
                    };
                }
            }
        } else {
             console.log(`[updateLastReceivedMessageDate] Arquivo dados.json não encontrado para chatId: ${chatId}. Criando...`);
             // Se não existir, cria um novo objeto com a estrutura desejada
             dados = {
                 name: 'Não identificado',
                 number: chatId.split('@')[0],
                 tags: [],
                 listaNome: null,
             };
        }

        // Atualiza a data da última mensagem recebida
        (dados as any).data_ultima_mensagem_recebida = new Date().toISOString();

        // Escreve o conteúdo atualizado no arquivo
        fs.writeFileSync(filePathDados, JSON.stringify(dados, null, 2), 'utf-8');
        // console.log(`[updateLastReceivedMessageDate] Data da última mensagem recebida atualizada para ${chatId}.`);

    } catch (error) {
        console.error(`[updateLastReceivedMessageDate] Erro ao atualizar dados.json para ${chatId}:`, error);
    }
}

/**
 * Atualiza a data da última mensagem enviada no arquivo dados.json de um chat.
 * @param clientePath O caminho base da pasta do cliente (ex: clientes/ativos/GlobalTur).
 * @param chatId O ID do chat (ex: 5511999999999@c.us).
 */
export function updateLastSentMessageDate(clientePath: string, chatId: string): void {
     const chatIdFormatted = chatId.replace(/@c\.us/g, '');
     const dirPath = path.join(clientePath, 'Chats', 'Historico', `${chatIdFormatted}@c.us`);
     const filePathDados = path.join(dirPath, 'dados.json');

     try {
         // Verifica se o diretório e o arquivo dados.json existem
         if (!fs.existsSync(dirPath)) {
             console.warn(`[updateLastSentMessageDate] Diretório não encontrado para chatId: ${chatId}. Criando...`);
             fs.mkdirSync(dirPath, { recursive: true });
         }

         let dados = {};
         if (fs.existsSync(filePathDados)) {
             const data = fs.readFileSync(filePathDados, 'utf-8');
             if (data) {
                 try {
                     dados = JSON.parse(data);
                 } catch (error) {
                     console.error(`[updateLastSentMessageDate] Erro ao analisar dados.json para ${chatId}:`, error);
                     // Em caso de erro de parse, inicializa com um objeto básico para não perder tudo
                     dados = {
                         name: 'Não identificado',
                         number: chatId.split('@')[0],
                         tags: [],
                         listaNome: null,
                     };
                 }
             }
         } else {
              console.log(`[updateLastSentMessageDate] Arquivo dados.json não encontrado para chatId: ${chatId}. Criando...`);
              // Se não existir, cria um novo objeto com a estrutura desejada
              dados = {
                  name: 'Não identificado',
                  number: chatId.split('@')[0],
                  tags: [],
                  listaNome: null,
              };
         }

         // Atualiza a data da última mensagem enviada
         (dados as any).data_ultima_mensagem_enviada = new Date().toISOString();

         // Escreve o conteúdo atualizado no arquivo
         fs.writeFileSync(filePathDados, JSON.stringify(dados, null, 2), 'utf-8');
         // console.log(`[updateLastSentMessageDate] Data da última mensagem enviada atualizada para ${chatId}.`);

     } catch (error) {
         console.error(`[updateLastSentMessageDate] Erro ao atualizar dados.json para ${chatId}:`, error);
     }
}