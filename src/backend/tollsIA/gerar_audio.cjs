const { ElevenLabsClient } = require('elevenlabs');
const fs = require('fs');
const path = require('path');

async function generateAudio(clientePath) { // Recebe o caminho do cliente como argumento
  // Carregar elevenLabsApiKey de infoCliente.json
  let elevenLabsApiKey = '';
  try {
      const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
      const infoConfig = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      elevenLabsApiKey = infoConfig.ELEVENLABS_API_KEY || '';
      if (!elevenLabsApiKey) {
          console.warn(`Chave ELEVENLABS_API_KEY não encontrada em infoCliente.json de ${clientePath}. Geração de áudio não pode prosseguir.`);
          return "Erro: Chave da API Eleven Labs não configurada.";
      }
  } catch (error) {
      console.error(`Erro ao ler infoCliente.json para chave Eleven Labs em ${clientePath}: ${error}`);
      return "Erro ao ler configuração da API Eleven Labs.";
  }

  const elevenlabs = new ElevenLabsClient({
    apiKey: elevenLabsApiKey,
  });

  try {
    // Read transcription text from JSON file
    // O caminho do arquivo de transcrição pode precisar ser ajustado dependendo de onde ele é gerado/armazenado
    // Por enquanto, mantemos o caminho original, mas esteja ciente que pode precisar de ajuste
    const transcriptionFilePath = path.join(__dirname, 'transcricao.json');
    let textToSpeak;
    try {
        const transcriptionJson = fs.readFileSync(transcriptionFilePath, 'utf8');
        textToSpeak = JSON.parse(transcriptionJson); // The JSON content is already a single string
    } catch (readError) {
        console.error(`Erro ao ler o arquivo de transcrição em ${transcriptionFilePath}: ${readError.message}`);
        return `Erro ao ler o arquivo de transcrição: ${readError.message}`;
    }

    if (!textToSpeak || typeof textToSpeak !== 'string') {
      console.error('Conteúdo inválido no arquivo de transcrição. Esperado uma string.');
      process.exit(1);
    }

    console.log('Gerando áudio com Eleven Labs...');

    // Generate audio using Eleven Labs API with the provided voice ID
    const audio = await elevenlabs.textToSpeech.convert("9BWtsMINqrJLrRacOk9x", { // Use Voice ID for Aria
      output_format: "mp3_44100_128",
      text: textToSpeak,
      model_id: "eleven_multilingual_v2", // Using a multilingual model
      voice_settings: {
        stability: 0.01, // Adjusted stability to a common range
        similarity_boost: 0.9, // Adjusted similarity_boost to a common range
        style: 1, // Adjusted style to a common range
        use_speaker_boost: true, // Kept use_speaker_boost
        speed: 1.2,
        // Removed speed parameter as it might not be supported here
      },
    });

    // Save the audio to a file
    const outputAudioPath = path.join(__dirname, 'audio_gerado.mp3');
    const fileStream = fs.createWriteStream(outputAudioPath);

    // Save the audio (ReadableStream) to a file by piping it to a Node.js WritableStream
    const { Readable } = require('stream'); // Import Readable from 'stream' module
    // const { Readable: ReadableWebToNode } = require('stream/web'); // Import Readable from 'stream/web' for conversion - this import is not needed here

    // Convert the Web ReadableStream to a Node.js ReadableStream and then pipe
    Readable.fromWeb(audio).pipe(fileStream);

    fileStream.on('finish', () => {
      console.log(`Áudio gerado e salvo em ${outputAudioPath}`);
    });

    fileStream.on('error', (error) => {
      console.error(`Erro ao salvar o arquivo de áudio: ${error.message}`);
    });

  } catch (error) {
    console.error('Erro ao gerar o áudio:', error);
  }
}

generateAudio();