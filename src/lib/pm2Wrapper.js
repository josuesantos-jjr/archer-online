import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function getPm2ProcessStatus(processName) {
  try {
    const { stdout } = await execPromise('pm2 jlist');
    
    // Encontra o início do JSON (primeiro '[' ou '{')
    // Encontra o início do JSON (primeiro '[' ou '{')
    // Usa uma regex para encontrar o primeiro JSON válido na string
    const jsonMatch = stdout.match(/(\[.*\]|\{.*\})/s);
    
    if (!jsonMatch || !jsonMatch[0]) {
      console.error('Saída do PM2 não contém JSON válido:', stdout);
      throw new Error('Formato de saída do PM2 inválido: JSON não encontrado.');
    }

    // Extrai apenas a parte JSON da saída
    const jsonString = jsonMatch[0];
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
    // Retorna o stderr para mais detalhes sobre o erro do comando pm2 logs
    return { error: error.message, stderr: error.stderr || '' };
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
