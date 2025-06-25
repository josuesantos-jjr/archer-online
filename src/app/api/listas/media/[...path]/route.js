import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

// GET /api/listas/media/[listaNome]/media/[filename]
export async function GET(request, { params }) {
  try {
    // A URL será algo como /api/listas/media/minhaLista/media/arquivo.jpg
    // O params.path agora deve conter o caminho completo a partir da raiz do projeto,
    // como retornado pela API de listagem de mídias (src/app/api/media/route.js).
    // Ex: params.path = ['clientes', 'ativos', 'Global Tur', 'media', 'nome_arquivo.jpg']
    const filePath = join(
      process.cwd(),
      params.path.join('/')
    );

    try {
      const file = await fs.readFile(filePath);

      // Define o Content-Type baseado na extensão do arquivo
      const ext = extname(filePath).toLowerCase();
      const contentType = 
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        ext === '.png' ? 'image/png' :
        ext === '.gif' ? 'image/gif' :
        ext === '.mp4' ? 'video/mp4' :
        ext === '.webm' ? 'video/webm' :
        ext === '.ogg' ? 'application/ogg' :
        ext === '.mp3' ? 'audio/mpeg' :
        ext === '.wav' ? 'audio/wav' :
        ext === '.zip' ? 'application/zip' :
        ext === '.pdf' ? 'application/pdf' :
        'application/octet-stream';

      return new NextResponse(file, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
        },
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Arquivo não encontrado' },
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro ao servir arquivo de mídia:', error);
    return NextResponse.json(
      { error: 'Erro ao servir arquivo de mídia' },
      { status: 500 }
    );
  }
}
