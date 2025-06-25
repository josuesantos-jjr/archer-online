import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const clientId = formData.get('clientId');
    const tipo = formData.get('tipo');

    if (!file || !clientId || !tipo) {
      return NextResponse.json(
        { error: 'Arquivo, ClientId e tipo são obrigatórios' },
        { status: 400 }
      );
    }

    // Validação do tipo de mídia
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'audio/mpeg',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Cria o diretório para a mídia dentro da pasta do cliente se não existir
    const [clientType, clientName] = clientId.split('/');
    const clientMediaDir = path.join(process.cwd(), 'clientes', clientType, clientName, 'media');
    await mkdir(clientMediaDir, { recursive: true });

    // Gera nome único para o arquivo
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(clientMediaDir, fileName);

    // Salva o arquivo
    await writeFile(filePath, buffer);

    const mediaInfo = {
      id: fileName, // Usar nome do arquivo como ID simples
      name: fileName,
      type: file.type,
      size: file.size,
      // O caminho retornado deve ser o caminho relativo a partir da raiz do projeto
      // para que a interface possa construir a URL de download/visualização correta.
      path: `clientes/${clientId}/media/${fileName}`,
      uploadedAt: new Date().toISOString(), // Data de upload
      metadata: {
        mimeType: file.type,
        originalName: file.name,
        dimensions: tipo === 'image' ? '1920x1080' : null, // Exemplo, pode precisar de lógica real
        duration: tipo === 'video' ? '00:01:30' : null, // Exemplo, pode precisar de lógica real
      },
    };

    return NextResponse.json({
      success: true,
      media: mediaInfo,
      message: 'Mídia salva com sucesso',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao processar mídia:', error);
    return NextResponse.json(
      { error: 'Erro ao processar mídia' },
      { status: 500 }
    );
  }
}

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

    const mediaDir = path.join(process.cwd(), 'media', clientId);
    let mediaList = [];

    try {
      const entries = await fs.readdir(mediaDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(mediaDir, entry.name);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(entry.name).toLowerCase();
          let fileType = 'application/octet-stream'; // Default MIME type

          // Determine MIME type based on extension
          switch (fileExtension) {
            case '.jpg':
            case '.jpeg':
              fileType = 'image/jpeg';
              break;
            case '.png':
              fileType = 'image/png';
              break;
            case '.gif':
              fileType = 'image/gif';
              break;
            case '.mp4':
              fileType = 'video/mp4';
              break;
            case '.webm':
              fileType = 'video/webm';
              break;
            case '.mp3':
              fileType = 'audio/mpeg';
              break;
            case '.wav':
              fileType = 'audio/wav';
              break;
            case '.pdf':
              fileType = 'application/pdf';
              break;
            // Adicionar outros tipos de mídia conforme necessário
          }


          mediaList.push({
            id: entry.name, // Usar nome do arquivo como ID simples
            name: entry.name,
            type: fileType, // Usar o MIME type determinado
            size: stats.size,
            size: stats.size,
            path: `clientes/${clientId}/media/${entry.name}`,
            uploadedAt: stats.mtime.toISOString(), // Data de modificação como data de upload
            metadata: {
              mimeType: fileType,
              originalName: entry.name,
              // Adicionar outros metadados se disponíveis ou necessários
            },
          });
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Diretório de mídia não existe para este cliente, retorna lista vazia
        console.log(`Diretório de mídia não encontrado para o cliente ${clientId}. Retornando lista vazia.`);
        return NextResponse.json({
          success: true,
          media: [],
          total: 0,
          timestamp: new Date().toISOString(),
        });
      }
      // Outro erro, lança para ser tratado pelo catch externo
      throw error;
    }


    return NextResponse.json({
      success: true,
      media: mediaList,
      total: mediaList.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao listar mídias:', error);
    return NextResponse.json(
      { error: 'Erro ao listar mídias' },
      { status: 500 }
    );
  }
}
