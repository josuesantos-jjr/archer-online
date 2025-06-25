export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import {
  buscarRelatorios,
  gerarEstatisticas,
} from '../../../backend/relatorio/registroDisparo';

function buscarLeadsEFollowUp(clientePath) {
  const leadsPath = path.join(clientePath, 'listas', 'download');
  const followupPath = path.join(clientePath, 'listas', 'followup');

  let leads = [];
  let followup = [];

  // Buscar leads
  if (fs.existsSync(leadsPath)) {
    const arquivos = fs
      .readdirSync(leadsPath)
      .filter((f) => f.endsWith('.json'));
    arquivos.forEach((arquivo) => {
      const conteudo = fs.readFileSync(path.join(leadsPath, arquivo), 'utf8');
      leads = leads.concat(JSON.parse(conteudo));
    });
  }

  // Buscar followup
  if (fs.existsSync(followupPath)) {
    const arquivos = fs
      .readdirSync(followupPath)
      .filter((f) => f.endsWith('.json'));
    arquivos.forEach((arquivo) => {
      const conteudo = fs.readFileSync(
        path.join(followupPath, arquivo),
        'utf8'
      );
      followup = followup.concat(JSON.parse(conteudo));
    });
  }

  return {
    totalLeads: leads.length,
    leadsEmFollowUp: followup.length,
    leads,
    followup,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    if (!clientId) {
      return NextResponse.json(
        { error: 'ClientId é obrigatório' },
        { status: 400 }
      );
    }

    const [type, name] = clientId.split('/');
    const clientePath = path.join(process.cwd(), 'clientes', type, name);

    const relatorios = buscarRelatorios(clientePath, dataInicio, dataFim);
    const estatisticas = gerarEstatisticas(relatorios);
    const dadosLeads = buscarLeadsEFollowUp(clientePath);

    return NextResponse.json({
      relatorios,
      estatisticas,
      leads: {
        total: dadosLeads.totalLeads,
        emFollowUp: dadosLeads.leadsEmFollowUp,
        detalhes: {
          leads: dadosLeads.leads,
          followup: dadosLeads.followup,
        },
      },
    });
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar relatórios' },
      { status: 500 }
    );
  }
}
