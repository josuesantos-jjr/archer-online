import { analisarIntencao } from './analiseIntencao.ts';
import { analisarTags } from './analiseTags.ts';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { identificarAgendamento } from './identificarAgendamento.ts';
import { precisaAtendimento } from './precisaAtendimento.ts'; // Importa a nova função



const logger = {
  info: (message: string, ...args: any[]) => console.log(`INFO: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`WARN: ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`ERROR: ${message}`, ...args),
};

export async function monitorarConversa(
  clientePath: string,
  chatId: string,
  listaNome: string | null,
  client: any
) {
  try {
    const historicoPath = path.join(
      clientePath,
      'Chats',
      'Historico',
      chatId,
      `${chatId}.json`
    );
    let conversation = '';
    try {
      await fs.access(historicoPath);
      const rawConversation = await fs.readFile(historicoPath, 'utf-8');
      try {
        const messages = JSON.parse(rawConversation);
        if (Array.isArray(messages)) {
          conversation = messages
            .map((m) => `${m.type}: ${m.message}`)
            .join('\n');
        }
      } catch (e) {
        logger.error(`[Monitoramento Conversa] Erro ao parsear histórico ${historicoPath}: ${e}`);
        conversation = rawConversation;
      }
    } catch {
      logger.warn(`[Monitoramento Conversa] Arquivo de histórico não encontrado ou inacessível: ${historicoPath}`);
    }

    if (!conversation.trim()) {
      logger.warn(`[Monitoramento Conversa] Conversa vazia para ${chatId}.`);
    }

    const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
    let geminiKey = '';
    try {
      const infoConfig = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
      geminiKey = infoConfig.GEMINI_KEY || '';
    } catch (error) {
      logger.error(`Erro ao ler infoCliente.json para GEMINI_KEY: ${error}`);
    }

    const intencao = await analisarIntencao(conversation, geminiKey, logger);
    if (!intencao) {
      logger.warn(`[Monitoramento Conversa] Não foi possível determinar intenção para ${chatId}`);
    }

    const tags = await analisarTags(conversation, geminiKey, logger);
    if (!tags || tags.length === 0) {
      logger.warn(`[Monitoramento Conversa] Nenhuma tag encontrada para ${chatId}`);
    }

    // Chama a função precisaAtendimento
    await precisaAtendimento(chatId, conversation, client, clientePath);

    const pathParts = clientePath.split(path.sep);
    const tipoCliente = pathParts[pathParts.length - 2] || '';
    const nomeCliente = pathParts[pathParts.length - 1] || '';
    const clientId = `${tipoCliente}/${nomeCliente}`;

    const dadosPath = path.join(
      clientePath,
      'Chats',
      'Historico',
      chatId,
      'Dados.json'
    );
    let dadosRaw = '';
    try {
      dadosRaw = await fs.readFile(dadosPath, 'utf-8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`[Monitoramento Conversa] Arquivo Dados.json não encontrado para ${chatId}`);
        return;
      }
      throw error;
    }

    const dados = JSON.parse(dadosRaw);
    const phoneNumber = dados.number || chatId.split('@')[0];
    const name = dados.name || 'Não identificado';

    const listaId = listaNome ? listaNome.toLowerCase().replace(/\s+/g, '_') : null;
    const contatoId = phoneNumber.replace(/\D/g, '');

    const dadosParaAtualizar = {
      intencao: intencao || null,
      tags: tags || [],
      ultimaAnalise: new Date().toISOString(),
      ultimaInteracao: new Date().toISOString(),
      status: dados.status || 'ativo',
      origem: dados.origem || 'monitoramento_conversa',
    };

    const dadosRawAtual = await fs.readFile(dadosPath, 'utf-8');
    const dadosAtuais = JSON.parse(dadosRawAtual);

    const tagsExistentes = Array.isArray(dadosAtuais.tags) ? dadosAtuais.tags : [];
    const novasTags = Array.isArray(dadosParaAtualizar.tags) ? dadosParaAtualizar.tags : [];
    const tagsCombinadasUnicas = Array.from(new Set([...tagsExistentes, ...novasTags]));

    const novosDados = {
      ...dadosAtuais,
      ...dadosParaAtualizar,
      tags: tagsCombinadasUnicas,
    };

    await fs.writeFile(dadosPath, JSON.stringify(novosDados, null, 2), 'utf-8');

    logger.info(`[Monitoramento Conversa] Arquivo Dados.json para ${chatId} atualizado com Intenção: ${intencao}, Tags: ${tags?.join(', ')}`);

    // Identificar agendamento
    const agendamento = await identificarAgendamento(conversation, geminiKey, chatId, clientePath);
    if (agendamento.data_agendada && agendamento.horario_agendado) {
      const detalhesAgendamento = {
        agendamento_identificado: 'sim',
        data_agendada: agendamento.data_agendada,
        horario_agendado: agendamento.horario_agendado,
        agendamento_realizado: '',
      };

      if (dados.detalhes_agendamento) {
        dados.detalhes_agendamento = [detalhesAgendamento];
      } else {
        dados.detalhes_agendamento = [detalhesAgendamento];
      }

      await fs.writeFile(dadosPath, JSON.stringify(dados, null, 2), 'utf-8');

      const agendamentosPath = path.join(clientePath, 'config', 'agendamentos.json');
      let agendamentosRaw = '';
      try {
        agendamentosRaw = await fs.readFile(agendamentosPath, 'utf-8');
      } catch (error) {
        agendamentosRaw = '{"agendamentos": []}';
      }
      const agendamentos = JSON.parse(agendamentosRaw);

      const agendamentoExistente = agendamentos.agendamentos.find((a: any) => a.chatId === chatId);
      if (agendamentoExistente) {
        agendamentoExistente.detalhes_agendamento = [detalhesAgendamento];
      } else {
        agendamentos.agendamentos.push({ chatId, detalhes_agendamento: [detalhesAgendamento] });
      }

      await fs.writeFile(agendamentosPath, JSON.stringify(agendamentos, null, 2), 'utf-8');
    }

    const resultadoMonitoramento = {
      timestamp: new Date().toISOString(),
      intencao: intencao,
      tags: tags,
    };

    const monitoramentoPath = path.join(
      clientePath,
      'Chats',
      'Historico',
      chatId,
      'monitoramento.json'
    );
    let historico = [];
    try {
      const monitoramentoContent = await fs.readFile(monitoramentoPath, 'utf-8');
      try {
        historico = JSON.parse(monitoramentoContent);
        if (!Array.isArray(historico)) historico = [];
      } catch (e) {
        logger.error(`[Monitoramento Conversa] Erro ao parsear arquivo de monitoramento existente ${monitoramentoPath}:`, e);
        historico = [];
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    historico.push(resultadoMonitoramento);
    await fs.writeFile(monitoramentoPath, JSON.stringify(historico, null, 2));
  } catch (error) {
    logger.error(`[Monitoramento Conversa] Erro ao monitorar conversa ${chatId}:`, error);
  }
}
