import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { sanitizeFilename } from '../../../../utils/sanitizeFilename.js'; // Importa função de sanitização

// Função para obter informações do caminho (similar à de delete)
function parseMediaInfo(clientIdInput, relativeFilePath) {
  let clienteTipo = 'ativos';
  let clienteNome = clientIdInput;
  let listaNome = null;
  let currentFileName = null;

  if (clientIdInput && clientIdInput.includes('/')) {
    const parts = clientIdInput.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      clienteTipo = parts[0];
      clienteNome = parts[1];
    }
  }

  const pathParts = relativeFilePath.replace(/\\/g, '/').split('/');
  const listasIndex = pathParts.indexOf('listas');
  const mediaIndex = pathParts.indexOf('media');

  if (listasIndex !== -1 && mediaIndex !== -1 && mediaIndex > listasIndex + 1) {
    listaNome = pathParts.slice(listasIndex + 1, mediaIndex).join('/');
    currentFileName = pathParts[pathParts.length - 1]; // Pega o último segmento como nome do arquivo
  }

  if (!listaNome || !currentFileName) {
    throw new Error(
      `Não foi possível extrair informações do caminho: ${relativeFilePath}`
    );
  }

  const basePath = path.join(
    process.cwd(),
    'clientes',
    clienteTipo,
    clienteNome
  );
  const mediaDir = path.join(basePath, 'config', 'listas', listaNome, 'media');
  const currentFullFilePath = path.join(mediaDir, currentFileName);
  const listaJsonPath = path.join(
    basePath,
    'config',
    'listas',
    `${listaNome}.json`
  );

  return {
    basePath,
    mediaDir,
    currentFullFilePath,
    currentFileName,
    listaNome,
    listaJsonPath,
  };
}

export async function PUT(request) {
  try {
    const { clientId, currentRelativePath, newFileNameWithoutExt } =
      await request.json();

    if (!clientId || !currentRelativePath || !newFileNameWithoutExt) {
      return NextResponse.json(
        {
          error:
            'clientId, currentRelativePath e newFileNameWithoutExt são obrigatórios',
        },
        { status: 400 }
      );
    }

    console.log(
      `[API Media Rename] Recebido pedido para renomear: clientId=${clientId}, path=${currentRelativePath}, novoNome=${newFileNameWithoutExt}`
    );

    const {
      mediaDir,
      currentFullFilePath,
      currentFileName,
      listaNome,
      listaJsonPath,
    } = parseMediaInfo(clientId, currentRelativePath);

    // Sanitiza o novo nome e adiciona a extensão original
    const originalExtension = path.extname(currentFileName);
    const sanitizedNewBaseName = sanitizeFilename(newFileNameWithoutExt);
    const newFileName = `${sanitizedNewBaseName}${originalExtension}`;
    const newFullFilePath = path.join(mediaDir, newFileName);
    const newRelativePath = path
      .join('config', 'listas', listaNome, 'media', newFileName)
      .replace(/\\/g, '/');

    console.log(`[API Media Rename] Caminho antigo: ${currentFullFilePath}`);
    console.log(`[API Media Rename] Caminho novo: ${newFullFilePath}`);
    console.log(`[API Media Rename] Path relativo novo: ${newRelativePath}`);

    // 1. Verifica se o novo nome já existe
    if (currentFileName === newFileName) {
      return NextResponse.json(
        { error: 'O novo nome é igual ao nome atual.' },
        { status: 400 }
      );
    }
    try {
      await fs.access(newFullFilePath);
      // Se não deu erro, o arquivo já existe
      return NextResponse.json(
        { error: `Um arquivo com o nome "${newFileName}" já existe.` },
        { status: 409 }
      ); // 409 Conflict
    } catch (err) {
      // Se deu erro ENOENT, ótimo, o nome está livre. Outros erros são problemas.
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    // 2. Renomeia o arquivo físico
    try {
      await fs.rename(currentFullFilePath, newFullFilePath);
      console.log(
        `[API Media Rename] Arquivo físico renomeado para: ${newFullFilePath}`
      );
    } catch (err) {
      console.error(
        `[API Media Rename] Erro ao renomear arquivo físico ${currentFullFilePath} para ${newFullFilePath}`,
        err
      );
      // Tenta reverter? Por enquanto, apenas retorna erro.
      throw new Error(`Erro ao renomear arquivo físico: ${err.message}`);
    }

    // 3. Atualiza o JSON da lista
    let listaData;
    try {
      const listaContent = await fs.readFile(listaJsonPath, 'utf8');
      listaData = JSON.parse(listaContent);
    } catch (err) {
      console.error(
        `[API Media Rename] Erro ao ler JSON ${listaJsonPath} após renomear arquivo. O arquivo foi renomeado, mas o JSON não pôde ser atualizado.`,
        err
      );
      // Retorna sucesso parcial, pois o arquivo foi renomeado, mas o JSON não.
      return NextResponse.json({
        success: true,
        warning:
          'Arquivo renomeado, mas erro ao ler JSON da lista para atualizar referência.',
      });
    }

    let updated = false;
    // Atualiza no array 'media'
    if (listaData.media && Array.isArray(listaData.media)) {
      const mediaIndex = listaData.media.findIndex(
        (item) => item.arquivo === currentRelativePath
      );
      if (mediaIndex !== -1) {
        listaData.media[mediaIndex].arquivo = newRelativePath; // Atualiza o caminho
        updated = true;
        console.log(
          `[API Media Rename] Referência atualizada no array 'media' em ${listaNome}.json`
        );
      }
    }

    // Atualiza selectedMediaPath se for o arquivo renomeado
    if (listaData.selectedMediaPath === currentRelativePath) {
      listaData.selectedMediaPath = newRelativePath;
      updated = true;
      console.log(
        `[API Media Rename] 'selectedMediaPath' atualizado em ${listaNome}.json`
      );
    }

    // Salva o JSON apenas se houve alteração
    if (updated) {
      try {
        await fs.writeFile(listaJsonPath, JSON.stringify(listaData, null, 2));
        console.log(
          `[API Media Rename] JSON da lista ${listaNome}.json atualizado.`
        );
      } catch (writeErr) {
        console.error(
          `[API Media Rename] Erro ao salvar JSON ${listaJsonPath} após renomear arquivo. O arquivo foi renomeado, mas o JSON não pôde ser salvo.`,
          writeErr
        );
        return NextResponse.json({
          success: true,
          warning:
            'Arquivo renomeado, mas erro ao salvar JSON da lista atualizado.',
        });
      }
    } else {
      console.log(
        `[API Media Rename] Nenhuma referência encontrada para ${currentRelativePath} no JSON da lista ${listaNome}.json.`
      );
    }

    // Retorna o novo caminho relativo para o frontend atualizar o estado
    return NextResponse.json({ success: true, newRelativePath });
  } catch (error) {
    console.error('[API Media Rename] Erro:', error);
    return NextResponse.json(
      { error: `Erro ao renomear mídia: ${error.message}` },
      { status: 500 }
    );
  }
}
