import path from 'node:path';
import fs from 'node:fs'; // Usar fs síncrono aqui pode ser aceitável ou mudar para async
// Função para criar e enviar o relatório de uma lista específica
export async function criarEnviarRelatorioLista(client, clientePath, listaNome, lista) {
    console.log(`Gerando relatório para a lista concluída: ${listaNome}`);
    try {
        // 1. Calcular Estatísticas da Lista
        const totalContatos = lista.contatos?.length || 0;
        let disparosSucesso = 0;
        let disparosFalhaWpp = 0;
        let disparosFalhaEnvio = 0; // Contar outras falhas se necessário
        if (Array.isArray(lista.contatos)) {
            lista.contatos.forEach(contato => {
                if (contato.disparo === "sim") {
                    disparosSucesso++;
                }
                else if (contato.disparo === "falha_wpp") {
                    disparosFalhaWpp++;
                }
                else if (contato.disparo) { // Qualquer outro valor em 'disparo' diferente de "sim" ou "falha_wpp"
                    disparosFalhaEnvio++;
                }
            });
        }
        // Carregar targetChatId de infoCliente.json
        const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
        let targetChatId = '';
        try {
            const infoConfig = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
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
        if (!targetChatId) {
            console.log(`TARGET_CHAT_ID não configurado para cliente ${path.basename(clientePath)}. Relatório da lista ${listaNome} não será enviado.`);
            return; // Sai se não há para onde enviar
        }
        // 3. Montar Mensagem do Relatório da Lista
        const nomeCliente = path.basename(clientePath);
        let relatorioTexto = `🏁 *Lista Concluída - ${nomeCliente}* 🏁\n\n`;
        relatorioTexto += `Lista: *${listaNome}*\n`;
        relatorioTexto += `Total de Contatos: ${totalContatos}\n`;
        relatorioTexto += `--------------------\n`;
        relatorioTexto += `✅ Sucesso: ${disparosSucesso}\n`;
        if (disparosFalhaWpp > 0)
            relatorioTexto += `❌ Falha (Sem WPP): ${disparosFalhaWpp}\n`;
        if (disparosFalhaEnvio > 0)
            relatorioTexto += `⚠️ Falha (Outro Erro): ${disparosFalhaEnvio}\n`;
        relatorioTexto += `--------------------\n`;
        relatorioTexto += `Próxima lista será iniciada (se houver).`;
        // 4. Enviar Relatório
        console.log(`Enviando relatório da lista ${listaNome} para ${targetChatId}...`);
        try {
            await client.sendText(targetChatId, relatorioTexto);
            console.log(`Relatório da lista ${listaNome} enviado para ${targetChatId}.`);
        }
        catch (error) {
            console.error(`Erro ao enviar relatório da lista ${listaNome} para ${targetChatId}: ${error}`);
        }
    }
    catch (error) {
        console.error(`Erro geral ao gerar relatório para lista ${listaNome}: ${error}`);
    }
}
