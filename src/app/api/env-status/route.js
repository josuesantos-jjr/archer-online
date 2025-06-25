export const dynamic = 'force-dynamic';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Client ID is required' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const [folderType, clientName] = clientId.split('/');
    // Use process.cwd() para obter o diretório raiz do projeto
    const infoClientePath = path.resolve(process.cwd(), 'clientes', folderType, clientName, 'config', 'infoCliente.json');
    
    try {
      const infoClienteContent = await fs.readFile(infoClientePath, 'utf-8');
      const config = JSON.parse(infoClienteContent);
      const status = config.STATUS_SESSION || 'Desconhecido';

      return new Response(JSON.stringify({ status: status }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error) {
      console.error('Erro ao ler arquivo infoCliente.json para status:', error);
      return new Response(JSON.stringify({ status: 'Erro ao ler status' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}