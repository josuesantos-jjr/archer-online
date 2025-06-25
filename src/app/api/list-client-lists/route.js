export const dynamic = 'force-dynamic';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

// Função auxiliar para obter o caminho da pasta de listas
function getListasPath(clientId) {
  if (!clientId || typeof clientId !== 'string' || !clientId.includes('/')) {
    throw new Error('ClientId inválido fornecido.');
  }
  const [type, name] = clientId.split('/');
  // Garante que estamos na pasta 'ativos' por segurança
  if (type !== 'ativos') {
    console.warn(`Tentativa de acesso a listas fora de 'ativos': ${clientId}`);
    throw new Error('Acesso permitido apenas para clientes ativos.');
  }
  const clientePath = path.join(process.cwd(), 'clientes', type, name);
  return path.join(clientePath, 'config', 'listas');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'ClientId é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const listasDir = getListasPath(clientId);

    if (!existsSync(listasDir)) {
      console.log(
        `Diretório de listas não encontrado para ${clientId}: ${listasDir}`
      );
      return new Response(JSON.stringify({ listNames: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }); // Retorna array vazio se a pasta não existe
    }

    const files = await fs.readdir(listasDir);
    const listNames = files
      .filter((file) => file.toLowerCase().endsWith('.json')) // Filtra apenas arquivos .json
      .map((file) => path.basename(file, '.json')); // Remove a extensão .json

    return new Response(JSON.stringify({ listNames }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao listar arquivos de lista:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno ao listar arquivos de lista',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
