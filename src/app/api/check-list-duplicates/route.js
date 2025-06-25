import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { clientId, newPhoneNumbers } = await request.json();

    if (!clientId || !newPhoneNumbers) {
      return NextResponse.json(
        { error: 'ClientId e contatos são obrigatórios' },
        { status: 400 }
      );
    }

    // Verifica duplicatas
    const duplicates = [];
    const processedNumbers = new Set();

    newPhoneNumbers.forEach((telefone) => {
      if (processedNumbers.has(telefone)) {
        duplicates.push(telefone);
      } else {
        processedNumbers.add(telefone);
      }
    });

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      duplicates,
      uniqueCount: processedNumbers.size,
      totalCount: newPhoneNumbers.length,
    });
  } catch (error) {
    console.error('Erro ao verificar duplicatas:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar duplicatas' },
      { status: 500 }
    );
  }
}
