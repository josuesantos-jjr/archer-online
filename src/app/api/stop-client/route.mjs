import { NextResponse } from 'next/server';
import pm2 from 'pm2'; // Importa a biblioteca PM2

// Helper function to connect to PM2
function connectPm2() {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('[API /api/stop-client] Error connecting to PM2:', err);
        return reject(err);
      }
      resolve();
    });
  });
}

// Helper function to disconnect from PM2
function disconnectPm2() {
  pm2.disconnect();
}

export async function POST(request) {
  let processName; // Define processName no escopo mais amplo
  try {
    const { clientId } = await request.json();
    // Extrai o nome do processo do clientId (ex: 'Alpha' de 'clientes/ativos/Alpha')
    processName = clientId.includes('/') ? clientId.split('/').pop() : clientId;

    if (!processName) {
      return NextResponse.json(
        { error: 'Invalid clientId format' },
        { status: 400 }
      );
    }

    console.log(
      `[API /api/stop-client] Attempting to stop process: ${processName}`
    );

    await connectPm2(); // Conecta ao daemon PM2

    // Usa pm2.stop()
    await new Promise((resolve, reject) => {
      pm2.stop(processName, (err, proc) => {
        if (err) {
          // Trata erros comuns como 'process name not found'
          if (err.message && err.message.toLowerCase().includes('not found')) {
            console.warn(
              `[API /api/stop-client] Process ${processName} not found in PM2.`
            );
            // Considera sucesso se o processo já não existe ou já está parado
            return resolve();
          }
          console.error(
            `[API /api/stop-client] Error stopping process ${processName} via PM2 API:`,
            err
          );
          return reject(err);
        }
        console.log(
          `[API /api/stop-client] Process ${processName} stopped successfully via PM2 API.`
        );
        resolve(proc);
      });
    });

    disconnectPm2(); // Desconecta após a operação

    return NextResponse.json({ success: true });
  } catch (error) {
    disconnectPm2(); // Garante a desconexão em caso de erro
    console.error(
      `[API /api/stop-client] General Error stopping ${processName || 'unknown client'}:`,
      error
    );
    return NextResponse.json(
      {
        error: `Failed to stop client ${processName || 'unknown'}`,
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
