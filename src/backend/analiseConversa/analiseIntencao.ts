// src/backend/analiseConversa/analiseIntencao.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
// Logger será passado como parâmetro

// --- Configuração Gemini Removida ---

const generationConfig = {
  temperature: 0.2,
  maxOutputTokens: 50,
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

const promptAnaliseIntencao = `
Analise o histórico da conversa fornecido e identifique a principal intenção do contato (User).
Responda APENAS com uma das seguintes categorias de intenção:
- INTERESSE_FUTURO (Ex: "Vou precisar daqui 6 meses", "Me procure no fim do ano")
- SEM_INTERESSE (Ex: "Já tenho", "Não preciso", "Não quero")
- PEDIDO_INFORMACAO (Ex: "Quanto custa?", "Como funciona?", "Me envie mais detalhes")
- PEDIDO_SUPORTE (Ex: "Não está funcionando", "Preciso de ajuda com X")
- NEGOCIACAO (Ex: "Tem desconto?", "Consegue fazer por X?", "Qual o melhor preço?")
- AGENDAMENTO (Ex: "Podemos marcar uma reunião?", "Qual horário disponível?")
- RECLAMACAO (Ex: "Não gostei", "Serviço ruim", "Demorou muito")
- OUTRO (Se nenhuma das anteriores se encaixar claramente)
- INDETERMINADO (Se a conversa for muito curta ou não houver mensagens do User)

Histórico da Conversa:
"""
{conversation_history}
"""

Intenção:`;

/**
 * Analisa a conversa para identificar a intenção do contato.
 * @param conversationHistory - String contendo o histórico formatado da conversa.
 * @param geminiKey - A chave da API Gemini específica do cliente.
 * @param logger - A instância do logger específica do cliente.
 * @returns {Promise<string>} - A categoria de intenção identificada.
 */
export async function analisarIntencao(
  conversationHistory: string,
  geminiKey: string,
  logger: any // Idealmente, usar um tipo mais específico para o logger
): Promise<string> {
  logger.info('[Analise Intencao] Iniciando análise de intenção...');

  let model: GenerativeModel | null = null;
  try {
    if (!geminiKey) {
      logger.warn(
        '[Analise Intencao] Chave Gemini não fornecida. Análise de intenção pode falhar.'
      );
      // Considerar retornar erro ou usar uma chave padrão segura, se aplicável
    }
    const genAI = new GoogleGenerativeAI(geminiKey || ''); // Usa a chave fornecida
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  } catch (e) {
    logger.error('[Analise Intencao] Falha ao inicializar o modelo Gemini:', e);
    return 'ERRO_ANALISE_MODELO'; // Retorna erro se não puder inicializar
  }

  if (!model) {
    // Verificação adicional, embora o catch acima deva cobrir
    logger.error(
      '[Analise Intencao] Modelo Gemini não inicializado após tentativa. Análise cancelada.'
    );
    return 'ERRO_ANALISE_MODELO';
  }

  if (!conversationHistory || conversationHistory.trim().length === 0) {
    logger.warn(
      '[Analise Intencao] Histórico de conversa vazio. Retornando INDETERMINADO.'
    );
    return 'INDETERMINADO';
  }

  try {
    const fullPrompt = promptAnaliseIntencao.replace(
      '{conversation_history}',
      conversationHistory
    );
    const chat = model.startChat({ generationConfig, safetySettings });
    const result = await chat.sendMessage(fullPrompt);
    const responseText = result.response.text().trim().toUpperCase();

    logger.info(
      `[Analise Intencao] Intenção identificada pela IA: ${responseText}`
    );

    const categoriasValidas = [
      'INTERESSE_FUTURO',
      'SEM_INTERESSE',
      'PEDIDO_INFORMACAO',
      'PEDIDO_SUPORTE',
      'NEGOCIACAO',
      'AGENDAMENTO',
      'RECLAMACAO',
      'OUTRO',
      'INDETERMINADO',
    ];
    if (categoriasValidas.includes(responseText)) {
      return responseText;
    } else {
      logger.warn(
        `[Analise Intencao] Resposta da IA não corresponde a uma categoria válida: "${responseText}". Retornando OUTRO.`
      );
      return 'OUTRO';
    }
  } catch (error) {
    logger.error('[Analise Intencao] Erro ao analisar intenção com IA:', error);
    return 'ERRO_ANALISE_IA';
  }
}
