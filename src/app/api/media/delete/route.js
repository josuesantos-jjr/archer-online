import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Função para obter o caminho base do cliente e o nome da lista a partir do path relativo
function parseMediaInfo(clientIdInput, relativeFilePath) {
  let clienteTipo = 'ativos';
  let clienteNome = clientIdInput;
  let listaNome = null;

  if (clientIdInput && clientIdInput.includes('/')) {
    const parts = clientIdInput.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      clienteTipo = parts[0];
      clienteNome = parts[1];
    }
  }

  // Extrai o nome da lista do caminho relativo
  // Ex: config/listas/NomeDaLista/media/arquivo.mp3
  const pathParts = relativeFilePath.replace(/\\/g, '/').split('/');
  const listasIndex = pathParts.indexOf('listas');
  const mediaIndex = pathParts.indexOf('media');
  if (listasIndex !== -1 && mediaIndex !== -1 && mediaIndex > listasIndex + 1) {
    listaNome = pathParts.slice(listasIndex + 1, mediaIndex).join('/'); // Pega tudo entre 'listas' e 'media'
  }

  if (!listaNome) {
    throw new Error(
      `Não foi possível extrair o nome da lista do caminho: ${relativeFilePath}`
    );
  }

  const basePath = path.join(
    process.cwd(),
    'clientes',
    clienteTipo,
    clienteNome
  );
  const fullFilePath = path.join(basePath, relativeFilePath);
  const listaJsonPath = path.join(
    basePath,
    'config',
    'listas',
    `${listaNome}.json`
  );

  return { basePath, fullFilePath, listaNome, listaJsonPath };
}

export async function DELETE(request) {
  try {
    const { clientId, relativeFilePath } = await request.json();

    if (!clientId || !relativeFilePath) {
      return NextResponse.json(
        { error: 'clientId e relativeFilePath são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(
      `[API Media Delete] Recebido pedido para excluir: clientId=${clientId}, path=${relativeFilePath}`
    );

    const { fullFilePath, listaNome, listaJsonPath } = parseMediaInfo(
      clientId,
      relativeFilePath
    );

    console.log(
      `[API Media Delete] Tentando excluir arquivo físico: ${fullFilePath}`
    );
    console.log(
      `[API Media Delete] Tentando atualizar JSON da lista: ${listaJsonPath}`
    );

    // 1. Excluir o arquivo físico
    try {
      await fs.unlink(fullFilePath);
      console.log(
        `[API Media Delete] Arquivo físico excluído: ${fullFilePath}`
      );
    } catch (err) {
      // Se o arquivo não existir, loga mas continua para tentar limpar o JSON
      if (err.code === 'ENOENT') {
        console.warn(
          `[API Media Delete] Arquivo físico não encontrado (${fullFilePath}), mas tentando remover referência do JSON.`
        );
      } else {
        throw err; // Relança outros erros de exclusão
      }
    }

    // 2. Atualizar o JSON da lista
    let listaData;
    try {
      const listaContent = await fs.readFile(listaJsonPath, 'utf8');
      listaData = JSON.parse(listaContent);
    } catch (err) {
      // Se o JSON não existe, não há o que fazer
      if (err.code === 'ENOENT') {
        console.warn(
          `[API Media Delete] JSON da lista ${listaJsonPath} não encontrado. Nenhuma atualização necessária.`
        );
        return NextResponse.json({
          success: true,
          message:
            'Arquivo físico (se existia) excluído, JSON da lista não encontrado.',
        });
      }
      throw err; // Relança outros erros de leitura/parse
    }

    let updated = false;
    // Remove do array 'media'
    if (listaData.media && Array.isArray(listaData.media)) {
      const initialLength = listaData.media.length;
      // Usa o caminho relativo completo para encontrar o item correto
      listaData.media = listaData.media.filter(
        (item) => item.arquivo !== relativeFilePath
      );
      if (listaData.media.length < initialLength) {
        updated = true;
        console.log(
          `[API Media Delete] Referência removida do array 'media' em ${listaNome}.json`
        );
      }
    }

    // Verifica e limpa selectedMediaPath se for o arquivo excluído
    if (listaData.selectedMediaPath === relativeFilePath) {
      listaData.selectedMediaPath = null;
      updated = true;
      console.log(
        `[API Media Delete] 'selectedMediaPath' limpo em ${listaNome}.json`
      );
    }

    // Salva o JSON apenas se houve alteração
    if (updated) {
      await fs.writeFile(listaJsonPath, JSON.stringify(listaData, null, 2));
      console.log(
        `[API Media Delete] JSON da lista ${listaNome}.json atualizado.`
      );
    } else {
      console.log(
        `[API Media Delete] Nenhuma atualização necessária no JSON da lista ${listaNome}.json.`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Media Delete] Erro:', error);
    return NextResponse.json(
      { error: `Erro ao excluir mídia: ${error.message}` },
      { status: 500 }
    );
  }
}
