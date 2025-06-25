import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';

// Função auxiliar para garantir que o diretório de listas existe
async function ensureListasDir(clientId) {
  const [clienteBase, clienteNome] = clientId.split('/');
  const listasPath = path.join(process.cwd(), 'clientes', 'ativos', clienteNome, 'config', 'listas');
  
  try {
    await fs.access(listasPath);
  } catch {
    await fs.mkdir(listasPath, { recursive: true });
  }
  
  return listasPath;
}

// Função para processar a planilha
function processarPlanilha(buffer, tagColumn) {
  const workbook = XLSX.read(buffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet);

  return rows.map(row => {
    // Tenta encontrar as colunas de nome e telefone com diferentes possíveis nomes
    const nome = row.Nome || row.NOME || row.name || row.NAME || '';
    let telefone = row.Telefone || row.TELEFONE || row.phone || row.PHONE || row.Celular || row.CELULAR || '';
    // Procura por tags na planilha usando a coluna especificada
    const tags = row.tags || row.Tags || row.Tag || row.TAG || '';

    // Limpa o telefone para manter apenas números
    telefone = String(telefone).replace(/\D/g, '');

    // Adiciona o código do país se necessário
    if (telefone.length === 11) { // DDD + número (BR)
      telefone = '55' + telefone;
    }

    const tagsArray = tags ? [tags.trim()] : []; // Cria um array com a tag ou um array vazio
    return {
      nome,
      telefone,
      tags: tagsArray // Sempre inclui a propriedade tags como um array
    };
  }).filter(contato => contato.nome && contato.telefone);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const clientId = formData.get('clientId');
    const tagColumn = formData.get('tagColumn');
    const nomeLista = formData.get('nome'); // Novo: nome da lista
    const mensagemLista = formData.get('mensagem'); // Novo: mensagem da lista
    // Adicionar outros campos da lista conforme necessário (ex: media, regras, etc.)

    if (!file || !clientId || !tagColumn || !nomeLista) {
      return NextResponse.json({ error: 'Arquivo, clientId, coluna de tag ou nome da lista não fornecido' }, { status: 400 });
    }

    // Lê o arquivo
    const buffer = await file.arrayBuffer();
    const contatos = processarPlanilha(buffer, tagColumn);

    if (contatos.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato válido encontrado na planilha' }, { status: 400 });
    }

    // Gera um ID único para a lista
    const listaId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Monta o objeto completo da lista
    const listaCompletaData = {
      id: listaId,
      nome: nomeLista,
      mensagem: mensagemLista || 'Olá {nome}, tudo bem?', // Usar mensagem fornecida ou padrão
      media: [], // Assumindo que mídia não é enviada no upload da planilha
      ativo: true,
      regras: {},
      attachmentPath: "",
      sendAttachment: true,
      selectedMediaPath: null,
      contatos: contatos // Contatos processados da planilha com tags
    };

    // Salva a lista no arquivo JSON com o nome da lista
    const listasPath = await ensureListasDir(clientId);
    const listaPath = path.join(listasPath, `${nomeLista}.json`); // Usar nome da lista para o arquivo

    await fs.writeFile(
      listaPath,
      JSON.stringify(listaCompletaData, null, 2)
    );

    return NextResponse.json({
      success: true,
      message: `Lista "${nomeLista}" importada com sucesso: ${contatos.length} contatos`,
      listaId: listaId // Retorna o ID da lista criada
    });
  } catch (error) {
    console.error('Erro ao processar upload:', error);
    return NextResponse.json({ error: 'Erro ao processar arquivo' }, { status: 500 });
  }
}