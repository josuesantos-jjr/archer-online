import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST(request) {
  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json({ error: 'Comando não fornecido' }, { status: 400 });
    }

    // Execute o comando. Cuidado com a segurança aqui!
    // Em um ambiente de produção, você deve validar e sanitizar o comando rigorosamente.
    const { stdout, stderr } = await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    if (stderr) {
      console.error(`Erro no comando: ${stderr}`);
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    console.log(`Comando executado com sucesso: ${stdout}`);
    return NextResponse.json({ output: stdout });

  } catch (error) {
    console.error(`Erro ao executar comando: ${error.message}`);
    console.error('Erro na rota /api/terminal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Adicionar um handler GET básico para teste, se necessário
export async function GET() {
  return NextResponse.json({ message: 'API de Terminal funcionando' });
}