export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'dados', 'criar aqui os codigos sql.txt');
    const data = await fs.readFile(filePath, 'utf8');
    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}