import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { sanitizeFilename } from '../../../utils/sanitizeFilename.js';

// Função para garantir que o diretório exista
async function ensureDirectoryExists(directoryPath) {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    // Ignora o erro se o diretório já existir, mas lança outros erros
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const clientIdInput = formData.get('clientId');

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }
    if (!clientIdInput) {
      return NextResponse.json(
        { error: 'clientId não fornecido.' },
        { status: 400 }
      );
    }

    // Determina o tipo e nome do cliente a partir do clientIdInput
    let clienteTipo = 'ativos'; // Padrão
    let clienteNome = clientIdInput;

    if (clientIdInput && clientIdInput.includes('/')) {
      const parts = clientIdInput.split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        // TODO: Validar se parts[0] é um tipo válido ('ativos', 'cancelados', etc.)
        clienteTipo = parts[0];
        clienteNome = parts[1];
      } else {
        console.warn(
          `[upload-list-attachment] Formato de clientId inesperado: ${clientIdInput}. Usando como nome em '${clienteTipo}'.`
        );
      }
    }
    // Se não contém '/', assume que é apenas o nome e usa o tipo padrão 'ativos'

    const basePath = path.join(
      process.cwd(),
      'clientes',
      clienteTipo,
      clienteNome
    );
    const mediaDir = path.join(basePath, 'media');

    // Garante que o diretório base e o diretório media existam
    await ensureDirectoryExists(basePath);
    await ensureDirectoryExists(mediaDir);

    // Gera um nome de arquivo único e sanitizado
    const originalFilename = file.name || 'arquivo_anexo';
    const sanitizedOriginalName = sanitizeFilename(originalFilename); // Sanitiza o nome original
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${sanitizedOriginalName}`;
    const filePath = path.join(mediaDir, uniqueFilename);

    // Lê o buffer do arquivo e salva no disco
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Retorna o caminho relativo para ser salvo no JSON da lista
    // Usar barras normais para compatibilidade web/JSON
    const relativePath = `media/${uniqueFilename}`;

    console.log(
      `Anexo salvo para cliente ${clienteTipo}/${clienteNome}: ${relativePath}`
    );

    return NextResponse.json({ relativePath: relativePath }, { status: 200 });
  } catch (error) {
    console.error('Erro no upload do anexo da lista:', error);
    // Determina clienteTipo/clienteNome novamente para a mensagem de erro
    let clienteTipo = 'ativos';
    let clienteNome = request.formData().get('clientId') || 'desconhecido'; // Tenta obter de novo, ou usa placeholder
    if (clienteNome && clienteNome.includes('/')) {
      const parts = clienteNome.split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        clienteTipo = parts[0];
        clienteNome = parts[1];
      }
    }

    // Verifica se é um erro com código
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'ENOENT') {
        return NextResponse.json(
          {
            error: `Diretório do cliente não encontrado (${clienteTipo}/${clienteNome}). Verifique o clientId: ${error.path}`,
          },
          { status: 404 }
        );
      }
    }
    // Erro genérico
    return NextResponse.json(
      { error: `Erro interno do servidor ao salvar o anexo: ${error.message}` },
      { status: 500 }
    );
  }
}

// Adiciona uma rota GET ou OPTIONS básica se necessário para preflight requests ou testes
export async function GET() {
  return NextResponse.json({
    message:
      'API de upload de anexos de lista está ativa. Use POST para enviar arquivos.',
  });
}

export async function OPTIONS() {
  // Lida com preflight requests para CORS se necessário no futuro
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, GET, OPTIONS',
      // Adicionar cabeçalhos CORS se o frontend estiver em domínio diferente
      // 'Access-Control-Allow-Origin': '*',
      // 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      // 'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
