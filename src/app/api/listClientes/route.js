import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv'; // Importar dotenv

const execAsync = promisify(exec);

async function checkProcessStatus(clientName) {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    const clientProcess = processes.find(p => p.name === clientName);
    return clientProcess ? clientProcess.pm2_env.status === 'online' : false;
  } catch (error) {
    console.error('Error checking PM2 status:', error); // Descomentado
    return false;
  }
}

// Função para ler o CLIENTE_ID do .env
function readClienteIdFromEnv(clientFolderPath) {
  const envPath = path.join(clientFolderPath, 'config', '.env');
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const parsedEnv = dotenv.parse(envContent); // Usar dotenv.parse
      return parsedEnv.CLIENTE_ID || null;
    }
  } catch (error) {
    console.error(`Error reading .env for ${clientFolderPath}:`, error);
  }
  return null;
}


export async function POST() {
  try {
    const clientesPath = path.join(process.cwd(), 'clientes');
    const folders = [];

    const mainFolders = fs.readdirSync(clientesPath);

    for (const mainFolder of mainFolders) {
      const mainFolderPath = path.join(clientesPath, mainFolder);

      // Garantir que é um diretório esperado (ativos, cancelados, modelos)
      if (fs.statSync(mainFolderPath).isDirectory() && ['ativos', 'cancelados', 'modelos'].includes(mainFolder)) {
        const clientFolders = fs.readdirSync(mainFolderPath);

        for (const clientFolder of clientFolders) {
          const clientFolderPath = path.join(mainFolderPath, clientFolder); // Caminho completo da pasta do cliente
          const relativePath = path.join(mainFolder, clientFolder); // Caminho relativo (tipo/nome)

          if (fs.statSync(clientFolderPath).isDirectory()) {
            const isActive = await checkProcessStatus(clientFolder);
            const clienteSequencialId = readClienteIdFromEnv(clientFolderPath); // Ler ID do .env

            folders.push({
              id: relativePath.replace(/\\/g, '/'), // Usar caminho relativo como ID principal para consistência
              name: clientFolder,
              path: relativePath.replace(/\\/g, '/'),
              type: mainFolder === 'ativos' ? 'active' : mainFolder === 'cancelados' ? 'canceled' : 'model',
              folderType: mainFolder,
              status: isActive ? 'active' : 'inactive',
              clienteSequencialId: clienteSequencialId // Adicionar ID sequencial
            });
          }
        }
      }
    }
    console.log("API /api/listClientes: Clientes encontrados:", folders); // Adicionado log
    return new Response(JSON.stringify(folders), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error("Error listing clients:", error);
    return new Response(JSON.stringify({ error: "Failed to list clients" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}