import * as fs from 'fs'; // Importar fs para existsSync
import * as fsPromises from 'fs/promises'; // Importar fs/promises para operações assíncronas
import path from 'path'; // Importar path
import { getPasta } from '@/backend/disparo/disparo'; // Importar getPasta
import { defaultConfig } from '@/backend/followup/config'; // Importar defaultConfig

// GET /api/followup-config?clientId=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let clientIdFromParams = searchParams.get('clientId');

    if (!clientIdFromParams) {
      return new Response(JSON.stringify({ error: 'ClientId é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Lógica de Carregamento Local ---
    const clientId = clientIdFromParams?.includes('/') ? clientIdFromParams.split('/').pop() : clientIdFromParams;
    const clienteFolderPath = getPasta(clientId);
    const localFollowUpPath = path.join(clienteFolderPath, 'config', 'followUpConfig.json');
    let loadedConfig = { ...defaultConfig }; // Começa com a configuração padrão

    try {
        if (fs.existsSync(localFollowUpPath)) {
            const localContent = await fsPromises.readFile(localFollowUpPath, 'utf-8');
            const parsedConfig = JSON.parse(localContent);
            // Mescla a configuração carregada com a padrão para garantir todos os campos
            loadedConfig = { ...defaultConfig, ...parsedConfig };
            
            // Garante que midiaPorNivel tenha o tamanho correto e valores padrão
            if (!loadedConfig.midiaPorNivel || loadedConfig.midiaPorNivel.length !== loadedConfig.niveis) {
              loadedConfig.midiaPorNivel = Array(loadedConfig.niveis).fill({ ativado: false, arquivos: [], tipos: [] });
            } else {
              // Garante que cada item em midiaPorNivel tenha a estrutura completa
              loadedConfig.midiaPorNivel = loadedConfig.midiaPorNivel.map(item => ({
                ativado: item.ativado || false,
                arquivos: item.arquivos || [],
                tipos: item.tipos || [],
              }));
            }

            console.log(`[API /api/followup-config GET] Configurações de follow-up carregadas localmente para ${clientId}`);
        } else {
            console.log(`[API /api/followup-config GET] Arquivo followUpConfig.json não encontrado para ${clientId}. Retornando configuração padrão.`);
            // loadedConfig já é defaultConfig aqui
        }
    } catch (localError) {
        console.error(`[API /api/followup-config GET] Erro ao ler ou parsear followUpConfig.json para ${clientId}:`, localError);
        // Se o arquivo existe mas há erro de leitura/parsing, retorna um erro 500
        return new Response(
            JSON.stringify({ error: `Erro ao carregar configurações de follow-up: ${localError.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
    // --- Fim Lógica de Carregamento Local ---

    // Retorna o conteúdo do arquivo (loadedConfig) dentro de uma chave 'config',
    // e um timestamp separado para a requisição GET.
    return new Response(JSON.stringify({ success: true, config: loadedConfig, timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao buscar configuração de follow-up:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar configuração de follow-up' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PUT /api/followup-config - Atualizar configurações de follow-up localmente
export async function PUT(request) {
  try {
    const requestBody = await request.json();
    const { clientId: rawClientId, ...payloadConfigData } = requestBody;

    if (!rawClientId) {
      return new Response(
        JSON.stringify({ error: 'ClientId é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (Object.keys(payloadConfigData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Dados de configuração são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Lógica de Salvamento Local ---
    const clientId = rawClientId?.includes('/') ? rawClientId.split('/').pop() : rawClientId;
    const clienteFolderPath = getPasta(clientId);
    const localFollowUpPath = path.join(clienteFolderPath, 'config', 'followUpConfig.json');

    try {
        const configDir = path.dirname(localFollowUpPath);
        if (!fs.existsSync(configDir)) {
            await fsPromises.mkdir(configDir, { recursive: true });
            console.log(`[API /api/followup-config PUT] Diretório de configuração criado para ${clientId}`);
        }

        // Prepara o objeto de configuração final a ser salvo.
        // payloadConfigData representa os dados de configuração enviados pelo cliente.
        const configToSave = { ...payloadConfigData };

        // Remove a chave 'config' aninhada, se existir, para achatar a estrutura.
        if (configToSave.hasOwnProperty('config')) {
            console.log(`[API /api/followup-config PUT] Removendo chave 'config' aninhada da configuração para ${clientId} antes de salvar.`);
            delete configToSave.config;
        }

        // Garante que o timestamp no arquivo seja sempre atualizado no salvamento.
        configToSave.timestamp = new Date().toISOString();

        // Salva as configurações localmente (sobrescreve o arquivo existente ou cria um novo)
        // com a estrutura achatada e timestamp atualizado.
        await fsPromises.writeFile(localFollowUpPath, JSON.stringify(configToSave, null, 2), 'utf-8');
        console.log(`[API /api/followup-config PUT] Configurações de follow-up salvas localmente para ${clientId} com estrutura achatada.`);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Configuração de follow-up salva com sucesso',
          config: configToSave, // Retorna a configuração que foi efetivamente salva
          timestamp: configToSave.timestamp, // Retorna o timestamp que foi salvo no arquivo
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (localError) {
        console.error(`[API /api/followup-config PUT] Erro ao salvar configurações de follow-up localmente para ${clientId}:`, localError);
        return new Response(
            JSON.stringify({ error: `Erro ao salvar configurações localmente: ${localError.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
    // --- Fim Lógica de Salvamento Local ---

  } catch (error) {
    console.error('Erro ao salvar configuração de follow-up:', error);
    // Adiciona verificação para erro de parsing de JSON (corpo da requisição inválido/vazio)
    if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Corpo da requisição inválido ou vazio' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
    return new Response(
      JSON.stringify({ error: 'Erro ao salvar configuração de follow-up' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
