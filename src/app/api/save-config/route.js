import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { clientId, config } = await request.json();

    if (!clientId || !config) {
      return NextResponse.json(
        { error: 'ClientId e configuração são obrigatórios' },
        { status: 400 }
      );
    }

    // Validação básica da configuração
    const requiredFields = ['nome', 'status', 'configuracoes'];
    for (const field of requiredFields) {
      if (!config[field]) {
        return NextResponse.json(
          { error: `Campo ${field} é obrigatório na configuração` },
          { status: 400 }
        );
      }
    }

    // Validação das configurações específicas
    const { configuracoes } = config;
    if (!configuracoes.mensagens || !configuracoes.horarios) {
      return NextResponse.json(
        { error: 'Configurações de mensagens e horários são obrigatórias' },
        { status: 400 }
      );
    }

    // Simula salvamento da configuração
    const savedConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      version: (config.version || 0) + 1,
    };

    return NextResponse.json({
      success: true,
      config: savedConfig,
      message: 'Configuração salva com sucesso',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao salvar configuração do cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configuração' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'ClientId é obrigatório' },
        { status: 400 }
      );
    }

    // Simula busca da configuração
    const config = {
      nome: 'Cliente Exemplo',
      status: 'ativo',
      version: 1,
      configuracoes: {
        mensagens: {
          boasVindas: 'Olá! Como posso ajudar?',
          despedida: 'Obrigado pelo contato!',
          fallback: 'Não entendi sua mensagem',
        },
        horarios: {
          inicio: '08:00',
          fim: '18:00',
          diasSemana: ['1', '2', '3', '4', '5'],
        },
        limites: {
          mensagensPorDia: 1000,
          contatosPorDia: 200,
          intervaloMensagens: 5,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    return NextResponse.json({
      success: true,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao buscar configuração do cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configuração' },
      { status: 500 }
    );
  }
}
