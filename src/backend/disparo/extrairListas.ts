import * as path from 'node:path';
import * as fs from 'node:fs';
import * as csv from 'csv-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';


async function extrairDadosDaTabela(url: string) {
  // Aguarda 5 segundos antes de fazer a requisição
  await new Promise(resolve => setTimeout(resolve, 1000));

  const resposta = await axios.get(url);
  const $ = cheerio.load(resposta.data);

  const tabela = $('table');
  const linhas = tabela.find('tr');

  // Extrair os dados das linhas subsequentes
  const dados: { Telefone: string, Nome: string }[] = [];
  await new Promise(resolve => setTimeout(resolve, 5000));
  linhas.slice(1).each((_, linha) => {
    const celulas = $(linha).find('td');
    
    if (celulas.length >= 1) {
       // Verifica se a linha tem pelo menos duas células
      dados.push({
        Telefone: $(celulas[0]).text().trim(),
        Nome: $(celulas[1]).text().trim(),
      });
      
    }
  });

  return dados;
}

export async function extrairListas(arquivoListas: string, clientePath: string): Promise<Array<{ nome: string, telefones: string[] }>> {
  const listasProcessadas: Array<{ nome: string, telefones: string[] }> = [];
  try {
    // Lendo o arquivo .listas
    const listas = await new Promise<string[][]>((resolve, reject) => {
      const linhas: string[][] = [];
      fs.createReadStream(arquivoListas)
        .pipe(csv.default()) // Acessando a função default
        .on('data', (row) => linhas.push(Object.values(row)))
        .on('end', () => resolve(linhas))
        .on('error', (error) => reject(error));
    });

    console.log(`Linhas extraídas do arquivo ${arquivoListas}:`);
    console.log(listas);

    // Processando cada lista
    for (const lista of listas) {
      try {
        // Extraindo o nome da lista e o link
        const nomeLista = lista[0].split('=')[0].trim();
        const link = lista[0].split('=')[1].trim();

        console.log(`Processando lista: ${nomeLista}`);

        // Extraindo dados da tabela da página web
        const dadosTabela = await extrairDadosDaTabela(link);
        console.log("Extracted data:", dadosTabela); // Log the extracted data
      
        console.log(`Dados da tabela processados:`);
        console.log(dadosTabela);

        // Salvar JSON na pasta "listas/disparar"
        const caminhoJSON = path.join(
          clientePath, 'config', 'listas','download',`${nomeLista}.json`);
        
        // Criar o diretório "listas/disparar" se ele não existir
        const diretorioListas = path.join(clientePath, 'config', 'listas', 'download');
        if (!fs.existsSync(diretorioListas)) {
          fs.mkdirSync(diretorioListas, { recursive: true });
        } 

        // Salvar o arquivo JSON
        await fs.promises.writeFile(
          caminhoJSON,
          JSON.stringify(dadosTabela, null, 2)
        );
  
        console.log(`JSON da lista ${nomeLista} salvo em ${caminhoJSON}.`);
  
        // Encontrar telefones únicos
        const telefonesUnicos = new Set<string>();
        dadosTabela.forEach(item => {
          if (item["Telefone"]) { // Assumindo que a chave para telefone ���� \"Telefone\
            telefonesUnicos.add(item["Telefone"]); // Adicionando o telefone ao Set
          }
        });

        listasProcessadas.push({
          nome: nomeLista,
          telefones: Array.from(telefonesUnicos), // Converter Set para Array
        });
      } catch (error) {
        console.error(`Erro ao processar a lista ${lista[0]}:`,);
      }
    }
  } catch (error) {
    console.error('Erro ao extrair listas:', error);
    throw error; // Propaga o erro para cima
  }
  return listasProcessadas; // Retorna o array com as listas processadas
}

// Função para exportar os comandos
export async function executarExtracao(arquivoListas: string, clientePath: string) {
  await extrairListas(arquivoListas, clientePath);
}