export const dynamic = 'force-dynamic';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  const modelsDirectory = path.join(process.cwd(), 'clientes', 'modelos');

  try {
    const dirents = await fs.readdir(modelsDirectory, { withFileTypes: true });
    const directories = dirents
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log('Modelos encontrados:', directories); // Log para depuração
    return new Response(JSON.stringify({ models: directories }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Diretório de modelos não encontrado:', modelsDirectory);
      // Se o diretório não existe, retorna uma lista vazia
      return new Response(JSON.stringify({ models: [] }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }
    console.error('Erro ao listar modelos:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao listar modelos' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}