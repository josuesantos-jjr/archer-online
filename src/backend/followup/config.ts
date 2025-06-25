// src/backend/followup/config.ts
import fs from 'fs/promises';
import path from 'path';

// Define a interface para a estrutura da configuração
export interface FollowUpConfig {
  ativo: boolean;
  niveis: number; // 1 a 5
  promptGeral: boolean; // true para geral, false para individual
  prompt: string; // Prompt geral
  promptsPorNivel: string[]; // Array de prompts individuais [nivel1, nivel2, ...]
  intervalosDias: number[]; // Array de dias para cada nível [nivel1, nivel2, ...]
  recorrencia: boolean;
  diasRecorrencia: number;
  promptAnalise?: string; // Prompt para a IA decidir se inicia o follow-up
  // Novos campos para mídia por nível
  midiaPorNivel?: {
    ativado: boolean;
    arquivos: string[]; // Caminhos relativos dos arquivos de mídia
    tipos: ('image' | 'audio' | 'video' | 'document')[]; // Tipos de mídia correspondentes
  }[];
}

// Define a configuração padrão
export const defaultConfig: FollowUpConfig = {
  ativo: false,
  niveis: 5,
  promptGeral: true,
  prompt:
    'Gere uma mensagem de follow-up amigável para reengajar este contato.',
  promptsPorNivel: ['', '', '', '', ''],
  intervalosDias: [1, 3, 7, 15, 30], // Exemplo de intervalos
  recorrencia: false,
  diasRecorrencia: 30,
  promptAnalise:
    "Analise a conversa a seguir e determine se um follow-up seria apropriado. Responda apenas com 'SIM' ou 'NAO'.\n\nConversa:\n{conversationHistory}",
  midiaPorNivel: Array(5).fill({ ativado: false, arquivos: [], tipos: [] }), // Inicializa com 5 níveis padrão
};

/**
 * Obtém o caminho completo para o arquivo de configuração de follow-up do cliente.
 * @param clientePath - O caminho base da pasta do cliente (ex: 'clientes/ativos/Alpha').
 * @returns O caminho completo para followupConfig.json.
 */
function getConfigPath(clientePath: string): string {
  return path.join(clientePath, 'config', 'followupConfig.json');
}

/**
 * Carrega a configuração de follow-up do arquivo JSON.
 * Se o arquivo não existir, cria um com os valores padrão.
 * @param clientePath - O caminho base da pasta do cliente.
 * @returns A configuração de follow-up.
 */
export async function getFollowUpConfig(
  clientePath: string
): Promise<FollowUpConfig> {
  const configPath = getConfigPath(clientePath);
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data) as FollowUpConfig;
    // Garante que todos os campos do defaultConfig existam no config carregado
    return { ...defaultConfig, ...config };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(
        `Arquivo followupConfig.json não encontrado para ${clientePath}. Criando com valores padrão.`
      );
      // Cria a pasta config se não existir
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      // Salva o arquivo padrão
      await saveFollowUpConfig(clientePath, defaultConfig);
      return defaultConfig;
    } else {
      console.error(
        `Erro ao ler followupConfig.json para ${clientePath}:`,
        error
      );
      throw error; // Re-lança outros erros
    }
  }
}

/**
 * Salva a configuração de follow-up no arquivo JSON.
 * @param clientePath - O caminho base da pasta do cliente.
 * @param configData - O objeto de configuração a ser salvo.
 */
export async function saveFollowUpConfig(
  clientePath: string,
  configData: FollowUpConfig
): Promise<void> {
  const configPath = getConfigPath(clientePath);
  try {
    // Cria a pasta config se não existir
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const data = JSON.stringify(configData, null, 2); // Formata com indentação
    await fs.writeFile(configPath, data, 'utf-8');
    console.log(`Configuração de follow-up salva em ${configPath}`);
  } catch (error) {
    console.error(
      `Erro ao salvar followupConfig.json para ${clientePath}:`,
      error
    );
    throw error; // Re-lança o erro
  }
}
