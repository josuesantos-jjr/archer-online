import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QR_CODE_DIR = path.join(__dirname, 'qrcode');

if (!fs.existsSync(QR_CODE_DIR)) {
  fs.mkdirSync(QR_CODE_DIR, { recursive: true });
}

export async function saveQRCodeImageAndJson(urlCode: string, fullClientId: string): Promise<{ imagePath: string, jsonPath: string }> {
  try {
    const timestamp = Date.now();
    const sanitizedClientId = fullClientId.replace(/\//g, '_'); // Substitui '/' por '_'
    const filenamePrefix = `${sanitizedClientId}_${timestamp}`;
    const imagePath = path.join(QR_CODE_DIR, `${filenamePrefix}.png`);
    const jsonPath = path.join(QR_CODE_DIR, `${filenamePrefix}.json`);

    const qrCodeDataUrl = await QRCode.toDataURL(urlCode, {
      errorCorrectionLevel: 'H',
      margin: 1,
      scale: 8
    });

    const base64Image = qrCodeDataUrl.split(';base64,').pop();
    if (!base64Image) {
      throw new Error('Não foi possível extrair a imagem Base64 do QR Code.');
    }

    fs.writeFileSync(imagePath, base64Image, 'base64');
    fs.writeFileSync(jsonPath, JSON.stringify({ urlCode: urlCode, timestamp: timestamp, clientId: fullClientId }, null, 2), 'utf-8');
    console.log(`QR Code imagem e JSON salvos para ${fullClientId}.`);
    return { imagePath, jsonPath };
  } catch (error) {
    console.error('Erro ao gerar e salvar QR Code e JSON:', error);
    throw error;
  }
}
