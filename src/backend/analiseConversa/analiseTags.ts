// src/backend/analiseConversa/analiseTags.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
// Logger será passado como parâmetro

// --- Configuração Gemini Removida ---

const generationConfig = {
  temperature: 0.3,
  maxOutputTokens: 200,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

const promptAnaliseTags = `
Analise o histórico da conversa fornecido e extraia tags relevantes que descrevam o contato, seus interesses, situação financeira, posses, ou qualquer outra característica mencionada.
Responda APENAS com um array JSON de strings contendo as tags identificadas. Use letras minúsculas e hífen para separar palavras (kebab-case). Seja conciso e relevante.
Exemplos de tags: "carro-novo", "alto-padrao", "poder-compra-alto", "possui-gato", "baixo-padrao", "apartamento-pequeno", "possui-pet", "interesse-futuro-6-meses", "ja-possui-produto", "busca-desconto", "marcar-reuniao", "problema-tecnico-x".

Histórico da Conversa:
"""
{conversation_history}
"""

Array JSON de Tags:`;

/**
 * Analisa a conversa para extrair tags relevantes.
 * @param conversationHistory - String contendo o histórico formatado da conversa.
 * @param geminiKey - A chave da API Gemini específica do cliente.
 * @param logger - A instância do logger específica do cliente.
 * @returns {Promise<string[]>} - Um array de strings contendo as tags identificadas.
 */
export async function analisarTags(
  conversationHistory: string,
  geminiKey: string,
  logger: any // Idealmente, usar um tipo mais específico para o logger
): Promise<string[]> {
  logger.info('[Analise Tags] Iniciando análise de tags...');

  let model: GenerativeModel | null = null;
  try {
    if (!geminiKey) {
      logger.warn(
        '[Analise Tags] Chave Gemini não fornecida. Análise de tags pode falhar.'
      );
    }
    const genAI = new GoogleGenerativeAI(geminiKey || ''); // Usa a chave fornecida
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  } catch (e) {
    logger.error('[Analise Tags] Falha ao inicializar o modelo Gemini:', e);
    return []; // Retorna array vazio se modelo falhou
  }

  if (!model) {
    // Verificação adicional
    logger.error(
      '[Analise Tags] Modelo Gemini não inicializado após tentativa. Análise cancelada.'
    );
    return [];
  }

  if (!conversationHistory || conversationHistory.trim().length === 0) {
    logger.warn(
      '[Analise Tags] Histórico de conversa vazio. Retornando array vazio.'
    );
    return [];
  }

  try {
    const fullPrompt = promptAnaliseTags.replace(
      '{conversation_history}',
      conversationHistory
    );
    const chat = model.startChat({ generationConfig, safetySettings });
    const result = await chat.sendMessage(fullPrompt);
    const responseText = result.response.text().trim();

    logger.info(`[Analise Tags] Resposta da IA (tags): ${responseText}`);

    try {
      // Limpa possíveis ```json ... ```
      const cleanedJsonResponse = responseText.replace(/^```json\s*|```$/g, '');
      const tagsArray = JSON.parse(cleanedJsonResponse);
      if (
        Array.isArray(tagsArray) &&
        tagsArray.every((tag) => typeof tag === 'string')
      ) {
        // Converte para minúsculas e kebab-case (embora o prompt já peça)
        const formattedTags = tagsArray.map((tag) =>
          tag.toLowerCase().replace(/\s+/g, '-')
        );
        logger.info(
          `[Analise Tags] Tags formatadas: ${formattedTags.join(', ')}`
        );
        return formattedTags;
      } else {
        logger.warn(
          `[Analise Tags] Resposta da IA não é um array de strings válido: "${responseText}". Retornando array vazio.`
        );
        return [];
      }
    } catch (parseError) {
      logger.error(
        `[Analise Tags] Erro ao parsear JSON de tags da IA: ${parseError}. Resposta recebida: ${responseText}`
      );
      return [];
    }
  } catch (error) {
    logger.error('[Analise Tags] Erro ao analisar tags com IA:', error);
    return []; // Retorna array vazio em caso de erro na IA
  }
}
