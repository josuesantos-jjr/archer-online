export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('pm2 jlist');

    // Divide a saída em linhas e encontra a linha que parece conter o JSON (o array de processos)
    const lines = stdout.split('\n');
    let jsonLine = '';
    // Procura pela última linha que contém '[' e ']' (provavelmente o array JSON)
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('[') && lines[i].trim().endsWith(']')) {
            jsonLine = lines[i].trim();
            break;
        }
    }

    let processes = [];
    if (jsonLine) {
        try {
            processes = JSON.parse(jsonLine);
        } catch (parseError) {
            console.error('[API /api/pm2-status] Failed to parse JSON line:', jsonLine, parseError);
            // Se falhar ao parsear a linha encontrada, retorna array vazio e loga o erro
            return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
        }
    } else {
        console.warn('[API /api/pm2-status] Could not find JSON line in pm2 jlist output.');
        // Se não encontrar a linha JSON, retorna array vazio
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    }

    const formattedProcesses = processes.map(process => ({
      name: process.name,
      pm_id: process.pm_id, // Adiciona pm_id
      status: process.pm2_env?.status || 'unknown',
      cpu: process.monit?.cpu || 0,
      memory: process.monit?.memory || 0,
      uptime: process.pm2_env?.pm_uptime ? Date.now() - process.pm2_env.pm_uptime : 0,
      script: process.pm2_env?.script || 'N/A' // Adiciona caminho do script
    }));

    return new Response(JSON.stringify(formattedProcesses), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    // Se o comando pm2 falhar (ex: não instalado, não rodando), retorna array vazio ou erro específico
    console.error('Error getting PM2 processes:', error.stderr || error.message);
    // Retorna 200 com array vazio para não quebrar o frontend, mas loga o erro no servidor
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    // Alternativa: retornar um erro específico que o frontend possa tratar
    // return NextResponse.json({ error: 'Failed to get PM2 processes', details: error.message }, { status: 500 });
  }
}