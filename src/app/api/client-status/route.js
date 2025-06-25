export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const [folderType, clientName] = clientId.split('/');
    const envPath = path.join(
      process.cwd(),
      'clientes',
      folderType,
      clientName,
      'config',
      '.env'
    );

    const envContent = await fs.readFile(envPath, 'utf-8');
    const status = envContent
      .split('\n')
      .find((line) => line.startsWith('STATUS='))
      ?.split('=')[1]
      ?.trim()
      ?.replace(/^["']|["']$/g, '');

    return NextResponse.json({ status: status || 'inactive' });
  } catch (error) {
    console.error('Error reading client status:', error);
    return NextResponse.json({ status: 'inactive' });
  }
}
