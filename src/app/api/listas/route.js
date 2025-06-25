import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path, { join, dirname, basename } from 'path'; // Manter para manipulação de mídia, se necessário

const MENSAGEM_PADRAO = 'Olá {nome}, tudo bem?';

// Função auxiliar para garantir que o diretório de listas existe
async function ensureListasDir(clientId) {
    const [clienteBase, clienteNome] = clientId.split('/');
    const listasPath = join(process.cwd(), 'clientes', 'ativos', clienteNome, 'config', 'listas');
    
    try {
      await fs.access(listasPath);
    } catch {
      await fsPromises.mkdir(listasPath, { recursive: true });
    }
    
    return listasPath;
  }


// GET /api/listas?clientId=...
// GET /api/listas?clientId=...&clienteSequencialId=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId'); // Manter clientId para obter o caminho da pasta

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'ClientId é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Lógica de Carregamento Local ---
    const clienteFolderPath = await ensureListasDir(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local
    let localListas = [];
    try {
      const files = await fsPromises.readdir(clienteFolderPath);
      
      const listas = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async (file) => {
            const filePath = join(clienteFolderPath, file);
            const content = await fsPromises.readFile(filePath, 'utf8');
            const lista = JSON.parse(content);
            const listaNome = path.basename(file, '.json');

            // Verifica se existem arquivos de mídia
            const mediaPath = join(clienteFolderPath, listaNome, 'media');
            let media = lista.media || [];
            
            try {
              const mediaFiles = await fsPromises.readdir(mediaPath);
              // Atualiza os caminhos dos arquivos de mídia existentes
              media = mediaFiles.map(file => ({
                arquivo: `${listaNome}/media/${file}`,
                tipo: file.match(/\.(jpg|jpeg|png|gif)$/i) ? 'imagem' :
                      file.match(/\.(mp4|webm)$/i) ? 'video' :
                      file.match(/\.(ogg|mp3|wav)$/i) ? 'audio' :
                      file.match(/\.(pdf|ppt|pptx|doc|docx)$/i) ? 'documento' : 'outro'
              }));
            } catch {
              // Se o diretório não existir, continua com media vazio
            }

            // Define 'ativo' como true por padrão se não estiver definido no JSON
            const ativo = lista.ativo === undefined ? true : lista.ativo;

            return {
              id: lista.id, // Inclui o ID da lista
              nome: listaNome,
              ativo: ativo, // Inclui o estado 'ativo'
              mensagem: lista.mensagem || MENSAGEM_PADRAO,
              media,
              contatos: (lista.contatos || []).map(c => ({ // Garante que contatos seja um array
                ...c,
                mensagem: (lista.mensagem || MENSAGEM_PADRAO)
                  .replace('{nome}', c.nome || '')
                  .replace('{sobrenome}', c.sobrenome || '')
              })),
              // Calcular contagens para progresso
              totalContatos: lista.contatos?.length || 0,
              contatosDisparados: (lista.contatos || []).filter(c => c.disparo === "sim").length,
              contatosLeadGerado: (lista.contatos || []).filter(c => c.leadGerado).length // Inclui contagem de leads gerados
            };
          })
      );
      localListas = listas;
    } catch (localError) {
        console.error(`[API /api/listas GET] Erro ao carregar listas localmente para ${clientId}:`, localError);
        // Continuar, mas logar o erro
    }
    // --- Fim Lógica de Carregamento Local ---


        return new Response(JSON.stringify({ listas: localListas }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
  } catch (error) {
    console.error('Erro ao listar listas do Firestore:', error);
    return new Response(JSON.stringify({ error: 'Erro ao listar listas' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PUT /api/listas - Atualizar lista existente no Firestore
// PUT /api/listas - Atualizar lista existente no Firestore e localmente
export async function PUT(request) {
  try {
    const body = await request.json();
    // Assume que o frontend agora envia o ID da lista para atualização
    let { clientId, listaId, nome, novoNome, contatos, tags, mensagem, ativo, media, selectedMediaPath } = body; // usando let para permitir reatribuição de listaId, adicionado 'media' e 'selectedMediaPath'

    // Validação: Precisa de clientId e listaId. Precisa de 'ativo' OU 'contatos' OU 'novoNome' OU 'mensagem' OU 'tags'.
    // Validação: Precisa de clientId e listaId. Precisa de 'ativo' OU 'contatos' OU 'novoNome' OU 'mensagem' OU 'tags' OU 'media'.
    // Validação: Precisa de clientId e listaId. Precisa de 'ativo' OU 'contatos' OU 'novoNome' OU 'mensagem' OU 'tags' OU 'media'.
    if (!clientId) {
        console.error('[API /api/listas PUT] Validação falhou: clientId faltando. Body recebido:', body);
        return new Response(JSON.stringify({ error: 'ClientId é obrigatório para atualização', bodyRecebido: body }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!listaId) {
        console.error('[API /api/listas PUT] Validação falhou: listaId faltando. Body recebido:', body);
        // Check if novoNome is provided and try to find the list by name as a fallback
        if (novoNome !== undefined) {
            console.warn('[API /api/listas PUT] listaId faltando, tentando encontrar lista por novoNome:', novoNome);
            
            const clienteFolderPath = await ensureListasDir(clientId);
            const listaFilePath = path.join(clienteFolderPath, `${novoNome}.json`);

            try {
                // Tenta ler o arquivo da lista pelo novo nome
                const content = await fsPromises.readFile(listaFilePath, 'utf8');
                const lista = JSON.parse(content);
                listaId = lista.id; // Define o listaId com o ID encontrado no arquivo
                nome = novoNome; // Define o nome com o novoNome
                console.log(`[API /api/listas PUT] Lista encontrada por nome: ${novoNome}, usando listaId: ${listaId}`);
            } catch (error) {
                console.error(`[API /api/listas PUT] Lista com nome "${novoNome}" não encontrada:`, error);
                return new Response(JSON.stringify({ error: `Lista com nome "${novoNome}" não encontrada. ListaId é obrigatório para atualizar uma lista existente.`, bodyRecebido: body }), {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                });
            }
        } else {
            // listaId and novoNome are both missing
            return new Response(JSON.stringify({ error: 'ListaId é obrigatório para atualizar uma lista existente', bodyRecebido: body }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    // Agora verifica se pelo menos um campo para atualizar foi fornecido
    if (ativo === undefined && contatos === undefined && novoNome === undefined && mensagem === undefined && tags === undefined && media === undefined) {
        console.error('[API /api/listas PUT] Validação falhou: Nenhum campo para atualizar fornecido. Body recebido:', body);
        return new Response(JSON.stringify({ error: 'Nenhum campo para atualizar fornecido (ativo, contatos, novoNome, mensagem, tags, media)', bodyRecebido: body }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
 
    let updateData = {};

    // Atualiza campos da lista se fornecidos
    if (novoNome !== undefined) {
        updateData.nome = novoNome;
        // TODO: Lógica para renomear diretório de mídia associado, se necessário
    }
    if (mensagem !== undefined) {
        updateData.mensagem = mensagem;
    }
    if (ativo !== undefined) {
        updateData.ativo = ativo;
    }
    // Regras da lista não estão sendo passadas pelo frontend na edição atual,
    // mas poderiam ser adicionadas aqui se necessário. updateData.regras = ...
    if (tags !== undefined) { // Adicionar atualização de tags no documento da lista
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
        updateData.tags = tagsArray; // Salvar tags no documento da lista também
    }
    if (selectedMediaPath !== undefined) { // Adiciona atualização de mídia selecionada
        updateData.media = [{ arquivo: selectedMediaPath, tipo: selectedMediaPath.match(/\.(jpg|jpeg|png|gif)$/i) ? 'imagem' :
        selectedMediaPath.match(/\.(mp4|webm)$/i) ? 'video' :
        selectedMediaPath.match(/\.(ogg|mp3|wav)$/i) ? 'audio' :
        selectedMediaPath.match(/\.(pdf|ppt|pptx|doc|docx)$/i) ? 'documento' : 'outro' }];
    } else if (media !== undefined) { // Mantém a lógica anterior caso selectedMediaPath não seja fornecido
      updateData.media = media;
    }

    // Se há dados para atualizar na lista (nome, mensagem, ativo, tags, media), faz a atualização no Firestore
    if (Object.keys(updateData).length > 0) {
        //await listaDocRef.update(updateData);
    }

    // Se 'contatos' foi fornecido (edição completa), atualiza a subcoleção de contatos no Firestore
    if (contatos) {
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
         const incomingContatoPhones = new Set(contatos.map(c => c.telefone.replace(/\D/g, '')));
 
         // A lógica de atualização de contatos agora é feita diretamente no arquivo JSON local
         // A remoção e adição/atualização de contatos será tratada ao salvar o arquivo completo
    }

    // --- Lógica de Salvamento Local (Arquivo JSON Individual) ---
    const clienteFolderPath = await ensureListasDir(clientId);
    if (!nome) {
        console.error('[API /api/listas PUT] Validação falhou: nome faltando. Body recebido:', body);
        return new Response(JSON.stringify({ error: 'Nome é obrigatório para atualização', bodyRecebido: body }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
    const nomeOriginal = nome; // Nome antes da atualização
    const nomeFinal = novoNome !== undefined ? novoNome : nomeOriginal; // Nome após a atualização

    const caminhoArquivoOriginal = path.join(clienteFolderPath, `${nomeOriginal}.json`);
    const caminhoArquivoFinal = path.join(clienteFolderPath, `${nomeFinal}.json`);
    const caminhoMediaOriginal = path.join(clienteFolderPath, nomeOriginal, 'media');
    const caminhoMediaFinal = path.join(clienteFolderPath, nomeFinal, 'media');

    // Monta o objeto completo com os dados atualizados do body
    let dadosParaSalvarLocal = {
      id: listaId,
      nome: nomeFinal,
      mensagem: mensagem !== undefined ? mensagem : MENSAGEM_PADRAO,
      media: media !== undefined ? media : [],
      ativo: ativo !== undefined ? ativo : true,
      tags: tags !== undefined ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      contatos: contatos !== undefined ? contatos : [],
      regras:  {},
      attachmentPath: "",
      sendAttachment: true,
      selectedMediaPath: selectedMediaPath !== undefined ? selectedMediaPath : null,
    };

    // Ajusta selectedMediaPath após inicializar dadosParaSalvarLocal
    dadosParaSalvarLocal = {
      ...dadosParaSalvarLocal,
      selectedMediaPath: selectedMediaPath !== undefined ? selectedMediaPath : (dadosParaSalvarLocal.media?.[0]?.arquivo || null)
    };

    try {
      // Renomear arquivo e pasta de mídia se o nome mudou
      if (novoNome !== undefined && novoNome !== nomeOriginal) {
        try {
          await fsPromises.rename(caminhoArquivoOriginal, caminhoArquivoFinal);
          console.log(`[API /api/listas PUT] Arquivo JSON local renomeado de ${nomeOriginal}.json para ${nomeFinal}.json`);

          // Tenta renomear a pasta de mídia, ignora erro se não existir
          try {
            await fsPromises.rename(caminhoMediaOriginal, caminhoMediaFinal);
            console.log(`[API /api/listas PUT] Pasta de mídia local renomeada de ${nomeOriginal}/media para ${nomeFinal}/media`);
          } catch (renameMediaError) {
            if (renameMediaError.code !== 'ENOENT') { // Ignora erro "não encontrado"
              console.warn(`[API /api/listas PUT] Aviso ao renomear pasta de mídia local: ${renameMediaError.message}`);
            }
          }
        } catch (renameError) {
          console.error(`[API /api/listas PUT] Erro ao renomear arquivo JSON local ${nomeOriginal}.json:`, renameError);
          // Continuar para tentar salvar no caminho final mesmo assim
        }
      }

      // Salvar os dados atualizados no arquivo JSON individual (no caminho final)
      await fsPromises.writeFile(caminhoArquivoFinal, JSON.stringify(dadosParaSalvarLocal, null, 2), 'utf-8');
      console.log(`[API /api/listas PUT] Lista atualizada salva localmente em ${caminhoArquivoFinal}`);

    } catch (localError) {
      console.error(`[API /api/listas PUT] Erro ao salvar lista localmente (${caminhoArquivoFinal}):`, localError);
      // Considerar se deve retornar erro aqui ou apenas logar
    }
    // --- Fim Lógica de Salvamento Local (Arquivo JSON Individual) ---


    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao atualizar lista:', error);
    return new Response(JSON.stringify({ error: 'Erro ao atualizar lista' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  }

// POST /api/listas - Criar nova lista no Firestore e localmente
export async function POST(request) {
  try {
    const { clientId, nome, contatos, tags, mensagem, media = [] } = await request.json();

    if (!clientId || !nome || !contatos) {
      return new Response(JSON.stringify({ error: 'Dados incompletos ou formato de contatos inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(contatos)) {
        return new Response(JSON.stringify({ error: 'Formato de contatos inválido: deve ser um array' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // --- Lógica de Salvamento Local ---
    const clienteFolderPath = await ensureListasDir(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local

    // --- Lógica para criar arquivo JSON individual para a lista ---
    const listaCompletaData = {
      id:  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      nome: nome,
      mensagem: mensagem || MENSAGEM_PADRAO,
      media: media || [],
      ativo: true,
      regras: {},
      attachmentPath: "",
      sendAttachment: true,
      selectedMediaPath: null,
      contatos: contatos || [] // Adiciona os contatos
    };
    const listaFilePath = path.join(clienteFolderPath, `${nome}.json`);

    try {
      await fsPromises.writeFile(listaFilePath, JSON.stringify(listaCompletaData, null, 2), 'utf-8');
      console.log(`[API /api/listas POST] Lista salva como arquivo JSON individual: ${listaFilePath}`);
    } catch (localError) {
      console.error(`[API /api/listas POST] Erro ao salvar lista como arquivo JSON individual:`, localError);
      return new Response(JSON.stringify({ error: 'Erro ao salvar lista localmente' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // --- Fim Lógica para criar arquivo JSON individual ---

    return new Response(JSON.stringify({ success: true, listaId: listaCompletaData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao criar lista:', error);
    return new Response(JSON.stringify({ error: 'Erro ao criar lista' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE /api/listas - Excluir lista do Firestore
// DELETE /api/listas - Excluir lista do Firestore e localmente
export async function DELETE(request) {
 try {
  const { clientId, listaId } = await request.json();

  if (!clientId || !listaId) {
      return new Response(JSON.stringify({ error: 'ClientId e ListaId são obrigatórios para exclusão' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Lógica de Exclusão Local ---
    const clienteFolderPath = await ensureListasDir(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local
    const listaFilePath = path.join(clienteFolderPath, `${listaId}.json`);
    
    try {
      // Tenta excluir o arquivo JSON individual da lista
      await fsPromises.unlink(listaFilePath);
      console.log(`[API /api/listas DELETE] Lista removida localmente: ${listaFilePath}`);
    } catch (localError) {
      console.error(`[API /api/listas DELETE] Erro ao excluir lista localmente:`, localError);
      return new Response(JSON.stringify({ error: 'Erro ao excluir lista localmente' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao excluir lista:', error);
    return new Response(JSON.stringify({ error: 'Erro ao excluir lista' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
