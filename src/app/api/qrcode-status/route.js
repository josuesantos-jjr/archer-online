import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return new Response(JSON.stringify({ error: 'Missing clientId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const simpleProcessName = clientId.includes('/') ? clientId.split('/').pop() : clientId;
  const qrCodeFileName = `${simpleProcessName}.png`;
  const qrCodePath = path.join('/tmp/qrcodes', qrCodeFileName);

  try {
    const qrCodeImage = await fs.readFile(qrCodePath);
    return new Response(qrCodeImage, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      // QR code not found, likely not generated yet or client is offline
      return new Response(JSON.stringify({ error: 'QR code not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error(`Error reading QR code for ${clientId}:`, error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}