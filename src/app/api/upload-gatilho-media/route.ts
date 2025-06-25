import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// Helper function to determine file type (copiada de src/backend/service/braim/gatilhos.ts)
const getFileType = (filePath: string): 'image' | 'audio' | 'video' | 'document' | 'other' => {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return 'image';
  } else if (['.mp3', '.wav', '.ogg', '.aac', '.opus'].includes(ext)) {
    return 'audio';
  } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(ext)) {
    return 'video';
  } else if (['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
    return 'document';
  }
  return 'other';
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const clientId = formData.get('clientId') as string;
    const gatilhoNome = formData.get('gatilhoNome') as string;
    const files = formData.getAll('files') as File[];

    if (!clientId || !gatilhoNome || files.length === 0) {
      return NextResponse.json({ error: 'Missing clientId, gatilhoNome, or files' }, { status: 400 });
    }

    // Assumindo que clientId é no formato 'tipo/nomeCliente' ou apenas 'nomeCliente'
    const clientName = clientId.split('/').pop();
    if (!clientName) {
         return NextResponse.json({ error: 'Invalid clientId format' }, { status: 400 });
    }

    // Construir o caminho base para salvar os arquivos
    const baseDir = path.join(process.cwd(), 'clientes', 'ativos', clientName, 'config', 'gatilhosMedias', gatilhoNome);

    // Criar diretórios se não existirem
    await fs.mkdir(baseDir, { recursive: true });

    const uploadedFilePaths: string[] = [];
    const uploadedFileTypes: ('image' | 'audio' | 'video' | 'document')[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Gerar um nome de arquivo único para evitar colisões
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const filePath = path.join(baseDir, uniqueFileName);

      // Escrever o arquivo usando Uint8Array para compatibilidade
      await fs.writeFile(filePath, new Uint8Array(buffer));
      
      // Salva o caminho relativo a clientes/ativos/(nomeCliente)
      uploadedFilePaths.push(path.relative(path.join(process.cwd(), 'clientes', 'ativos', clientName), filePath));
      
      // Determina e salva o tipo de cada arquivo, filtrando 'other'
      const fileType = getFileType(filePath);
      if (fileType !== 'other') {
        uploadedFileTypes.push(fileType);
      } else {
        // Se o tipo for 'other', podemos definir um tipo padrão ou ignorar
        // Por enquanto, vamos ignorar para evitar erros de tipo no frontend
        console.warn(`[API Upload Gatilho] Tipo de mídia desconhecido para ${file.name}. Ignorando.`);
      }
    }

    return NextResponse.json({ uploadedFilePaths, uploadedFileTypes }); // Incluir tipos de mídia na resposta

  } catch (error: any) {
    console.error('[API Upload Gatilho] Error uploading gatilho media:', error);
    return NextResponse.json({ error: 'Failed to upload gatilho media', details: error.message }, { status: 500 });
  }
}

// Adicionar um handler para outros métodos, se necessário, embora POST seja o principal para upload
export async function GET() {
    return NextResponse.json({ message: 'GET method not supported for this endpoint.' }, { status: 405 });
}