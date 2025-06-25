import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

// Função auxiliar para garantir que o diretório de mídia existe
async function ensureMediaDir(clientId, listaNome) {
  const [clienteBase, clienteNome] = clientId.split('/');
  const mediaPath = join(process.cwd(), 'clientes', 'ativos', clienteNome, 'config', 'listas', listaNome, 'media');
  
  try {
    await fs.access(mediaPath);
  } catch {
    await fs.mkdir(mediaPath, { recursive: true });
  }
  
  return mediaPath;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const clientId = formData.get('clientId');
    const listaNome = formData.get('listaNome');
    const tipo = formData.get('tipo'); 

    if (!file || !clientId || !listaNome || !tipo) {
      return NextResponse.json(
        { error: 'Arquivo, ClientId, ListaId e tipo são obrigatórios' },
        { status: 400 }
      );
    }

    // Validação do tipo de mídia
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', // Imagens
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', // Vídeos
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/wave', // Áudios
      'application/pdf', // Documentos
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .doc, .docx
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xls, .xlsx
      'text/plain', 'text/csv', // .txt, .csv
      'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', // .odt, .ods
      'application/zip', // .zip
    ];
 
    const allowedExtensions = [
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'mp4', 'webm', 'ogg', 'mov',
        'mp3', 'wav', 'aac', 'flac', 'wave',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'odt', 'ods', 'zip'
    ];
 
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const isAllowedByMime = allowedMimeTypes.includes(file.type);
    const isAllowedByExtension = allowedExtensions.includes(fileExtension);
 
    if (!isAllowedByMime && !isAllowedByExtension) {
      return NextResponse.json(
        { error: `Tipo de arquivo não suportado: ${file.type || fileExtension}` },
        { status: 400 }
      );
    }

    const mediaDir = await ensureMediaDir(clientId, listaNome);
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(mediaDir, fileName);
    
    // Converte o File/Blob para buffer e salva
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // Retorna o caminho relativo do arquivo para referência
    const relativePath = join(listaNome, 'media', fileName);

    return NextResponse.json({ 
      success: true,
      filePath: relativePath.replace(/\\/g, '/'),
      tipo
    });
  } catch (error) {
    console.error('Erro ao fazer upload de mídia:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload de mídia' }, { status: 500 });
  }
}