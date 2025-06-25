import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Helper function to get client config path
const getClientConfigPath = (clientId: string): string | null => {
  // Assumindo que clientId é no formato 'tipo/nomeCliente'
  const [clientType, clientName] = clientId.split('/');
  if (!clientType || !clientName) {
    console.error(`[API Save Gatilhos] Invalid clientId format: ${clientId}`);
    return null;
  }
  // Ajuste o caminho base conforme a estrutura do seu projeto
  const basePath = path.join(process.cwd(), 'clientes', 'ativos');
  const clientPath = path.join(basePath, clientName, 'config');
  return clientPath;
};

export async function POST(request: Request) {
  try {
    const { clientId, config } = await request.json();

    if (!clientId || typeof clientId !== 'string' || !config) {
      return NextResponse.json({ error: 'clientId and config are required' }, { status: 400 });
    }

    const clientConfigPath = getClientConfigPath(clientId);

    if (!clientConfigPath) {
        return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const configFilePath = path.join(clientConfigPath, 'gatilhos.json');

    // Garante que a pasta config exista antes de escrever o arquivo
    fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({ message: 'Gatilhos config saved successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API Save Gatilhos] Erro ao salvar configuração:`, error);
    return NextResponse.json({ error: 'Failed to save gatilhos config', details: error.message }, { status: 500 });
  }
}

// Opcional: Adicionar outros métodos HTTP se necessário (GET, PUT, DELETE)
// export async function GET(request: Request) { ... }
// export async function PUT(request: Request) { ... }
// export async function DELETE(request: Request) { ... }