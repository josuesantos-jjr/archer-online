import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function copyFolder(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });

  await fs.mkdir(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyFolder(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function POST(request) {
  try {
    const { operation, sourceClient, targetType, targetName, oldClientId, newClientName } = await request.json();

    const clientesPath = path.join(process.cwd(), 'clientes');

    let sourceType, sourceName, sourcePath;

    if (sourceClient) {
      [sourceType, sourceName] = sourceClient.split('/');
      sourcePath = path.join(clientesPath, sourceType, sourceName);
    }


    switch (operation) {
      case 'copy': {
        if (!sourceClient) {
           return NextResponse.json({ error: 'Dados incompletos para copiar' }, { status: 400 });
        }
        // Store the source path in memory for paste operation
        global.copiedClientPath = sourcePath;
        return NextResponse.json({ success: true, message: 'Cliente copiado' });
      }

      case 'paste': {
        if (!global.copiedClientPath) {
          return NextResponse.json({ error: 'Nenhum cliente copiado' }, { status: 400 });
        }
        if (!targetType || !targetName) {
           return NextResponse.json({ error: 'Dados incompletos para colar' }, { status: 400 });
        }


        const targetPath = path.join(clientesPath, targetType, targetName);

        // Check if target already exists
        try {
          await fs.access(targetPath);
          return NextResponse.json({ error: 'Cliente já existe no destino' }, { status: 400 });
        } catch {
          // Target doesn't exist, we can proceed
          await copyFolder(global.copiedClientPath, targetPath);
        }

        return NextResponse.json({ success: true, message: 'Cliente colado com sucesso' });
      }

      case 'duplicate': {
        if (!sourceClient) {
           return NextResponse.json({ error: 'Dados incompletos para duplicar' }, { status: 400 });
        }
        const baseName = sourceName;
        let newName = `${baseName}_copy`;
        let counter = 1;
        let targetPath = path.join(clientesPath, sourceType, newName);

        // Find a unique name
        while (true) {
          try {
            await fs.access(targetPath);
            newName = `${baseName}_copy${counter}`;
            targetPath = path.join(clientesPath, sourceType, newName);
            counter++;
          } catch {
            break;
          }
        }

        await copyFolder(sourcePath, targetPath);
        return NextResponse.json({
          success: true,
          message: 'Cliente duplicado',
          newClientId: `${sourceType}/${newName}`
        });
      }

      case 'move': {
        if (!sourceClient || !targetType) {
           return NextResponse.json({ error: 'Dados incompletos para mover' }, { status: 400 });
        }
        const targetPath = path.join(clientesPath, targetType, sourceName);
        console.log(`[API client-operations] Move operation:`); // Log 1
        console.log(`  - Source Path: ${sourcePath}`); // Log 2
        console.log(`  - Target Path: ${targetPath}`); // Log 3

        // Check if target already exists
        try {
          await fs.access(targetPath);
          console.log(`[API client-operations] Target path already exists. Returning 400.`); // Log 4
          return NextResponse.json({ error: 'Cliente já existe no destino' }, { status: 400 });
        } catch {
          // Target doesn't exist, we can proceed
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          console.log(`[API client-operations] Target path does not exist. Proceeding with rename.`); // Log 5
          await fs.rename(sourcePath, targetPath);
        }

        return NextResponse.json({
          success: true,
          message: 'Cliente movido com sucesso',
          newClientId: `${targetType}/${sourceName}`
        });
      }

      case 'rename': {
        if (!oldClientId || !newClientName) {
          return NextResponse.json({ error: 'Dados incompletos para renomear' }, { status: 400 });
        }

        const [oldClientType, oldClientName] = oldClientId.split('/');

        // Check if the new name is the same as the old name
        if (oldClientName === newClientName) {
          console.log(`[API client-operations] Rename operation: New name is the same as the old name. No action needed.`);
          return NextResponse.json({
            success: true,
            message: 'Nome do cliente não alterado',
            newClientId: oldClientId // Return the original ID
          });
        }

        const oldPath = path.join(clientesPath, oldClientType, oldClientName);
        const newPath = path.join(clientesPath, oldClientType, newClientName);

        console.log(`[API client-operations] Rename operation:`);
        console.log(`  - Old Path: ${oldPath}`);
        console.log(`  - New Path: ${newPath}`);

        // Check if the old client directory exists
        try {
            await fs.access(oldPath);
        } catch (error) {
            console.error(`[API client-operations] Old client path not found: ${oldPath}`, error);
            return NextResponse.json({ error: 'Cliente antigo não encontrado para renomear' }, { status: 404 });
        }


        // Check if the new client directory already exists
        try {
          await fs.access(newPath);
          console.log(`[API client-operations] New client path already exists: ${newPath}. Returning 400.`);
          return NextResponse.json({ error: `Já existe um cliente com o nome "${newClientName}"` }, { status: 400 });
        } catch {
          // New name is available, proceed with rename
          console.log(`[API client-operations] New client path does not exist. Proceeding with rename.`);
          await fs.rename(oldPath, newPath);
        }

        return NextResponse.json({
          success: true,
          message: 'Cliente renomeado com sucesso',
          newClientId: `${oldClientType}/${newClientName}`
        });
      }

      default:
        return NextResponse.json({ error: 'Operação inválida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in client operations:', error);
    // Retorna uma mensagem de erro mais genérica para o frontend
    return NextResponse.json({
      error: 'Erro ao renomear cliente. Por favor, tente novamente.'
    }, { status: 500 }); // Retorna 500 para erros internos não tratados
  }
}