import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function getPm2ProcessStatus(processName) {
  try {
    const { stdout } = await execPromise('pm2 jlist');
    
    // Encontra o início do JSON (primeiro '[' ou '{')
    const jsonStart = stdout.indexOf('[') !== -1 
      ? stdout.indexOf('[') 
      : stdout.indexOf('{');
    
    if (jsonStart === -1) {
      throw new Error('Formato de saída do PM2 inválido');
    }

    // Extrai apenas a parte JSON da saída
    const jsonString = stdout.substring(jsonStart);
    const processes = JSON.parse(jsonString);

    if (processName) {
      return processes.find((p) => p.name === processName) || null;
    }

    return processes;
  } catch (error) {
    console.error('Erro ao buscar status do PM2:', error);
    return { error: error.message };
  }
}

export async function getPm2ProcessLogs(processName) {
  try {
    const { stdout, stderr } = await execPromise(
      `pm2 logs ${processName}`
    );

    return { stdout, stderr };
  } catch (error) {
    console.error('Erro ao buscar logs do PM2:', error);
    return { error: error.message };
  }
}

export async function restartPm2Process(processName) {
  try {
    await execPromise(`pm2 restart ${processName}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao reiniciar processo:', error);
    return { error: error.message };
  }
}

export async function stopPm2Process(processName) {
  try {
    await execPromise(`pm2 stop ${processName}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao parar processo:', error);
    return { error: error.message };
  }
}

export async function startPm2Process(processName) {
  try {
    await execPromise(`pm2 start ${processName}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao iniciar processo:', error);
    return { error: error.message };
  }
}
