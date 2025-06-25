// Importar o Firebase Admin SDK
import * as fs from 'fs'; // Importar fs para existsSync
import * as fsPromises from 'fs/promises'; // Importar fs/promises para operações assíncronas
import path from 'path'; // Importar path
import { getPasta } from '@/backend/disparo/disparo'; // Importar getPasta


// GET /api/regras-disparo?clientId=...
export async function GET(request) {
  try {

    const { searchParams } = new URL(request.url);
    let clientId = searchParams.get('clientId'); // Manter clientId para obter o caminho da pasta
    clientId = clientId?.includes('/') ? clientId.split('/').pop() : clientId;

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'ClientId é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Lógica de Carregamento Local ---
    const clienteFolderPath = getPasta(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local
    const localRegrasPath = path.join(clienteFolderPath, 'config', 'regrasDisparo.json');

    // Define um objeto com os valores padrão para o backend
    const REGRAS_DEFAULT_BACKEND = {
      DISPARO_ESTRATEGIA: 'todas_ativas',
      DISPARO_LISTAS_SELECIONADAS: '',
      HORARIO_INICIAL: '08:00',
      HORARIO_FINAL: '18:00',
      DIA_INICIAL: 'segunda',
      DIA_FINAL: 'sexta',
      INTERVALO_DE: '30',
      INTERVALO_ATE: '60',
      QUANTIDADE_INICIAL: '10',
      DIAS_AQUECIMENTO: '7',
      QUANTIDADE_LIMITE: '100',
      QUANTIDADE_SEQUENCIA: '50',
    };

    let localRegras = {};
    try {
        if (fs.existsSync(localRegrasPath)) {
            const localContent = await fsPromises.readFile(localRegrasPath, 'utf-8');
            localRegras = JSON.parse(localContent);
            console.log(`[API /api/regras-disparo GET] Regras carregadas localmente para ${clientId}`);
        } else {
            console.log(`[API /api/regras-disparo GET] Arquivo de regras local não encontrado para ${clientId}. Usando padrões.`);
            localRegras = REGRAS_DEFAULT_BACKEND; // Usa padrões se o arquivo não existir
        }
    } catch (localError) {
        console.error(`[API /api/regras-disparo GET] Erro ao carregar regras localmente para ${clientId}:`, localError);
        localRegras = REGRAS_DEFAULT_BACKEND; // Usa padrões em caso de erro na leitura
    }
    // --- Fim Lógica de Carregamento Local ---

    return new Response(JSON.stringify({ success: true, regras: localRegras, timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao buscar regras de disparo:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar regras de disparo' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


// PUT /api/regras-disparo - Atualizar regras de disparo localmente
export async function PUT(request) {
  try {
    const { clientId: rawClientId, regras } = await request.json(); // Extrai clientId com um nome temporário
    
    // Processa o clientId
    const clientId = rawClientId?.includes('/') ? rawClientId.split('/').pop() : rawClientId;

    if (!clientId || !regras) {
      return new Response(
        JSON.stringify({ error: 'ClientId e regras são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Lógica de Salvamento Local ---
    const clienteFolderPath = getPasta(clientId); // Usa o clientId processado
    const localRegrasPath = path.join(clienteFolderPath, 'config', 'regrasDisparo.json');

    try {
        // Salva as regras localmente (sobrescreve o arquivo existente)
        await fsPromises.writeFile(localRegrasPath, JSON.stringify(regras, null, 2), 'utf-8');
        console.log(`[API /api/regras-disparo PUT] Regras salvas localmente para ${clientId}`);
    } catch (localError) {
        console.error(`[API /api/regras-disparo PUT] Erro ao salvar regras localmente para ${clientId}:`, localError);
        // Continuar, mas logar o erro
    }
    // --- Fim Lógica de Salvamento Local ---

    return new Response(JSON.stringify({
      success: true,
      message: 'Regras atualizadas com sucesso',
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Erro ao atualizar regras de disparo:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao atualizar regras de disparo' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
