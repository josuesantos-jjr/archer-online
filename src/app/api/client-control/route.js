import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path'; // Adiciona a importação do módulo path
import fs from 'fs'; // Adiciona a importação do módulo fs (usado na verificação de existência do script)

const execAsync = promisify(exec);

async function getProcessStatus(clientId) {
  try {
    // Usa o nome simples do cliente para buscar no PM2
    const simpleProcessName = clientId.includes('/') ? clientId.split('/').pop() : clientId;
    const { stdout } = await execAsync('npx pm2 jlist'); // Usar jlist para obter saída JSON
    const processes = JSON.parse(stdout);
    const processInfo = processes.find(p => p.name === simpleProcessName);
    if (processInfo) {
      return processInfo.pm2_env.status; // Retorna o status ('online', 'stopped', 'errored', etc.)
    }
    return 'not_found'; // Retorna 'not_found' se o processo não existe na lista
  } catch (error) {
    // Se pm2 jlist falhar (ex: pm2 daemon não rodando), assume que não foi encontrado
    console.error('Error checking process status with pm2 jlist:', error.message, error.stack);
    // Poderia retornar um status de erro específico, mas 'not_found' simplifica a lógica de start
    return 'not_found'; // Retorna 'not_found' se o processo não existe na lista
  }
}

export async function POST(request) {
  try {
    const { clientId, action } = await request.json();
    console.log(`[API /api/client-control] Received - clientId: ${clientId}, action: ${action}`); // Log recebido

    if (!clientId || !action) {
      console.error('[API /api/client-control] Missing required fields');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usa o clientId completo como nome do processo PM2 para garantir unicidade
    const processName = clientId;
    console.log(`[API /api/client-control] Determined - processName (using full clientId): ${processName}`); // Log nome determinado

    // Verifica o status do processo usando o nome extraído
    const status = await getProcessStatus(clientId);
    console.log(`[API /api/client-control] Check Status - processName: ${processName}, status: ${status}`); // Log verificação

    if (action === 'start') {
      if (status === 'online' || status === 'launching') {
        console.log(`[API /api/client-control] Process ${processName} is already online or launching. Returning success.`);
        return new Response(JSON.stringify({ success: true, status: status }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let command;
      let simpleProcessName = clientId.includes('/') ? clientId.split('/').pop() : clientId;
      const scriptPath = `clientes/${clientId}/index.ts`;
      const absoluteScriptPath = path.join(process.cwd(), scriptPath);

      if (!fs.existsSync(absoluteScriptPath)) {
         console.error(`[API /api/client-control] Script not found at: ${absoluteScriptPath}`);
         throw new Error(`Script do cliente não encontrado em ${scriptPath}`);
      }

      // Se o processo existe (parado, com erro, etc.), tenta reiniciar.
      // Se não existe ('not_found'), inicia pela primeira vez.
      if (status !== 'not_found') {
        command = `pm2 restart "${simpleProcessName}"`;
        console.log(`[API /api/client-control] Restarting existing process: ${command}`);
      } else {
        // Inicia um novo processo. Usa o tsx como interpreter.
        // Redireciona logs do PM2 para stdout/stderr da instância do Cloud Run
        command = `pm2 start "${scriptPath}" --interpreter "tsx" --name "${simpleProcessName}" && pm2 logs "${simpleProcessName}"`;
        console.log(`[API /api/client-control] Starting new process: ${command}`);
      }

      try {
        const { stdout, stderr } = await execAsync(command);
        console.log(`[API /api/client-control] PM2 Command stdout: ${stdout}`);
        if (stderr) console.warn(`[API /api/client-control] PM2 Command stderr: ${stderr}`);

        const finalStatus = await getProcessStatus(clientId);
        console.log(`[API /api/client-control] Final Status Check for ${processName}: ${finalStatus}`);

        return new Response(JSON.stringify({ success: true, status: finalStatus }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (pm2Error) {
        console.error(`[API /api/client-control] Error executing PM2 command: ${command}`, pm2Error);
        return new Response(
          JSON.stringify({
            error: `Failed to start/restart client ${processName}`,
            details: pm2Error.stderr || pm2Error.stdout || pm2Error.message
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (action === 'stop') {
      // Usa 'status' em vez de 'exists'
      const simpleProcessName = clientId.includes('/') ? clientId.split('/').pop() : clientId;
      if (status !== 'not_found' && status !== 'stopped') { // Só tenta parar se não estiver parado ou não encontrado
        // Usa o nome simples do cliente para parar o processo PM2
        const command = `pm2 stop "${simpleProcessName}"`;
        console.log(`[API /api/client-control] Action Stop - Executing command: ${command}`); // Log comando stop
        try {
          const { stdout, stderr } = await execAsync(command);
          console.log(`[API /api/client-control] Stop Command stdout: ${stdout}`);
          if (stderr) console.warn(`[API /api/client-control] Stop Command stderr: ${stderr}`);
        } catch (stopError) {
          console.error(`[API /api/client-control] Error executing stop command: ${command}`, stopError);
          // Retorna um erro para o frontend saber que falhou
          return new Response(
            JSON.stringify({
              error: `Failed to stop client ${simpleProcessName}`,
              details: stopError.stderr || stopError.stdout || stopError.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log(`[API /api/client-control] Action Stop - Process ${processName} is already stopped or does not exist.`);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (action === 'delete') {
      // Usa 'status' em vez de 'exists'
      console.log(`[API /api/client-control] Action Delete - processName: ${processName}, status: ${status}`); // Log entrando no delete
      if (status !== 'not_found') { // Só tenta deletar se existe na lista do PM2
        // Tenta executar APENAS o delete
        const command = `pm2 delete "${processName}"`;
        console.log(`[API /api/client-control] Executing ONLY Delete Command: ${command}`);
        try {
            const { stdout, stderr } = await execAsync(command);
            console.log(`[API /api/client-control] Delete Command stdout: ${stdout}`);
            if (stderr) console.warn(`[API /api/client-control] Delete Command stderr: ${stderr}`);
        } catch (deleteError) {
             console.error(`[API /api/client-control] Error executing command: ${command}`, deleteError);
             // Retorna erro específico
             return new Response(
               JSON.stringify({
                 error: `Failed to delete client ${processName}`,
                 details: deleteError.stderr || deleteError.stdout || deleteError.message
               }),
               { status: 500, headers: { 'Content-Type': 'application/json' } }
             );
        }
      } else {
          console.log(`[API /api/client-control] Action Delete - Process ${processName} does not exist, skipping delete command.`);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }); // Retorna sucesso mesmo se não existia
    } else {
      console.error(`[API /api/client-control] Invalid action: ${action}`);
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    // Log do erro geral
    console.error('[API /api/client-control] General Error:', error);
    const errorMessage = error.stderr || error.stdout || error.message; // Tenta pegar mais detalhes
    // Corrige o ReferenceError: action pode não estar definida neste escopo
    // Usa clientId na mensagem de erro do catch, pois processName pode não estar definido
    // Usa clientId na mensagem de erro se estiver definido, senão usa mensagem genérica
    const errorClientIdentifier = typeof clientId === 'string' ? clientId : 'unknown client';
    return new Response(
      JSON.stringify({
        error: `Failed operation for client ${errorClientIdentifier}`,
        details: errorMessage
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}