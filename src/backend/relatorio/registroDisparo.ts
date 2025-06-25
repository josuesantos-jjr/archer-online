import fs from 'node:fs';
import path from 'node:path';

interface DisparoRegistro {
  data: string;
  numeroTelefone: string;
  status: boolean;
  etapaAquecimento: number;
  quantidadeDisparada: number;
  limiteDiario: number;
}

export const registrarDisparo = (clientePath: string, registro: DisparoRegistro) => {
  const today = new Date().toISOString().split('T')[0];
  const relatorioPath = path.join(clientePath, 'relatorios');
  const relatorioFile = path.join(relatorioPath, `${today}.json`);

  // Criar diretório de relatórios se não existir
  if (!fs.existsSync(relatorioPath)) {
    fs.mkdirSync(relatorioPath, { recursive: true });
  }

  // Ler registros existentes ou criar array vazio
  let registros: DisparoRegistro[] = [];
  if (fs.existsSync(relatorioFile)) {
    const data = fs.readFileSync(relatorioFile, 'utf8');
    registros = JSON.parse(data);
  }

  // Adicionar novo registro
  registros.push(registro);

  // Salvar arquivo atualizado
  fs.writeFileSync(relatorioFile, JSON.stringify(registros, null, 2));
};

export const buscarRelatorios = (clientePath: string, dataInicio?: string, dataFim?: string) => {
  const relatorioPath = path.join(clientePath, 'relatorios');
  
  if (!fs.existsSync(relatorioPath)) {
    return [];
  }

  const arquivos = fs.readdirSync(relatorioPath)
    .filter(arquivo => arquivo.endsWith('.json'));

  let todosRegistros: Array<DisparoRegistro & { data: string }> = [];

  arquivos.forEach(arquivo => {
    const data = arquivo.replace('.json', '');
    
    // Filtrar por intervalo de datas se especificado
    if (dataInicio && data < dataInicio) return;
    if (dataFim && data > dataFim) return;

    const conteudo = fs.readFileSync(path.join(relatorioPath, arquivo), 'utf8');
    const registros: DisparoRegistro[] = JSON.parse(conteudo);
    
    todosRegistros = todosRegistros.concat(registros);
  });

  return todosRegistros;
};

export const gerarEstatisticas = (registros: DisparoRegistro[]) => {
  return {
    totalDisparos: registros.length,
    disparosSucesso: registros.filter(r => r.status).length,
    disparosFalha: registros.filter(r => !r.status).length,
    mediaDisparosDiarios: registros.length / new Set(registros.map(r => r.data.split('T')[0])).size,
    etapaAquecimentoAtual: registros[registros.length - 1]?.etapaAquecimento || 0
  };
};