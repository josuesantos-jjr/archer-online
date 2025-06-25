import { promises as fs } from 'fs';
import path from 'path';

// Removidos imports não utilizados do Firestore
// import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
// import { initializeAppIfNeeded } from '../../../lib/firebaseAdminConfig'; // Ajuste o caminho se necessário

/**
 * Interface para representar a estrutura esperada de um arquivo de lista JSON.
 * Adapte conforme a estrutura real dos seus arquivos.
 * @typedef {object} ListaDisparo
 * @property {boolean} [ativo] - Indica se a lista está ativa para disparo (padrão: true).
 * @property {string} [statusInterno] - Status interno da lista (ex: 'pendente', 'rodando', 'finalizada', 'erro').
 * @property {string} [mensagemErro] - Mensagem de erro caso statusInterno seja 'erro'.
 * @property {Array<{disparo?: string}>} [contatos] - Array de contatos na lista.
 */

/**
 * Lê e processa os arquivos JSON de listas para um cliente específico.
 * @param {string} listasDirPath - Caminho para o diretório de listas do cliente.
 * @param {string} clientId - Identificador do cliente (para logs).
 * @returns {Promise<Array<ListaDisparo & {id: string}>>} - Array de objetos de lista processados.
 */
async function lerListasDoCliente(listasDirPath, clientId) {
  let listas = [];
  try {
    const files = await fs.readdir(listasDirPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const listasPromises = jsonFiles.map(async (file) => {
      const filePath = path.join(listasDirPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        // Adiciona o nome da lista (baseado no nome do arquivo) como ID
        // Garante que 'ativo' exista, assumindo true como padrão se ausente
        return {
          id: path.basename(file, '.json'),
          ...data,
          ativo: data.ativo === undefined ? true : !!data.ativo, // Garante booleano
        };
      } catch (readError) {
        console.error(
          `Erro ao ler ou parsear o arquivo ${filePath} para ${clientId}:`,
          readError
        );
        // Retorna null para indicar falha nesta lista específica
        return null;
      }
    });

    // Aguarda todas as leituras e filtra as que falharam (null)
    const resultados = await Promise.all(listasPromises);
    listas = resultados.filter(
      /** @returns {lista is ListaDisparo & {id: string}} */
      (lista) => lista !== null
    );

  } catch (err) {
    // Se o diretório não existe, é esperado, retorna array vazio
    if (err.code === 'ENOENT') {
      console.log(
        `Diretório de listas não encontrado para ${clientId} em ${listasDirPath}, assumindo sem listas.`
      );
      listas = [];
    } else {
      // Para outros erros de leitura do diretório, loga e relança para o handler principal
      console.error(
        `Erro inesperado ao ler diretório de listas ${listasDirPath} para ${clientId}:`,
        err
      );
      throw new Error(
        `Falha ao acessar as listas do cliente: ${err.message}`
      );
    }
  }
  return listas;
}

/**
 * Calcula o status geral do disparo com base nas listas processadas.
 * **IMPORTANTE:** Esta função assume a existência de campos como `statusInterno`
 * e `contatos` dentro dos arquivos JSON das listas. Adapte a lógica
 * conforme a estrutura real dos seus dados.
 *
 * @param {Array<ListaDisparo & {id: string}>} listas - Array de listas lidas do cliente.
 * @returns {{statusGeral: string, listasAtivasCount: number, listaAtual: {indice: number, progressoPercentual: number}, totalListasNaFila: number, logErro: string | null}} - Objeto com o status calculado.
 */
function calcularStatusDisparo(listas) {
  let statusGeral = 'sem_listas_disparo'; // Padrão inicial
  let listasAtivasCount = 0;
  let listaAtual = { indice: 0, progressoPercentual: 0 };
  let totalListasNaFila = 0;
  let logErro = null;

  if (listas.length === 0) {
    return {
      statusGeral,
      listasAtivasCount,
      listaAtual,
      totalListasNaFila,
      logErro,
    };
  }

  // Considera apenas as listas marcadas como 'ativo: true' para o cálculo de status
  const listasAtivas = listas.filter((l) => l.ativo === true);
  listasAtivasCount = listasAtivas.length;
  totalListasNaFila = listasAtivas.length; // Assumindo que a fila são todas as ativas

  if (listasAtivasCount === 0) {
    statusGeral = 'sem_listas_ativas'; // Existem arquivos de lista, mas nenhuma está ativa
    // Verifica se alguma lista *inativa* tem erro registrado (opcional, mas pode ser útil)
    const algumaInativaComErro = listas.find(
      (l) => !l.ativo && l.statusInterno === 'erro'
    );
    if (algumaInativaComErro) {
      logErro =
        algumaInativaComErro.mensagemErro ||
        'Erro encontrado em uma lista inativa.';
    }
    return {
      statusGeral,
      listasAtivasCount,
      listaAtual,
      totalListasNaFila,
      logErro,
    };
  }

  // --- Lógica de Status baseada nas listas ATIVAS ---
  // **Adapte os campos ('statusInterno', 'contatos', 'disparo', 'mensagemErro') à sua estrutura real!**

  const listaRodando = listasAtivas.find((l) => l.statusInterno === 'rodando');
  const algumaComErro = listasAtivas.find((l) => l.statusInterno === 'erro');
  const todasConcluidas = listasAtivas.every(
    (l) => l.statusInterno === 'finalizada'
  );

  if (algumaComErro) {
    // Prioriza o status de erro se alguma lista ativa falhou
    statusGeral = 'erro';
    logErro = algumaComErro.mensagemErro || 'Erro detectado em uma lista ativa.';
    // Tenta encontrar o índice da lista com erro para referência
    const indiceErro = listasAtivas.findIndex((l) => l.id === algumaComErro.id);
    listaAtual.indice = indiceErro >= 0 ? indiceErro + 1 : 0; // +1 para ser 1-based
    listaAtual.progressoPercentual = 0; // Progresso não relevante no erro
  } else if (listaRodando) {
    statusGeral = 'em_andamento';
    const indiceRodando = listasAtivas.findIndex(
      (l) => l.id === listaRodando.id
    );
    listaAtual.indice = indiceRodando >= 0 ? indiceRodando + 1 : 0; // +1 para ser 1-based

    // Calcula progresso (exemplo baseado em contatos com 'disparo: sim')
    const totalContatos = listaRodando.contatos?.length || 0;
    const enviados =
      listaRodando.contatos?.filter((c) => c.disparo === 'sim').length || 0;
    listaAtual.progressoPercentual =
      totalContatos > 0 ? Math.round((enviados / totalContatos) * 100) : 0;
  } else if (todasConcluidas) {
    statusGeral = 'concluido';
    listaAtual.indice = totalListasNaFila; // Considera a última como "atual" no estado concluído
    listaAtual.progressoPercentual = 100;
  } else {
    // Nenhuma rodando, nenhuma com erro, nem todas concluídas -> Pausada, Aguardando, Ocioso?
    // Defina o status apropriado para seu caso. Usando 'pausado' como exemplo.
    statusGeral = 'pausado'; // Ou 'aguardando_inicio', 'ocioso', etc.
    listaAtual.indice = 0; // Nenhuma lista específica está "ativa" no momento
    listaAtual.progressoPercentual = 0;
  }

  return {
    statusGeral,
    listasAtivasCount,
    listaAtual,
    totalListasNaFila,
    logErro,
  };
}

// --- Rota da API ---
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId'); // Ex: 'ativos/Alpha' ou 'prospects/Beta'

  if (!clientId || !clientId.includes('/') || clientId.split('/').length !== 2) {
    return new Response(
      JSON.stringify({ error: 'Parâmetro "clientId" ausente ou inválido. Formato esperado: tipo/nome (ex: ativos/Alpha)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const [clienteTipo, clienteNome] = clientId.split('/');

  // Validação simples dos nomes (evita traversals básicos)
  if (!clienteTipo || !clienteNome || clienteTipo.includes('..') || clienteNome.includes('..')) {
      return new Response(
          JSON.stringify({ error: 'Tipo ou nome do cliente inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
  }

  console.log(`[API] Buscando status de disparo para cliente: ${clientId}`);

  try {
    // 1. Construir o caminho para o diretório de listas do cliente
    // Usar path.resolve para um caminho mais robusto baseado no diretório do projeto
    const basePath = path.resolve(process.cwd(), 'clientes'); // Assume que 'clientes' está na raiz do projeto
    const listasDirPath = path.join(
      basePath,
      clienteTipo,
      clienteNome,
      'config',
      'listas'
    );

    // 2. Ler e processar os arquivos JSON das listas
    const listas = await lerListasDoCliente(listasDirPath, clientId);

    // 3. Calcular o status agregado com base nas listas lidas
    const statusCalculado = calcularStatusDisparo(listas);

    // 4. Retornar a resposta
    console.log(`[API] Status para ${clientId}:`, statusCalculado);
    return new Response(JSON.stringify(statusCalculado), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    // Captura erros lançados por lerListasDoCliente ou outros erros inesperados
    console.error(
      `[API] Erro crítico ao buscar status de disparo para ${clientId}:`,
      error
    );
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor ao processar a solicitação de status.',
        details: error.message, // Inclui a mensagem do erro lançado
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
