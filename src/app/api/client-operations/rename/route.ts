import { NextResponse } from 'next/server';
import { getPasta } from '@/backend/disparo/disparo';
import { exec } from 'child_process';
 
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { oldClientId, newClientName } = await request.json() as { oldClientId: string; newClientName: string };

    if (!oldClientId || !newClientName) {
      return NextResponse.json({ error: 'oldClientId e newClientName são obrigatórios' }, { status: 400 });
    }

    const parts = oldClientId.split('/');
    if (parts.length !== 2) {
      return NextResponse.json({ error: 'oldClientId deve estar no formato "folderType/oldName"' }, { status: 400 });
    }
    const [folderType, oldName] = parts;
    const newClientId = `${folderType}/${newClientName}`;
    const oldPath = getPasta(oldClientId);
    const newPath = getPasta(newClientId);

    try {
      // Renomear a pasta
      const renameCommand = `mv "${oldPath}" "${newPath}"`;
      const { stdout, stderr } = await new Promise<any>((resolve, reject) => {
        exec(renameCommand, (error: any, stdout: any, stderr: any) => {
          if (error) {
            console.error(`Erro ao executar comando: ${renameCommand}`, error);
            reject({ error: new Error(`Erro ao renomear pasta: ${error.message}`), stdout, stderr });
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
      console.log(`Comando executado com sucesso: ${renameCommand}`);
      console.log('stdout:', stdout);
      if (stderr) {
        console.warn('stderr:', stderr);
      }
    
      return NextResponse.json({ message: 'Cliente renomeado com sucesso', newClientId }, { status: 200 });
    } catch (error) {
      console.error('Erro ao renomear cliente:', error);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
       
      // Rollback: Tentar renomear a pasta de volta se a renomeação inicial falhar
      try {
        const rollbackCommand = `mv "${newPath}" "${oldPath}"`;
        await new Promise<void>((resolve, reject) => {
          exec(rollbackCommand, (error: any, stdout: any, stderr: any) => {
            if (error) {
              console.error(`Erro ao executar rollback: ${rollbackCommand}`, error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } catch (rollbackError) {
        console.error('Erro ao fazer rollback da renomeação:', rollbackError);
      }
    
      return NextResponse.json({ error: 'Erro ao renomear cliente. Por favor, tente novamente.' }, { status: 500 });
    }

    // Atualizar o clientId nos arquivos .env (simulação, pois não temos acesso direto ao sistema de arquivos)
    // Implementar a lógica para atualizar os arquivos .env aqui, se possível

  } catch (error) {
    console.error('Erro ao renomear cliente:', error);
    return NextResponse.json({ error: 'Erro ao renomear cliente' }, { status: 500 });
  }
}