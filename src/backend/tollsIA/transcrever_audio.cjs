const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');


// Helper function to read a file and convert it to a GoogleGenerativeAI.Part
function fileToGenerativePart(filePath, mimeType) {
  try {
    const fileData = fs.readFileSync(filePath);
    return {
      inlineData: {
        data: Buffer.from(fileData).toString('base64'),
        mimeType,
      },
    };
  } catch (error) {
    console.error(`Erro ao ler o arquivo ${filePath}:`, error);
    throw error; // Re-throw the error to be caught by the main function
  }
}

// Remove 'export' da definição da função
async function transcribeAudio(audioPath, clientePath) { // Recebe o caminho do áudio e o caminho do cliente como argumento
  // Carregar geminiApiKey de infoCliente.json
  let apiKey = '';
  try {
      const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
      const infoConfig = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      apiKey = infoConfig.GEMINI_KEY_BG || infoConfig.GEMINI_KEY || ''; // Prioriza GEMINI_KEY_BG, fallback para GEMINI_KEY
      if (!apiKey) {
          console.warn(`Chave GEMINI_KEY_BG ou GEMINI_KEY não encontrada em infoCliente.json de ${clientePath}. Transcrição não pode prosseguir.`);
          return "Erro: Chave da API Gemini não configurada.";
      }
  } catch (error) {
      console.error(`Erro ao ler infoCliente.json para chave Gemini em ${clientePath}: ${error}`);
      return "Erro ao ler configuração da API Gemini.";
  }

  // Inicializa genAI com a chave encontrada
  const genAI = new GoogleGenerativeAI(apiKey);

  // Verifica se genAI foi inicializado (se a chave API foi encontrada)
  // Esta verificação agora é redundante após a lógica acima, mas mantida por segurança
  if (!genAI) {
    console.error('API Key do Gemini não configurada após leitura de infoCliente.json. Transcrição não pode ser realizada.');
    return "Erro: API Key não configurada.";
  }

  try {
    // Verifica se o arquivo de áudio existe
    if (!fs.existsSync(audioPath)) {
        console.error(`Arquivo de áudio não encontrado em: ${audioPath}`);
        return `Erro: Arquivo de áudio não encontrado em ${audioPath}`;
    }

    // Usa o modelo apropriado para áudio (gemini-1.5-flash ou outro)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Modelo recomendado para áudio

    // Determina o mimeType com base na extensão do arquivo
    const ext = path.extname(audioPath).toLowerCase();
    let mimeType;
    if (ext === '.mp3') {
        mimeType = 'audio/mp3';
    } else if (ext === '.wav') {
        mimeType = 'audio/wav';
    } else if (ext === '.ogg' || ext === '.opus') {
        mimeType = 'audio/ogg'; // Gemini pode suportar ogg/opus
    } else {
        console.error(`Formato de áudio não suportado: ${ext}`);
        return `Erro: Formato de áudio não suportado (${ext})`;
    }

    const audioFile = fileToGenerativePart(audioPath, mimeType);

    console.log(`Enviando áudio (${mimeType}) de ${audioPath} para transcrição...`);
    // Envia um prompt de texto e o arquivo de áudio para o modelo
    const result = await model.generateContent(['Transcreva o seguinte áudio:', audioFile]);
    const response = await result.response;
    const text = response.text();

    console.log('Transcrição do áudio recebida.');
    // console.log(text); // Log da transcrição completa (opcional)

    // Não salva mais a transcrição em um arquivo JSON aqui, apenas retorna o texto
    // const outputFilePath = path.join(__dirname, 'transcricao.json');
    // fs.writeFileSync(outputFilePath, JSON.stringify(text, null, 2), 'utf8');
    // console.log(`Transcrição salva em ${outputFilePath}`);

    return text; // Retorna a string da transcrição

  } catch (error) {
    console.error('Erro ao transcrever o áudio:', error);
    // Retorna uma string indicando o erro para quem chamou a função
    return `Erro ao transcrever áudio: ${error.message}`;
  }
}

// Exporta a função usando CommonJS
module.exports = transcribeAudio;

// A chamada direta foi removida, pois a função será chamada pelo index.ts
// transcribeAudio();
