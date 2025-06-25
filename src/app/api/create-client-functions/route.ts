// src/app/api/create-client-functions/route.ts
import { NextResponse } from 'next/server';
import { getPasta } from '@/backend/disparo/disparo';
import * as fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import * as fsPromises from 'node:fs/promises'; // Importar fs com Promises
 
// Caminho para o arquivo do contador local
const COUNTER_FILE_PATH = path.join(process.cwd(), 'clientCounter.json');
 
/**
 * Copia os arquivos do modelo para a pasta do novo cliente.
 */
async function copiarArquivosDoModelo(modeloId: string, novoClienteId: string) {
  const modeloPath = path.join(process.cwd(), 'clientes', 'modelos', modeloId);
  const novoClientePath = getPasta(novoClienteId); // novoClienteId ainda é 'ativos/testeX' aqui
  console.log(`[API] Copiando de ${modeloPath} para ${novoClientePath}`);

  try {
    // Cria a pasta do novo cliente se não existir
    if (!fs.existsSync(novoClientePath)) {
      console.log(`[API] Criando pasta ${novoClientePath}`);
      fs.mkdirSync(novoClientePath, { recursive: true });
    }

    // Copia os arquivos do modelo para a pasta do novo cliente
    fs.cpSync(modeloPath, novoClientePath, { recursive: true });
    console.log(`[API] Arquivos copiados do modelo ${modeloId} para ${novoClientePath}`);

    // --- Lógica para gerar e inserir CLIENTE_ID sequencial (Local) ---
    let currentCounter = 0;
    try {
        // Tenta ler o contador atual do arquivo local
        if (fs.existsSync(COUNTER_FILE_PATH)) {
            const counterContent = fs.readFileSync(COUNTER_FILE_PATH, 'utf-8');
            const counterData = JSON.parse(counterContent);
            currentCounter = counterData.lastId || 0;
        }
    } catch (readError) {
        console.error(`[API] Erro ao ler arquivo do contador local ${COUNTER_FILE_PATH}:`, readError);
        // Continua com 0 se houver erro de leitura
    }

    currentCounter += 1;
    const novoClienteIdSequencial = currentCounter;
    console.log(`[API] Gerado novo CLIENTE_ID sequencial: ${novoClienteIdSequencial}`);

    try {
        // Salva o novo contador no arquivo local
        await fsPromises.writeFile(COUNTER_FILE_PATH, JSON.stringify({ lastId: novoClienteIdSequencial }, null, 2), 'utf-8');
        console.log(`[API] Contador local atualizado em ${COUNTER_FILE_PATH}`);
    } catch (writeError) {
        console.error(`[API] Erro ao escrever arquivo do contador local ${COUNTER_FILE_PATH}:`, writeError);
        // Continua mesmo se houver erro de escrita, o ID já foi gerado
    }

    const envPath = path.join(novoClientePath, 'config', '.env');
    let envData = {};

    if (fs.existsSync(envPath)) {
      console.log(`[API] Arquivo .env encontrado em ${envPath}. Atualizando CLIENTE_ID.`);
      let envContent = await fs.promises.readFile(envPath, 'utf-8');

      // Substituir ou adicionar CLIENTE_ID
      const lines = envContent.split('\n');
      let clientIdFound = false;
      const newLines = lines.map(line => {
        if (line.trim().startsWith('CLIENTE_ID=')) {
          clientIdFound = true;
          return `CLIENTE_ID="${novoClienteIdSequencial}"`;
        }
        return line;
      });

      if (!clientIdFound) {
        newLines.push(`CLIENTE_ID="${novoClienteIdSequencial}"`);
      }
      envContent = newLines.join('\n');

      await fs.promises.writeFile(envPath, envContent, 'utf-8');
      console.log(`[API] CLIENTE_ID atualizado no .env para ${novoClienteIdSequencial}`);

      // Lê o arquivo .env atualizado para retornar os dados corretos
      const parsedEnv = dotenv.config({ path: envPath }).parsed;
      if (parsedEnv) {
        envData = parsedEnv;
        console.log('[API] Dados lidos do .env atualizado:', envData);
      } else {
        console.log('[API] dotenv.config retornou parsed undefined ou null após atualização.');
      }

    } else {
      console.log(`[API] Arquivo .env NÃO encontrado em ${envPath}. Não foi possível adicionar CLIENTE_ID.`);
      // Se o .env não existe, envData permanece vazio como antes
    }
    // --- Fim da lógica para gerar e inserir CLIENTE_ID sequencial (Local) ---

    return NextResponse.json({ message: 'Arquivos copiados com sucesso', envData, clienteSequencialId: novoClienteIdSequencial }, { status: 200 });

  } catch (error) {
    console.error(`[API] Erro ao copiar arquivos do modelo ${modeloId}:`, error);
    return NextResponse.json({ error: 'Erro ao copiar arquivos do modelo' }, { status: 500 });
  }
}

/**
 * Salva as configurações no arquivo infoCliente.json do cliente.
 */
async function salvarConfigNoEnv(clientId: string, config: any) {
  try {
    const [folderType, clientName] = clientId.split('/');
    const infoClientePath = path.join(
      process.cwd(),
      'clientes',
      folderType,
      clientName,
      'config',
      'infoCliente.json'
    );
 
    // Garante que o arquivo exista
    if (!fs.existsSync(infoClientePath)) {
      console.warn(`Arquivo infoCliente.json não encontrado em ${infoClientePath}. Criando.`);
      await fsPromises.writeFile(infoClientePath, '{}', 'utf-8');
    }
 
    // Salva a configuração no arquivo infoCliente.json
    await fsPromises.writeFile(infoClientePath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[API] Configurações salvas no infoCliente.json para o cliente ${clientId}`);
    return { success: true, message: "Configurações salvas com sucesso no infoCliente.json" };
  } catch (error) {
    console.error(`[API] Erro ao salvar config no infoCliente.json para o cliente ${clientId}:`, error);
    return { success: false, error: `Erro desconhecido ao salvar no infoCliente.json: ${error instanceof Error ? error.message : String(error)}` };
  }
}
 
export async function POST(request: Request): Promise<NextResponse> {
  const { action, ...data } = await request.json();
  console.log(`[API] Recebida ação: ${action}`);
 
  switch (action) {
    case 'copiarArquivosDoModelo':
      return copiarArquivosDoModelo(data.modeloId, data.novoClienteId);
    case 'salvarDadosNoEnv': // Alterado de salvarDadosNoFirebase para salvarDadosNoEnv
      if (!data.novoClienteId || !data.novoClienteId.includes('/')) {
         console.error('[API] Erro: novoClienteId inválido ou não fornecido para salvarDadosNoEnv:', data.novoClienteId);
         return NextResponse.json({ error: 'ID do cliente inválido ou não fornecido.' }, { status: 400 });
      }
      // Chama salvarConfigNoEnv diretamente
      const envSaveResult = await salvarConfigNoEnv(data.novoClienteId, data.dados);
      if (!envSaveResult.success) {
          return NextResponse.json({ error: envSaveResult.error }, { status: 500 });
      }
      return NextResponse.json({ message: 'Dados salvos no infoCliente.json com sucesso' }, { status: 200 });
    default:
      console.log(`[API] Ação inválida recebida: ${action}`);
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  }
}