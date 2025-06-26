import fs from 'node:fs/promises'; // Usar promises para async/await
import path from 'node:path';
import { format } from 'date-fns'; // Funções de data úteis
import { analisarConversasDoDia } from './analiseConversaIA.ts'; // Adiciona a extensão .ts
// Tipos podem ser definidos aqui ou importados se existirem
// interface DisparoRegistro { /* ... */ }
// interface ChatMessage { date: string; time: string; type: 'User' | 'IA'; message: string; }
// Conta as conversas ativas
// Função Refatorada para contar conversas respondidas em um dia específico
async function contarConversasRespondidas(clientePath, dataRelatorio) {
    const dataAlvoString = format(dataRelatorio, 'dd/MM/yyyy'); // Formato consistente para comparação
    const pastaHistorico = path.join(clientePath, 'Chats', 'Historico');
    let conversasRespondidas = 0;
    try {
        const chatIds = await fs.readdir(pastaHistorico);
        for (const chatId of chatIds) {
            const caminhoChatId = path.join(pastaHistorico, chatId);
            try {
                const stats = await fs.stat(caminhoChatId);
                if (!stats.isDirectory())
                    continue; // Pula se não for diretório
                const arquivoChat = path.join(caminhoChatId, `${chatId}.json`); // Assume nome do arquivo = chatId.json
                try {
                    await fs.access(arquivoChat); // Verifica se o arquivo existe e é acessível
                }
                catch {
                    continue; // Pula se não existe ou não acessível
                }
                const conteudoArquivo = await fs.readFile(arquivoChat, 'utf-8');
                const mensagens = JSON.parse(conteudoArquivo); // Usar tipo ChatMessage[] se definido
                let iaEnviouPrimeiro = false;
                let userRespondeuNoDia = false;
                for (const msg of mensagens) {
                    // Tenta parsear a data da mensagem (assumindo formato dd/MM/yyyy ou dd/MM/yy)
                    let dataMsg = null;
                    try {
                        const [dia, mes, anoStr] = msg.date.split('/');
                        const ano = anoStr.length === 2 ? parseInt(`20${anoStr}`) : parseInt(anoStr); // Converte ano de 2 dígitos
                        if (dia && mes && ano) {
                            // Cuidado com mês (0-11)
                            dataMsg = new Date(ano, parseInt(mes) - 1, parseInt(dia));
                        }
                    }
                    catch (parseError) {
                        console.warn(`Erro ao parsear data "${msg.date}" no chat ${chatId}`);
                        continue; // Pula mensagem com data inválida
                    }
                    // Verifica se a mensagem é do dia do relatório
                    if (dataMsg && format(dataMsg, 'dd/MM/yyyy') === dataAlvoString) {
                        if (msg.type === 'IA') {
                            iaEnviouPrimeiro = true; // Marca que a IA iniciou (ou continuou) a conversa no dia
                        }
                        else if (msg.type === 'User' && iaEnviouPrimeiro) {
                            // Se o usuário respondeu DEPOIS da IA no mesmo dia
                            userRespondeuNoDia = true;
                            break; // Já sabemos que houve resposta neste chat, podemos ir para o próximo
                        }
                    }
                }
                if (userRespondeuNoDia) {
                    conversasRespondidas++;
                }
            }
            catch (erro) {
                // Loga erro específico do chat, mas continua processando outros
                console.error(`Erro ao processar chat ${chatId} para relatório: ${erro}`);
            }
        }
        console.log(`Relatório ${dataAlvoString}: Conversas respondidas encontradas: ${conversasRespondidas}`);
    }
    catch (erro) {
        // Erro ao ler o diretório principal de histórico
        console.error(`Erro ao ler a pasta ${pastaHistorico} para relatório: ${erro}`);
    }
    return conversasRespondidas;
}
// Função para gerar o relatório diário
// Função Refatorada para criar e enviar o relatório diário
async function criarEnviarRelatorioDiario(client, clientePath, dataRelatorio) {
    try {
        console.log('Iniciando a geração do relatório diário...');
        // Usa a data recebida como argumento
        const dataFormatada = format(dataRelatorio, 'dd/MM/yyyy');
        const mesAtual = format(dataRelatorio, 'MMMM', { locale: require('date-fns/locale/pt-BR') }); // Mês por extenso
        console.log('Carregando os prompts...');
        const promptsPath = path.join(clientePath, 'config', 'relatorio', '.promptsRelatorios');
        let promptsRaw = '';
        try {
            promptsRaw = await fs.readFile(promptsPath, 'utf-8'); // Usa readFile assíncrono
        }
        catch (err) {
            console.error(`Erro ao ler arquivo de prompts ${promptsPath}: ${err}. Usando prompts vazios.`);
            // Lidar com erro - talvez retornar ou usar prompts padrão vazios
        }
        const prompts = promptsRaw.split('\n').map((linha) => linha.trim()); // Adiciona tipo
        const promptRelatorioDiario = prompts.find((linha) => linha.startsWith('RELATORIO_DIARIO='))?.split('=')[1] || ''; // Adiciona tipo
        const promptAnalisarConversas = prompts.find((linha) => linha.startsWith('ANALISAR_CONVERSAS='))?.split('=')[1] || ''; // Adiciona tipo
        console.log(`Coletando dados de disparo para ${dataFormatada}...`);
        let disparosSucesso = 0;
        let disparosFalhaWpp = 0;
        let disparosFalhaEnvio = 0; // Contar outros erros se necessário
        const logDiarioPath = path.join(clientePath, 'logs', `${format(dataRelatorio, 'yyyy-MM-dd')}.json`);
        try {
            // Tenta ler o arquivo de log diretamente
            const logContent = await fs.readFile(logDiarioPath, 'utf-8');
            const registros = JSON.parse(logContent); // Usar tipo DisparoRegistro[] se definido
            registros.forEach(reg => {
                if (reg.status === true) {
                    disparosSucesso++;
                }
                else if (reg.status === 'falha_wpp') { // Assumindo que falha_wpp é registrado como status
                    disparosFalhaWpp++;
                }
                else {
                    disparosFalhaEnvio++; // Outras falhas
                }
            });
            console.log(`Dados do log ${logDiarioPath}: Sucesso=${disparosSucesso}, Falha WPP=${disparosFalhaWpp}, Falha Envio=${disparosFalhaEnvio}`);
        }
        catch (error) { // Adiciona tipo unknown
            // Se der erro na leitura (ex: arquivo não existe), loga e continua com contagens zeradas
            // Verifica se é um erro com código e se o código é ENOENT
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.log(`Arquivo de log diário ${logDiarioPath} não encontrado.`);
            }
            else {
                console.error(`Erro ao ler ou processar log diário ${logDiarioPath}: ${error}`);
            }
        }
        // A lógica de disparoTotal foi removida, pois não parece útil no relatório diário
        // e a forma de cálculo anterior estava incorreta.
        console.log(`Contando conversas respondidas para ${dataFormatada}...`);
        const conversasRespondidas = await contarConversasRespondidas(clientePath, dataRelatorio);
        console.log(`Conversas respondidas: ${conversasRespondidas}`);
        console.log(`Iniciando análise de IA para ${dataFormatada}...`);
        // Chama a função de análise de IA
        const { resumoGeral: resumoGeralIA, resumosIndividuais: resumosIndividuaisIA } = await analisarConversasDoDia(clientePath, dataRelatorio);
        console.log(`Análise de IA concluída. Resumo Geral: ${resumoGeralIA ? 'OK' : 'Falhou/Vazio'}`);
        console.log('Montando o texto do relatório...');
        // Monta a mensagem do relatório
        const nomeCliente = path.basename(clientePath);
        let relatorioTexto = `📊 *Relatório Diário - ${nomeCliente} (${dataFormatada})* 📊\n\n`;
        relatorioTexto += `🚀 *Disparos Realizados:* ${disparosSucesso}\n`;
        if (disparosFalhaWpp > 0)
            relatorioTexto += `❌ *Falhas (Sem WPP):* ${disparosFalhaWpp}\n`;
        if (disparosFalhaEnvio > 0)
            relatorioTexto += `⚠️ *Falhas (Erro Envio):* ${disparosFalhaEnvio}\n`;
        relatorioTexto += `💬 *Conversas Respondidas:* ${conversasRespondidas}\n\n`;
        relatorioTexto += `🤖 *Resumo IA (Geral):*\n${resumoGeralIA || '(Não disponível)'}\n\n`; // Usa o resumo real ou fallback
        // Opcional: Adicionar resumos individuais
        if (resumosIndividuaisIA && resumosIndividuaisIA.length > 0) {
            relatorioTexto += `\n*Resumos Individuais (IA):*\n`;
            resumosIndividuaisIA.forEach(r => {
                const chatIdSimple = r.chatId.split('@')[0]; // Mostra só o número
                relatorioTexto += `\n_${chatIdSimple}_:\n${r.resumo}\n`;
            });
        }
        console.log('Salvando o relatório no arquivo JSON...');
        const relatorioSalvoPath = path.join(clientePath, 'logs', 'relatorios'); // Salvar em logs/relatorios
        const relatorioMensalFile = path.join(relatorioSalvoPath, `${format(dataRelatorio, 'yyyy-MM')}.json`); // Nome do arquivo YYYY-MM.json
        // Lê o relatório mensal
        let relatorioMensal = {};
        try {
            // Tenta ler o relatório mensal diretamente
            const data = await fs.readFile(relatorioMensalFile, 'utf8');
            relatorioMensal = JSON.parse(data);
            console.log(`Relatório mensal carregado do arquivo: ${relatorioMensalFile}`);
        }
        catch (error) { // Adiciona tipo unknown
            // Se der erro (ex: não existe), apenas loga e continua com relatorioMensal = {}
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.log(`Arquivo de relatório mensal ${relatorioMensalFile} não encontrado. Será criado.`);
            }
            else {
                console.error(`Erro ao carregar o relatório mensal do arquivo ${relatorioMensalFile}: ${error}`);
            }
        }
        // Calcula a semana do mês
        // Adiciona os dados do dia ao relatório mensal (estrutura mais simples)
        relatorioMensal[dataFormatada] = {
            disparosSucesso,
            disparosFalhaWpp,
            disparosFalhaEnvio,
            conversasRespondidas,
            resumoGeralIA: resumoGeralIA || null,
            resumosIndividuaisIA: resumosIndividuaisIA && resumosIndividuaisIA.length > 0 ? resumosIndividuaisIA : null // Salva null se vazio
        };
        // Salva o relatório mensal
        // Garante que o diretório exista
        await fs.mkdir(relatorioSalvoPath, { recursive: true });
        // Salva o relatório mensal atualizado
        try {
            await fs.writeFile(relatorioMensalFile, JSON.stringify(relatorioMensal, null, 2));
            console.log(`Relatório diário salvo no arquivo: ${relatorioMensalFile}`);
        }
        catch (error) {
            console.error(`Erro ao salvar o relatório diário no arquivo: ${error}`);
        }
        // Carregar targetChatId de infoCliente.json
        const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
        let targetChatId = '';
        try {
            const infoConfig = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
            targetChatId = infoConfig.TARGET_CHAT_ID || '';
            if (targetChatId && !targetChatId.endsWith('@c.us') && !targetChatId.endsWith('@g.us')) {
                if (targetChatId.includes('-')) {
                    targetChatId += '@g.us';
                }
                else {
                    targetChatId += '@c.us';
                }
            }
        }
        catch (error) {
            console.error(`Erro ao ler infoCliente.json para TARGET_CHAT_ID: ${error}`);
        }
        // Envia o relatório se targetChatId foi definido
        if (targetChatId) {
            console.log(`Enviando relatório para ${targetChatId}...`);
            try {
                await client.sendText(targetChatId, relatorioTexto);
                console.log(`Relatório enviado para o chatId: ${targetChatId}`);
            }
            catch (error) {
                console.error(`Erro ao enviar o relatório para ${targetChatId}: ${error}`);
            }
        }
        else {
            console.log("TARGET_CHAT_ID não configurado no .env do cliente, relatório não enviado via WhatsApp.");
        }
        console.log('Relatório diário gerado e enviado com sucesso!');
    }
    catch (error) {
        console.error(`Erro ao gerar relatório diário: ${error}`);
    }
}
// Remove funções auxiliares antigas que não são mais necessárias
// function getSemanaDoMes(data: Date): number { ... }
// function lerHorarioRelatorio(clientePath: string): string { ... }
// function houveDisparoHoje(clientePath: string): boolean { ... }
// function horaDeExecutarRelatorio(horarioRelatorio: string): boolean { ... }
// Exporta a função principal refatorada
export { criarEnviarRelatorioDiario };
// A função 'dispararRelatorioDiario' foi removida pois a lógica de gatilho está em disparo.ts
