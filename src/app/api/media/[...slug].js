import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import mime from 'mime-types'; // Usaremos a lib 'mime-types' para detectar o Content-Type

export async function GET(request, { params }) {
  const slug = params.slug; // Array de partes da URL: ['ativos', 'Alpha', 'config', 'listas', 'teste%202', 'media', 'arquivo.mp3']
  const requestedUrlPath = slug?.join('/') || 'URL inválida'; // Para logs
  console.log(
    `[API Media] Recebida requisição para: /api/media/${requestedUrlPath}`
  );

  // Precisa de pelo menos tipo, nome, e 'media/arquivo' -> length 4
  if (!slug || slug.length < 4) {
    console.error(
      `[API Media] URL inválida - slug muito curto: ${requestedUrlPath}`
    );
    return NextResponse.json(
      { error: 'URL inválida para mídia (slug muito curto).' },
      { status: 400 }
    );
  }

  let filePath = ''; // Inicializa fora do try para usar no catch
  try {
    // Decodifica cada parte do slug para lidar com espaços (%20) e outros caracteres
    const decodedSlug = slug.map((part) => decodeURIComponent(part));
    console.log(`[API Media] Slug decodificado: ${decodedSlug.join('/')}`);

    const clienteTipo = decodedSlug[0];
    const clienteNome = decodedSlug[1];
    // O caminho relativo começa do terceiro elemento em diante
    const relativeFilePath = decodedSlug.slice(2).join('/'); // Ex: 'config/listas/teste 2/media/arquivo.jpeg'

    // Validação básica: verifica se o caminho contém '/media/'
    if (!clienteTipo || !clienteNome || !relativeFilePath.includes('/media/')) {
      console.error(
        `[API Media] Tentativa de acesso inválido (caminho decodificado não contém /media/): ${decodedSlug.join('/')}`
      );
      return NextResponse.json(
        { error: 'Caminho de mídia inválido.' },
        { status: 400 }
      );
    }

    // Constrói o caminho absoluto completo usando as partes decodificadas
    filePath = path.join(
      process.cwd(),
      'clientes',
      clienteTipo,
      clienteNome,
      relativeFilePath
    );
    console.log(`[API Media] Construído caminho absoluto: ${filePath}`);

    // Verifica se o arquivo existe
    console.log(`[API Media] ===> Verificando acesso a: ${filePath}`); // Log adicionado
    await fs.access(filePath); // Lança erro se não existir
    console.log(`[API Media] Arquivo encontrado: ${filePath}`);

    // Lê o arquivo
    const fileBuffer = await fs.readFile(filePath);

    // Determina o Content-Type
    const contentType = mime.lookup(filePath) || 'application/octet-stream'; // Padrão genérico

    // Retorna o arquivo com o cabeçalho correto
    console.log(
      `[API Media] Servindo arquivo: ${filePath} com tipo ${contentType}`
    );
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 'Content-Length': fileBuffer.length.toString(), // Opcional
        // 'Cache-Control': 'public, max-age=31536000, immutable' // Opcional para cache
      },
    });
  } catch (error) {
    // Usa o filePath construído no try para logar o caminho exato que falhou
    console.error(
      `[API Media] Erro ao servir mídia (${requestedUrlPath}). Caminho tentado: ${filePath}`,
      error
    );

    if (error.code === 'ENOENT') {
      // Extrai o caminho relativo novamente para a mensagem de erro
      const decodedSlugForError = slug?.map((part) =>
        decodeURIComponent(part)
      ) || ['desconhecido'];
      const relativeFilePathForError = decodedSlugForError.slice(2).join('/');
      return NextResponse.json(
        {
          error: `Arquivo de mídia não encontrado: ${relativeFilePathForError}`,
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno ao servir mídia.' },
      { status: 500 }
    );
  }
}
