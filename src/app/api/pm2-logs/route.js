import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  console.log(`[pm2-logs] Received request for clientId: ${clientId}`);

  if (!clientId) {
    console.error('[pm2-logs] Client ID is required');
    return new Response(JSON.stringify({ error: 'Client ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const simpleProcessName = clientId.includes('/') ? clientId.split('/').pop() : clientId;

  try {
    // Tenta obter a lista de processos PM2 para verificar se o processo existe
    const { stdout: listStdout } = await execAsync('npx pm2 jlist');
    const processes = JSON.parse(listStdout);
    const clientProcess = processes.find(p => p.name === simpleProcessName);

    if (!clientProcess) {
      console.warn(`[pm2-logs] Process for client ${clientId} not found in PM2 list.`);
      return new Response(JSON.stringify({ error: `Process for client ${clientId} not found` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Executa o comando pm2 logs para obter os logs
    const { stdout: logsStdout, stderr: logsStderr } = await execAsync(`npx pm2 logs ${simpleProcessName} --nostream`); // --nostream para não ficar ouvindo

    if (logsStderr) {
      console.warn(`[pm2-logs] Stderr from pm2 logs command for ${clientId}:`, logsStderr);
    }

    console.log(`[pm2-logs] Successfully retrieved logs for client ${clientId}. Log length: ${logsStdout.length}`);
    return new Response(JSON.stringify({ logs: logsStdout }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(`[pm2-logs] Error getting logs for client ${clientId}:`, error);
    let errorMessage = 'Internal server error';
    if (error.message.includes('pm2: command not found')) {
      errorMessage = 'PM2 command not found. Ensure PM2 is installed and accessible.';
    } else if (error.message.includes('No such process')) {
      errorMessage = `Process for client ${clientId} not found or not running.`;
    }
    return new Response(JSON.stringify({ error: errorMessage, details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}