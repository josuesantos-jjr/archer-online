import { NextResponse } from 'next/server';
import { getPm2ProcessLogs } from '@/lib/pm2Wrapper';

export async function GET(request, { params }) {
  try {
    const paramsAwaited = await params;
    const { processName } = paramsAwaited;

    if (!processName) {
      return NextResponse.json(
        { error: 'Nome do processo é obrigatório' },
        { status: 400 }
      );
    }

    const { stdout, error } = await getPm2ProcessLogs(processName);

    if (error) {
      return NextResponse.json(
        { error: `Erro ao buscar logs: ${error}` },
        { status: 500 }
      );
    }

    const logs = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => ({
        timestamp: new Date().toISOString(),
        message: line,
        level: line.toLowerCase().includes('error') ? 'error' : 'info',
        processName,
      }));

    return NextResponse.json({
      success: true,
      processName,
      logs,
      total: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao buscar logs do PM2:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar logs do processo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const paramsAwaited = await params;
    const { processName } = paramsAwaited;

    if (!processName) {
      return NextResponse.json(
        { error: 'Nome do processo é obrigatório' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Logs limpos com sucesso',
      processName,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao limpar logs:', error);
    return NextResponse.json(
      { error: 'Erro ao limpar logs do processo' },
      { status: 500 }
    );
  }
}
