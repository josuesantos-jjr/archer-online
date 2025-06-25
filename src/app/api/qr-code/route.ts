export const dynamic = 'force-dynamic';
import { getQrCode } from './qrCodeCache.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Client ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Tenta obter do cache (gerado pelo backend)
    const qrCodeFromCache = getQrCode(clientId);
    if (qrCodeFromCache) {
      const prefixedQrCode = qrCodeFromCache.startsWith('data:image/png;base64,') ? qrCodeFromCache : `data:image/png;base64,${qrCodeFromCache}`;
      return new Response(JSON.stringify({ qrCode: prefixedQrCode, source: 'cache' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Se não estiver no cache, tenta ler da pasta config/qrcode/
    // O clientId já vem no formato "folderType/clientName" (ex: "ativos/GlobalTur")
    const qrcodeDir = path.join(process.cwd(), 'clientes', clientId, 'config', 'qrcode');
    
    let latestQrCodeData: { urlCode: string, timestamp: number, clientName: string } | null = null;
    let latestImagePath: string | null = null;

    try {
      const files = await fs.readdir(qrcodeDir);
      const qrCodeFiles = files.filter(file => file.startsWith(`${clientId.replace('/', '_')}_`) && (file.endsWith('.png') || file.endsWith('.json'))); // Ajuste para o prefixo do arquivo

      if (qrCodeFiles.length > 0) {
        // Prioriza a imagem PNG
        const pngFiles = qrCodeFiles.filter(file => file.endsWith('.png')).sort((a, b) => {
          const timestampA = parseInt(a.split('_')[1].split('.')[0]);
          const timestampB = parseInt(b.split('_')[1].split('.')[0]);
          return timestampB - timestampA; // Mais recente primeiro
        });

        if (pngFiles.length > 0) {
          latestImagePath = path.join(qrcodeDir, pngFiles[0]);
          const imageBuffer = await fs.readFile(latestImagePath);
          const base64Image = imageBuffer.toString('base64');
          return new Response(JSON.stringify({ qrCode: `data:image/png;base64,${base64Image}`, source: 'file_image' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Se não houver PNG, procura o JSON mais recente
        const jsonFiles = qrCodeFiles.filter(file => file.endsWith('.json')).sort((a, b) => {
          const timestampA = parseInt(a.split('_')[1].split('.')[0]);
          const timestampB = parseInt(b.split('_')[1].split('.')[0]);
          return timestampB - timestampA; // Mais recente primeiro
        });

        if (jsonFiles.length > 0) {
          const jsonContent = await fs.readFile(path.join(qrcodeDir, jsonFiles[0]), 'utf-8');
          latestQrCodeData = JSON.parse(jsonContent);
          // Se encontrar um JSON, o frontend precisará gerar a imagem a partir do urlCode
          return new Response(JSON.stringify({ qrCodeData: latestQrCodeData, source: 'file_json' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (readError: any) {
      if (readError.code === 'ENOENT') {
        // Diretório não existe, significa que não há QR codes gerados ainda
        console.log(`Diretório de QR Code não encontrado para ${clientId}: ${qrcodeDir}`);
      } else {
        console.error(`Erro ao ler arquivos de QR Code para ${clientId}:`, readError);
      }
    }

    // 3. Se não encontrar em nenhum lugar
    return new Response(JSON.stringify({ error: 'QR Code not found or not yet generated' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error retrieving QR code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
