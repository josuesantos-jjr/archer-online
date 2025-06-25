import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  console.log('[API save-client-config] POST request received.');
  try {
    const requestBody = await request.json();
    console.log('[API save-client-config] Request body:', requestBody);

    const { clientId, config } = await request.json();

    if (!clientId || !config) {
      console.error('[API save-client-config] Dados incompletos para salvar configuração:', { clientId, config });
      return NextResponse.json(
        { error: 'ClientId e configuração são obrigatórios' },
        { status: 400 }
      );
    }

    const [clientType, clientName] = clientId.split('/');
    if (!clientType || !clientName) {
       console.error('[API save-client-config] Formato de clientId inválido:', clientId);
       return NextResponse.json(
         { error: 'Formato de ClientId inválido' },
         { status: 400 }
       );
    }

    const clientConfigDir = path.join(process.cwd(), 'clientes', clientType, clientName, 'config');
    const infoClientePath = path.join(clientConfigDir, 'infoCliente.json');
 
    // Garante que o diretório de configuração exista
    await fs.mkdir(clientConfigDir, { recursive: true });
 
    // Escreve a configuração no arquivo infoCliente.json
    await fs.writeFile(infoClientePath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[API save-client-config] Configuração salva em ${infoClientePath}`);
 
    console.log('[API save-client-config] Configuração salva com sucesso.');
    return NextResponse.json({
      success: true,
      message: 'Configuração salva com sucesso (arquivo infoCliente.json)',
      timestamp: new Date().toISOString(),
    });
 
  } catch (error) {
    console.error('[API save-client-config] Erro geral ao salvar configuração do cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao salvar configuração' },
      { status: 500 }
    );
  }
}
 
// Mantém o handler GET existente, modificado para ler do infoCliente.json
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
 
    if (!clientId) {
      return NextResponse.json(
        { error: 'ClientId é obrigatório' },
        { status: 400 }
      );
    }
 
    const [clientType, clientName] = clientId.split('/');
    if (!clientType || !clientName) {
      return NextResponse.json(
        { error: 'Formato de ClientId inválido' },
        { status: 400 }
      );
    }
 
    const infoClientePath = path.join(process.cwd(), 'clientes', clientType, clientName, 'config', 'infoCliente.json');
 
    try {
      const configFileContent = await fs.readFile(infoClientePath, 'utf-8');
      const config = JSON.parse(configFileContent);
 
      return NextResponse.json({
        success: true,
        config,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erro ao ler a configuração do cliente do arquivo local (infoCliente.json):', error);
      return NextResponse.json(
        { error: 'Erro ao ler a configuração do cliente do arquivo local (infoCliente.json)' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao buscar configuração do cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configuração' },
      { status: 500 }
    );
  }
}
