export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { getPasta } from '@/backend/disparo/disparo'; // Importar getPasta

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let clientId = searchParams.get('clientId'); // Manter clientId para obter o caminho da pasta
    clientId = clientId?.includes('/') ? clientId.split('/').pop() : clientId;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    const clienteFolderPath = getPasta(clientId);

    if (!fs.existsSync(clienteFolderPath)) {
      return NextResponse.json({ error: 'Pasta do cliente não encontrada' }, { status: 404 });
    }

    // Configurar o arquivador
    const archive = archiver('zip', {
      zlib: { level: 9 } // Nível de compressão
    });

    // Configurar a resposta HTTP para download
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${clientId}-folder.zip"`);

    // Criar um ReadableStream para o arquivador
    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        archive.on('end', () => {
          controller.close();
        });
        archive.on('error', (err) => {
          controller.error(err);
        });

        // Adicionar o conteúdo da pasta ao arquivo ZIP
        archive.directory(clienteFolderPath, false); // O segundo argumento 'false' evita criar um diretório raiz dentro do zip
        archive.finalize();
      },
    });

    return new NextResponse(stream, { headers });

  } catch (error) {
    console.error('Erro no endpoint de download:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}