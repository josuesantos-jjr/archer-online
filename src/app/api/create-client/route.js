// src/app/api/create-client/route.js
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
 
export async function POST(request) {
  try {
    const { modelo, nome, tipo } = await request.json();

    // Validações básicas
    if (!modelo || !nome || !tipo) {
      return NextResponse.json({ error: 'Dados insuficientes para criar cliente.' }, { status: 400 });
    }

    // Caminho do modelo e do novo cliente
    const modeloPath = path.join(process.cwd(), 'clientes', 'modelos', modelo);
    const novoClientePath = path.join(process.cwd(), 'clientes', tipo, nome);

    // Verifica se o modelo existe
    try {
      await fs.access(modeloPath);
    } catch {
      return NextResponse.json({ error: `Modelo "${modelo}" não encontrado.` }, { status: 404 });
    }

    // Copia os arquivos do modelo para a nova pasta do cliente
    await fs.cp(modeloPath, novoClientePath, { recursive: true });

    // A lógica de salvar dados do cliente no Firestore foi removida, pois o sistema usará apenas arquivos locais.
    // A criação do cliente agora se resume a copiar a pasta do modelo.
 
    return NextResponse.json({ message: `Cliente "${nome}" criado com sucesso (localmente).` }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar novo cliente:', error);
    return NextResponse.json({ error: 'Erro interno ao criar cliente.' }, { status: 500 });
  }
}