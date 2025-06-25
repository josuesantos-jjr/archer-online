import fs from 'fs';
import path from 'path';
const pastaRaiz = process.cwd(); // Define pasta raiz como o diretório atual do processo.

function listarPastas(pastaRaiz: string) {
  let pastas = '';

  try {
    const caminhoCompleto = path.join(pastaRaiz, 'clientes', 'ativos'); // Constrói o caminho completo

    // Verifica se o caminho existe e é um diretório
    if (
      fs.existsSync(caminhoCompleto) &&
      fs.lstatSync(caminhoCompleto).isDirectory()
    ) {
      const arquivos = fs.readdirSync(caminhoCompleto);
      arquivos.forEach((arquivo: string) => {
        const caminhoArquivo = path.join(caminhoCompleto, arquivo);
        if (fs.lstatSync(caminhoArquivo).isDirectory()) {
          pastas += arquivo + '\n';
        }
      });
    } else {
      console.error('O caminho especificado não existe ou não é um diretório.');
    }
  } catch (err) {
    console.error('Erro ao ler as pastas:', err);
    return 'Erro ao listar as pastas.'; // Retorna uma mensagem de erro em caso de falha
  }

  console.log(pastas);
  return pastas;
}

// Exemplo de uso (substitua pelo caminho da sua pasta raiz)
listarPastas(pastaRaiz);

export { listarPastas }; // Exporta a função listarPastas
