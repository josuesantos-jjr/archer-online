import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv'; // Importar dotenv
// import { relatorios } from '../relatorio/relatorios.ts'; // Removido import antigo
import { format, getDay, isSameDay } from 'date-fns';
import { registrarDisparo } from '../relatorio/registroDisparo.ts';
// Importa as funções de relatório
import { criarEnviarRelatorioDiario } from '../relatorio/relatorioDiario.ts';
import { criarEnviarRelatorioLista } from '../relatorio/relatorioLista.ts'; // Importa a nova função
import { sendImage, sendPtt, sendVideo, sendFile } from './enviarMidia.ts'; // Importa as funções de envio de mídia
import { updateLastSentMessageDate } from '../util/chatDataUtils.ts'; // Importa a nova função
import { disparoAgendados } from './disparoAgendados.ts'; // Importa a função de disparo agendado

const MENSAGEM_PADRAO = 'Olá {nome}, tudo bem?'; // Garantir que está definida

// Função para extrair um valor numérico de uma string
const extrairValorNumerico = (texto: string): number => {
  const numeros = texto.match(/\d+/g);
  return numeros ? parseInt(numeros[0]) : 0;
};

// Função para salvar mensagens em um arquivo (mantida como estava)
export function saveMessageToFile(client: string, clientePath: string, chatId: string, message: string, type: `User` | `IA`, contato?: any, listaNome?: string) {
  const chatDir = path.join( clientePath, `Chats`, `Historico`, chatId);
  const fileName = `${chatId}.json`;
  const filePath = path.join(clientePath, `Chats`, `Historico`, `${chatId}`, `${chatId}.json`);

  // Cria o diretório se ele não existir
  if (!fs.existsSync(chatDir)) {
    console.log(`Criando diretório para o chatId:`, chatId);
    fs.mkdirSync(chatDir, { recursive: true });
  }

  // Cria o arquivo Dados.json se ele não existir
  const dadosFilePath = path.join( clientePath, `Chats`, `Historico`, `${chatId}`, `Dados.json`);
  if (!fs.existsSync(dadosFilePath)) {
    console.log(`Criando arquivo Dados.json para o chatId:`, chatId);
    // Conteúdo inicial com dados do contato e nome da lista, se fornecidos
    const initialData: any = {
        name: contato?.nome || 'Não identificado',
        sobrenome: contato?.sobrenome || '',
        telefone: contato?.telefone || chatId.split('@')[0],
        tags: contato?.tags || [],
        listaNome: listaNome || null,
        lead: 'não', // Adiciona campo lead inicial
    };
    fs.writeFileSync(dadosFilePath, JSON.stringify(initialData, null, 2), `utf-8`); // Cria um arquivo com dados iniciais
    console.log(`Dados.json criado com dados iniciais para`, chatId);
  }

  // Formata a data e a hora
  const now = new Date();
  const date = now.toLocaleDateString(`pt-BR`);
  const time = now.toLocaleTimeString(`pt-BR`, { hour: `2-digit`, minute: `2-digit`, second: `2-digit` });

  // Cria o objeto JSON da mensagem
  const messageData = {
    date: date,
    time: time,
    type: type,
    message: message,
  };

  // Verifica se o arquivo já existe
  let messages: any[] = [];
  if (fs.existsSync(filePath)) {
    try {
        const fileContent = fs.readFileSync(filePath, `utf-8`);
        messages = JSON.parse(fileContent);
        if (!Array.isArray(messages)) { // Garante que seja um array
            console.warn(`Conteúdo de ${filePath} não era um array, resetando.`);
            messages = [];
        }
    } catch (e) {
        console.error(`Erro ao ler/parsear ${filePath}, resetando. Erro: ${e}`);
        messages = []; // Reseta em caso de erro de parse
    }
  }

  // Adiciona a nova mensagem ao array
  messages.push(messageData);

  // Escreve o array JSON no arquivo
  try {
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), `utf-8`); // Adiciona a formatação com 2 espaços de indentação
  } catch (e) {
      console.error(`Erro ao escrever em ${filePath}: ${e}`);
  }
}

// Função para gerar um tempo aleatório dentro de um intervalo
const gerarTempoAleatorio = (intervaloDe: number, intervaloAte: number): number => {
  const min = Math.max(0, intervaloDe);
  const max = Math.max(min, intervaloAte);
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
};

// Função para verificar se o número tem conta no WhatsApp (mantida)
const verificarContaWhatsApp = async (client: any, telefone: string): Promise<boolean> => {
  try {
    const contactId = `${telefone}@c.us`;
    const profile = await client.checkNumberStatus(contactId);

    if (profile.status === 'notRegistered') {
      console.log(`O número ${telefone} não está registrado no WhatsApp.`);
      return false;
    } else {
      return true;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Disparo - Erro ao verificar conta do WhatsApp para ${telefone}: ${error.message}`);
    } else {
      console.error(`Disparo - Erro ao verificar conta do WhatsApp para ${telefone}: ${String(error)}`);
    }
    return false;
  }
};

// Função para verificar se dentro do horário permitido (mantida)
const dentroDoHorario = (horarioInicial: string, horarioFinal: string): boolean => {
  const agora = new Date();
  const inicio = new Date(agora);
  const fim = new Date(agora);

  const [horaInicialNum, minutoInicialNum] = horarioInicial.split(':').map(Number);
  const [horaFinalNum, minutoFinalNum] = horarioFinal.split(':').map(Number);

  inicio.setHours(horaInicialNum, minutoInicialNum, 0, 0);
  fim.setHours(horaFinalNum, minutoFinalNum, 59, 999); // Inclui o minuto final

  if (fim < inicio) {
    return agora >= inicio || agora <= fim;
  } else {
    return agora >= inicio && agora <= fim;
  }
};


// Função para verificar se um dia específico da semana está no intervalo permitido
const diaDaSemanaValido = (diaInicial: string, diaFinal: string, dataParaVerificar: Date): boolean => {
  const diasDaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaIndex = getDay(dataParaVerificar); // 0 - Domingo, 6 - Sábado

  const indexDiaInicial = diasDaSemana.indexOf(diaInicial.toLowerCase());
  const indexDiaFinal = diasDaSemana.indexOf(diaFinal.toLowerCase());

  if (indexDiaInicial === -1 || indexDiaFinal === -1) {
      console.error("Dias inicial ou final inválidos nas regras de disparo.");
      return false; // Dia inválido se não encontrado
  }

  if (indexDiaInicial <= indexDiaFinal) {
    // Intervalo normal (ex: segunda a sexta)
    return diaIndex >= indexDiaInicial && diaIndex <= indexDiaFinal;
  } else {
    // Intervalo que atravessa o fim de semana (ex: sexta a segunda)
    return diaIndex >= indexDiaInicial || diaIndex <= indexDiaFinal;
  }
};

// Função para salvar logs em um arquivo (ajustada para receber clientePath)
const salvarLog = (mensagem: string, clientePath: string) => {
  try {
    const logDir = path.join(clientePath, 'erros');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'log.txt');
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${mensagem}\n`;
    fs.appendFileSync(logPath, logMessage);
    console.log(mensagem); // Mantém log no console
  } catch (error) {
      console.error("Erro CRÍTICO ao salvar log:", error); // Loga erro de salvar log no console
  }
};

// Função para registrar o estado do bot (ajustada para usar salvarLog corretamente)
const registrarEstado = (estado: any, clientePath: string ) => {
  const estadoLog = `Estado do bot:\n
    Último dia de disparo: ${estado.ultimoDiaDisparo}\n
    Dias restantes de aquecimento: ${estado.diasRestantesAquecimento}\n
    Quantidade de mensagens do dia: ${estado.contadorMensagens}\n
    Dias passados: ${estado.diaspassados}\n
    Lista atual: ${estado.listaAtualNome}\n
    Índice Contato atual: ${estado.indiceContatoAtual}\n`;
  salvarLog(estadoLog, clientePath);
};

// Função para salvar o estado atual (mantida)
const salvarEstado = (estado: any, clientePath: string) => {
  try {
    const estadoDir = path.join(clientePath, 'erros');
    if (!fs.existsSync(estadoDir)) {
        fs.mkdirSync(estadoDir, { recursive: true });
    }
    const estadoPath = path.join(estadoDir, 'estado.json');
    fs.writeFileSync(estadoPath, JSON.stringify(estado, null, 2));
  } catch (error) {
      console.error("Erro ao salvar estado:", error);
      salvarLog(`ERRO AO SALVAR ESTADO: ${error instanceof Error ? error.message : error}`, clientePath);
  }
};

// Função para carregar o estado salvo (mantida)
const carregarEstado = ( clientePath: string): any => {
  const estadoPath = path.join( clientePath, 'erros', 'estado.json');
  if (fs.existsSync(estadoPath)) {
    try {
        const data = fs.readFileSync(estadoPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Erro ao carregar/parsear estado.json:", error);
        salvarLog(`Erro ao carregar/parsear estado.json: ${error instanceof Error ? error.message : error}. Usando estado padrão.`, clientePath);
        return null;
    }
  }
  return null;
};

export function getPasta(cliente: string) {
  let nomeFinalCliente: string;
  
  if (cliente.includes('/')) {
    const partes = cliente.split('/');
    nomeFinalCliente = partes[partes.length - 1]; // Pega a parte após a última barra
  } else {
    nomeFinalCliente = cliente; // Usa a string original se não houver barra
  }
  
  return path.join(process.cwd(), `clientes`, 'ativos', nomeFinalCliente);
}



// Função principal para disparar
const dispararMensagens = async (client: any, clientePath: string) => {

  let estado = carregarEstado(clientePath) || {
    ultimoDiaDisparo: '',
    diasRestantesAquecimento: 0,
    contadorMensagens: 0,
    diaspassados: 0,
    indiceListaAtual: 0,
    listaAtualNome: '',
    indiceContatoAtual: 0,
    notificacoesEnviadas: {},
    disparosTentadosHoje: false,
    relatorioGeradoHoje: false
  };

  salvarLog(`Iniciando ciclo de disparo. Estado carregado/inicializado.`, clientePath);
  console.log(`Iniciando disparoAgendados...`);
  disparoAgendados(client, clientePath);
  registrarEstado(estado, clientePath);

  try {
// Carregar targetChatId de infoCliente.json
const infoPath = path.join(clientePath, 'config', 'infoCliente.json');
let targetChatId = '';
try {
    const infoConfig = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    targetChatId = infoConfig.TARGET_CHAT_ID || '';
    if (targetChatId && !targetChatId.endsWith('@c.us') && !targetChatId.endsWith('@g.us')) {
        if (targetChatId.includes('-')) { targetChatId += '@g.us'; }
        else { targetChatId += '@c.us'; }
    }
    salvarLog(`TARGET_CHAT_ID definido para notificações: ${targetChatId}`, clientePath);
} catch (error) {
    salvarLog(`Erro ao ler infoCliente.json para TARGET_CHAT_ID: ${error}`, clientePath);
}

    // --- Carregamento das Regras de Disparo (Formato JSON) ---
    const REGRAS_DISPARO_PADRAO = {
        DISPARO_ESTRATEGIA: 'todas_ativas', DISPARO_LISTAS_SELECIONADAS: '',
        HORARIO_INICIAL: '08:00', HORARIO_FINAL: '18:00',
        DIA_INICIAL: 'segunda', DIA_FINAL: 'sexta',
        INTERVALO_DE: '30', INTERVALO_ATE: '60',
        QUANTIDADE_INICIAL: '10', DIAS_AQUECIMENTO: '7',
        QUANTIDADE_LIMITE: '100', QUANTIDADE_SEQUENCIA: '50',
    };
    const regrasDisparoJsonPath = path.join(clientePath, 'config', 'regrasDisparo.json');
    let regrasCarregadas = {};
    try {
        if (fs.existsSync(regrasDisparoJsonPath)) {
            const regrasDisparoRaw = fs.readFileSync(regrasDisparoJsonPath, 'utf-8');
            regrasCarregadas = JSON.parse(regrasDisparoRaw);
            salvarLog(`Arquivo regrasDisparo.json carregado com sucesso.`, clientePath);
        } else {
            salvarLog(`Arquivo regrasDisparo.json não encontrado. Usando regras padrão.`, clientePath);
        }
    } catch (err) {
        salvarLog(`Erro ao ler/parsear regrasDisparo.json: ${err instanceof Error ? err.message : err}. Usando regras padrão.`, clientePath);
    }
    const regras = { ...REGRAS_DISPARO_PADRAO, ...regrasCarregadas };
    const horarioInicial: string = typeof regras.HORARIO_INICIAL === 'string' ? regras.HORARIO_INICIAL : REGRAS_DISPARO_PADRAO.HORARIO_INICIAL;
    const horarioFinal: string = typeof regras.HORARIO_FINAL === 'string' ? regras.HORARIO_FINAL : REGRAS_DISPARO_PADRAO.HORARIO_FINAL;
    const diaInicial: string = typeof regras.DIA_INICIAL === 'string' ? regras.DIA_INICIAL.toLowerCase() : REGRAS_DISPARO_PADRAO.DIA_INICIAL;
    const diaFinal: string = typeof regras.DIA_FINAL === 'string' ? regras.DIA_FINAL.toLowerCase() : REGRAS_DISPARO_PADRAO.DIA_FINAL;
    const intervaloDe: number = extrairValorNumerico(String(regras.INTERVALO_DE ?? REGRAS_DISPARO_PADRAO.INTERVALO_DE));
    const intervaloAte: number = extrairValorNumerico(String(regras.INTERVALO_ATE ?? REGRAS_DISPARO_PADRAO.INTERVALO_ATE));
    const quantidadeInicial: number = extrairValorNumerico(String(regras.QUANTIDADE_INICIAL ?? REGRAS_DISPARO_PADRAO.QUANTIDADE_INICIAL));
    const diasAquecimento: number = extrairValorNumerico(String(regras.DIAS_AQUECIMENTO ?? REGRAS_DISPARO_PADRAO.DIAS_AQUECIMENTO));
    const quantidadeLimite: number = extrairValorNumerico(String(regras.QUANTIDADE_LIMITE ?? REGRAS_DISPARO_PADRAO.QUANTIDADE_LIMITE));
    const quantidadeSequencia: number = extrairValorNumerico(String(regras.QUANTIDADE_SEQUENCIA ?? REGRAS_DISPARO_PADRAO.QUANTIDADE_SEQUENCIA));
    const disparoEstrategia: string = typeof regras.DISPARO_ESTRATEGIA === 'string' ? regras.DISPARO_ESTRATEGIA : REGRAS_DISPARO_PADRAO.DISPARO_ESTRATEGIA;
    const disparoListasSelecionadasRaw: string = typeof regras.DISPARO_LISTAS_SELECIONADAS === 'string' ? regras.DISPARO_LISTAS_SELECIONADAS : REGRAS_DISPARO_PADRAO.DISPARO_LISTAS_SELECIONADAS;
    const disparoListasSelecionadas: string[] = disparoListasSelecionadasRaw ? disparoListasSelecionadasRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    salvarLog(`Regras de Disparo Efetivas: ...`, clientePath); // Log omitido para brevidade

    // --- Filtragem de Listas com base na Estratégia ---
    const listasConfigPath = path.join(clientePath, 'config', 'listas');
    let listaArquivosFiltrados: string[] = [];
    try {
      const todosArquivosJson = fs.readdirSync(listasConfigPath).filter(file => file.toLowerCase().endsWith('.json'));
      if (todosArquivosJson.length === 0) {
        salvarLog(`Nenhuma lista JSON encontrada em ${listasConfigPath}.`, clientePath);
      } else {
        salvarLog(`Encontradas ${todosArquivosJson.length} listas JSON. Aplicando estratégia: ${disparoEstrategia}`, clientePath);
        for (const nomeArquivo of todosArquivosJson) {
          const listaFilePath = path.join(listasConfigPath, nomeArquivo);
          const nomeListaSemExtensao = path.basename(nomeArquivo, '.json');
          let isAtiva = true;
          try {
            const listaContent = fs.readFileSync(listaFilePath, 'utf8');
            const listaData = JSON.parse(listaContent);
            if (listaData.ativo === false) isAtiva = false;
          } catch (err) {
            salvarLog(`Erro ao ler/parsear ${nomeArquivo} para verificar status 'ativo': ${err instanceof Error ? err.message : err}. Considerando como ativa.`, clientePath);
          }
          if (!isAtiva) continue;
          if (disparoEstrategia === 'todas_ativas') {
            listaArquivosFiltrados.push(nomeArquivo);
          } else if (disparoEstrategia === 'selecionadas') {
            if (disparoListasSelecionadas.includes(nomeListaSemExtensao)) {
              listaArquivosFiltrados.push(nomeArquivo);
            }
          }
        }
        salvarLog(`Listas filtradas para disparo (${listaArquivosFiltrados.length}): ${listaArquivosFiltrados.join(', ')}`, clientePath);
      }
    } catch (err) {
      salvarLog(`Erro CRÍTICO ao ler/filtrar diretório de listas ${listasConfigPath}: ${err instanceof Error ? err.message : err}.`, clientePath);
      listaArquivosFiltrados = [];
    }

    // Loop principal
    while (true) {
      const dataAtual = new Date();
      const dataUltimoDisparo = estado.ultimoDiaDisparo ? new Date(estado.ultimoDiaDisparo) : null;

      // --- Verificação de Novo Dia e Geração de Relatório do Dia Anterior ---
      if (!dataUltimoDisparo || !isSameDay(dataAtual, dataUltimoDisparo)) {
          console.log(`Iniciando disparoAgendados...`);
          disparoAgendados(client, clientePath);
          salvarLog(`Novo dia detectado: ${dataAtual.toLocaleDateString('pt-BR')}.`, clientePath);
          // Gera relatório do dia anterior SE houve disparos, SE não foi gerado E SE era dia válido
          if (estado.disparosTentadosHoje && !estado.relatorioGeradoHoje && dataUltimoDisparo && diaDaSemanaValido(diaInicial, diaFinal, dataUltimoDisparo)) {
              salvarLog(`Gerando relatório para o dia anterior: ${dataUltimoDisparo.toLocaleDateString('pt-BR')}`, clientePath);
              try {
                  // Passa a data do dia anterior (dataUltimoDisparo) que acabou de ser processado
                  // Adiciona '!' para indicar ao TypeScript que dataUltimoDisparo não será null neste ponto da lógica
                  await criarEnviarRelatorioDiario(client, clientePath, dataUltimoDisparo!);
                  estado.relatorioGeradoHoje = true;
              } catch (reportError) {
                  salvarLog(`Erro ao gerar relatório diário para ${dataUltimoDisparo.toLocaleDateString('pt-BR')}: ${reportError}`, clientePath);
              }
          }
          // Reseta estado para novo dia
          salvarLog(`Resetando contadores e flags para o novo dia.`, clientePath);
          estado.contadorMensagens = 0;
          estado.ultimoDiaDisparo = dataAtual.toISOString();
          if (estado.diasRestantesAquecimento > 0) estado.diasRestantesAquecimento--;
          estado.diaspassados++;
          estado.indiceListaAtual = 0;
          estado.listaAtualNome = '';
          estado.indiceContatoAtual = 0;
          estado.disparosTentadosHoje = false;
          estado.relatorioGeradoHoje = false;
          salvarEstado(estado, clientePath); // Salva estado resetado
          registrarEstado(estado, clientePath);
      }

      // --- Recontagem de Disparos do Dia (para robustez) ---
      let disparosContadosHoje = 0;
      const hojeDataStringRecount = dataAtual.toLocaleDateString('pt-BR', { dateStyle: 'short' });
      const todosArquivosJsonRecount = fs.existsSync(listasConfigPath) ? fs.readdirSync(listasConfigPath).filter(file => file.toLowerCase().endsWith('.json')) : [];
      for (const nomeArquivoLista of todosArquivosJsonRecount) {
          const listaFilePath = path.join(listasConfigPath, nomeArquivoLista);
          try {
              const listaContent = fs.readFileSync(listaFilePath, 'utf8');
              const lista = JSON.parse(listaContent);
              if (Array.isArray(lista.contatos)) {
                  disparosContadosHoje += lista.contatos.filter((c: any) => c.disparo === "sim" && c.data_1_contato?.startsWith(hojeDataStringRecount)).length; // Verifica início da string de data/hora
              }
          } catch { /* Ignora erros aqui */ }
      }
      // Não salva log aqui para não poluir

      // --- Cálculo da Meta Diária ---
      let quantidadeMensagensDia: number;
      if (estado.diaspassados <= diasAquecimento) {
        const progressoAquecimento = estado.diaspassados / diasAquecimento;
        quantidadeMensagensDia = Math.round(quantidadeInicial + (quantidadeLimite - quantidadeInicial) * progressoAquecimento);
        quantidadeMensagensDia = Math.min(quantidadeMensagensDia, quantidadeLimite);
        // salvarLog(`Dia ${estado.diaspassados} de aquecimento. Meta diária: ${quantidadeMensagensDia}`, clientePath);
      } else {
        quantidadeMensagensDia = quantidadeLimite;
        // salvarLog(`Aquecimento concluído. Meta diária: ${quantidadeMensagensDia}`, clientePath);
      }

      // --- Verificação de Limite Diário Atingido ---
      if (disparosContadosHoje >= quantidadeMensagensDia) { // Compara com recontagem
          salvarLog(`Meta diária (${quantidadeMensagensDia}) atingida (Total hoje: ${disparosContadosHoje}). Encerrando atividades do dia.`, clientePath);
          // Gera relatório SE houve disparos e ainda não foi gerado HOJE
          if (estado.disparosTentadosHoje && !estado.relatorioGeradoHoje) {
              salvarLog(`Gerando relatório do dia ${dataAtual.toLocaleDateString('pt-BR')} devido ao limite atingido.`, clientePath);
              try {
                  // Passa a data atual, pois o limite foi atingido neste dia
                  await criarEnviarRelatorioDiario(client, clientePath, dataAtual);
                  estado.relatorioGeradoHoje = true;
                  salvarEstado(estado, clientePath);
              } catch (reportError) {
                  salvarLog(`Erro ao gerar relatório diário (limite): ${reportError}`, clientePath);
              }
          }
          // Calcula espera e continua para o próximo dia
          const proximoInicio = new Date(dataAtual);
          proximoInicio.setDate(proximoInicio.getDate() + 1);
          proximoInicio.setHours(horarioInicial.split(':').map(Number)[0], horarioInicial.split(':').map(Number)[1], 0, 0);
          let dataVerificar = new Date(proximoInicio);
          while (!diaDaSemanaValido(diaInicial, diaFinal, dataVerificar)) { dataVerificar.setDate(dataVerificar.getDate() + 1); }
          proximoInicio.setTime(dataVerificar.getTime());
          const tempoEspera = proximoInicio.getTime() - dataAtual.getTime();
          if (tempoEspera > 0) {
              salvarLog(`Aguardando ${Math.round(tempoEspera / 1000 / 60)} minutos até o próximo dia/horário válido: ${proximoInicio.toLocaleString('pt-BR')}`, clientePath);
              await new Promise(resolve => setTimeout(resolve, tempoEspera));
          }
          continue;
      }

      // --- Verificação de Dia/Horário Válido ---
      const diaValidoHoje = diaDaSemanaValido(diaInicial, diaFinal, dataAtual);
      const horarioValidoAgora = dentroDoHorario(horarioInicial, horarioFinal);

      if (!diaValidoHoje || !horarioValidoAgora) {
          const motivo = !diaValidoHoje ? `Fora do dia da semana permitido (${diaInicial} a ${diaFinal})` : `Fora do horário permitido (${horarioInicial} - ${horarioFinal})`;
          salvarLog(`${motivo}. Encerrando atividades do dia.`, clientePath);
          // Gera relatório SE houve disparos, não foi gerado HOJE E HOJE ERA UM DIA VÁLIDO
          if (estado.disparosTentadosHoje && !estado.relatorioGeradoHoje && diaValidoHoje) {
              salvarLog(`Gerando relatório do dia ${dataAtual.toLocaleDateString('pt-BR')} devido ao fim do período válido.`, clientePath);
              try {
                  // Passa a data atual, pois o período válido terminou neste dia
                  await criarEnviarRelatorioDiario(client, clientePath, dataAtual);
                  estado.relatorioGeradoHoje = true;
                  salvarEstado(estado, clientePath);
              } catch (reportError) {
                  salvarLog(`Erro ao gerar relatório diário (fim período): ${reportError}`, clientePath);
              }
          } else if (!diaValidoHoje) {
              salvarLog(`Não gerando relatório pois hoje (${dataAtual.toLocaleDateString('pt-BR')}) não era um dia válido para disparos.`, clientePath);
          }
          // Calcula espera e continua para o próximo dia/horário
          const proximoInicio = new Date(dataAtual);
          proximoInicio.setHours(horarioInicial.split(':').map(Number)[0], horarioInicial.split(':').map(Number)[1], 0, 0);
          if (proximoInicio < dataAtual || !diaValidoHoje) {
              proximoInicio.setDate(proximoInicio.getDate() + 1);
              proximoInicio.setHours(horarioInicial.split(':').map(Number)[0], horarioInicial.split(':').map(Number)[1], 0, 0);
          }
          let dataVerificar = new Date(proximoInicio);
          while (!diaDaSemanaValido(diaInicial, diaFinal, dataVerificar)) { dataVerificar.setDate(dataVerificar.getDate() + 1); }
          proximoInicio.setTime(dataVerificar.getTime());
          const tempoEspera = proximoInicio.getTime() - dataAtual.getTime();
           if (tempoEspera > 0) {
              salvarLog(`Aguardando ${Math.round(tempoEspera / 1000 / 60)} minutos até o próximo dia/horário válido: ${proximoInicio.toLocaleString('pt-BR')}`, clientePath);
              await new Promise(resolve => setTimeout(resolve, tempoEspera));
          }
          continue;
      }

      // --- Processamento das Listas e Contatos ---
      let disparoRealizadoNesteCiclo = false;
      let imagem = ''; // Resetar imagem

      const indiceListaAtual = estado.indiceListaAtual || 0;
      if (indiceListaAtual < listaArquivosFiltrados.length) {
        const nomeArquivoLista = listaArquivosFiltrados[indiceListaAtual];
        const listaNome = path.basename(nomeArquivoLista, '.json');
        const listaFilePath = path.join(listasConfigPath, nomeArquivoLista);
  
        let lista;
        try {
          const listaOriginalContent = fs.readFileSync(listaFilePath, 'utf8');
          lista = JSON.parse(listaOriginalContent);
        } catch (err) {
          salvarLog(`Erro ao ler ou parsear lista ${listaNome}: ${err instanceof Error ? err.message : err}. Pulando lista.`, clientePath);
          continue;
        }

        if (!Array.isArray(lista.contatos) || lista.contatos.length === 0) continue; // Pula lista vazia

        estado.listaAtualNome = listaNome;
        salvarLog(`Processando lista: ${listaNome}`, clientePath);
        let indiceInicio = estado.indiceContatoAtual || 0;

        for (let i = indiceInicio; i < lista.contatos.length; i++) {
          // Re-verifica limite e horário DENTRO do loop de contatos
          const disparosAtuaisTotal = disparosContadosHoje + estado.contadorMensagens; // Recalcula total atual
          if (disparosAtuaisTotal >= quantidadeMensagensDia) {
              salvarLog(`Meta diária (${quantidadeMensagensDia}) atingida durante processamento da lista ${listaNome}. Pausando.`, clientePath);
              break; // Sai do loop de contatos
          }
          if (!dentroDoHorario(horarioInicial, horarioFinal)) {
              salvarLog(`Horário inválido (${horarioInicial}-${horarioFinal}) atingido durante processamento da lista ${listaNome}. Pausando lista.`, clientePath);
              break; // Sai do loop de contatos
          }

          const contato = lista.contatos[i];
          estado.indiceContatoAtual = i;

          if (!contato || !contato.telefone) {
            salvarLog(`Contato inválido no índice ${i} da lista ${listaNome}, pulando.`, clientePath);
            continue;
          }
          if (contato.disparo === "sim") continue; // Pula já disparado

          const telefone = contato.telefone;
          const chatId = `${telefone}@c.us`;
          const nome = contato.nome || '';
          const sobrenome = contato.sobrenome || '';

          const temWhatsApp = await verificarContaWhatsApp(client, telefone);
          if (!temWhatsApp) {
            salvarLog(`Número ${telefone} (${nome}) não possui WhatsApp. Marcando como falha.`, clientePath);
            contato.disparo = "falha_wpp";
            contato.data_1_contato = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); // Usa data_1_contato
            // Salva imediatamente após marcar falha
             try {
                const novoConteudoLista = JSON.stringify(lista, null, 2);
                fs.writeFileSync(listaFilePath, novoConteudoLista);
            } catch (saveErr) {
                salvarLog(`ERRO CRÍTICO ao salvar lista ${listaNome} após marcar falha_wpp para ${telefone}: ${saveErr instanceof Error ? saveErr.message : saveErr}`, clientePath);
            }
            salvarEstado(estado, clientePath); // Salva o índice atualizado
            continue;
          }

          // Enviar Mensagem
          try {
            const mensagemTemplate = lista.mensagem || MENSAGEM_PADRAO;
            const mensagemParaEnviar = mensagemTemplate.replace('{nome}', nome).replace('{sobrenome}', sobrenome);          
        
            let midiaEnviada = false; // Flag para controlar se mídia foi enviada
            // Envio de mídia
            if (lista.media && Array.isArray(lista.media) && lista.media.length > 0) {
              try {
                for (const mediaItem of lista.media) {
                  if (mediaItem.arquivo && mediaItem.tipo) {
                    // Constrói o caminho completo do arquivo de mídia
                    const mediaFilePath = path.join(clientePath, 'config', 'listas', mediaItem.arquivo);
                    if (fs.existsSync(mediaFilePath)) {
                      // A mensagem de texto já foi enviada na linha 529.
                      // Agora enviamos a mídia.
                      try {
                        switch (mediaItem.tipo) {
                          case 'audio': // Assumindo PTT para áudio
                            await sendPtt(client, chatId, mediaFilePath);
                            await salvarLog(`Áudio (PTT) enviado para ${telefone} (${nome})`, clientePath);
                            break;
                          case 'image':
                            // Reutiliza a mensagem de texto como caption, se houver
                            await sendImage(client, chatId, mediaFilePath, mensagemParaEnviar);
                            await salvarLog(`Imagem enviada para ${telefone} (${nome})`, clientePath);
                            break;
                          case 'video':
                            // Assumindo que sendVideo existe e funciona conforme o esperado em enviarMidia.ts
                            // Reutiliza a mensagem de texto como caption, se houver
                            await sendVideo(client, chatId, mediaFilePath, mensagemParaEnviar);
                            await salvarLog(`Vídeo enviado para ${telefone} (${nome})`, clientePath);
                            break;
                          case 'document':
                            // Assumindo que sendFile existe e funciona conforme o esperado em enviarMidia.ts
                            // Reutiliza a mensagem de texto como caption, se houver
                            await sendFile(client, chatId, mediaFilePath, mensagemParaEnviar);
                            await salvarLog(`Documento enviado para ${telefone} (${nome})`, clientePath);
                            break;
                          default:
                            console.warn(`Tipo de mídia não suportado: ${mediaItem.tipo} para ${telefone} (${nome})`);
                            await salvarLog(`Tipo de mídia não suportado: ${mediaItem.tipo} para ${telefone} (${nome})`, clientePath);
                            break;
                        }
                      } catch (mediaError) {
                        console.error(`Erro ao enviar mídia (${mediaItem.tipo}) para ${telefone} (${nome}):`, mediaError);
                        await salvarLog(`Erro ao enviar mídia (${mediaItem.tipo}) para ${telefone} (${nome}): ${mediaError}`, clientePath);
                      }
                    } else {
                      await salvarLog(`Arquivo de mídia não encontrado: ${mediaFilePath} para ${telefone} (${nome})`, clientePath);
                    }
                  } else {
                    console.warn(`Item de mídia inválido na lista para ${telefone} (${nome}):`, mediaItem);
                    await salvarLog(`Item de mídia inválido na lista para ${telefone} (${nome}): ${JSON.stringify(mediaItem)}`, clientePath);
                  }
                }
              } catch (listaLocalError) {
                console.error(`[dispararMensagens] Erro ao processar mídia para ${telefone}:`, listaLocalError);
              }
            }

            // Envia a mensagem de texto antes de tentar enviar a mídia (se houver)
            await client.sendText(chatId, mensagemParaEnviar);
            salvarLog(`Mensagem enviada para ${telefone} (${nome})`, clientePath);

            // Atualiza a data da última mensagem enviada
            await updateLastSentMessageDate(clientePath, chatId);

           // --- Sucesso no Disparo ---
            estado.contadorMensagens++;
            disparoRealizadoNesteCiclo = true;
            estado.disparosTentadosHoje = true; // Marca que houve tentativa hoje

            // Atualiza contato em memória
            contato.disparo = "sim";
            const now = new Date();
            contato.data_1_contato = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            delete contato.hora_1_contato; // Remove campo antigo se existir

            // Define sucessoDisparo antes de usá-lo
            const sucessoDisparo = true; // Definindo como true, pois estamos no bloco de sucesso
            // Registrar disparo (Restaurando argumentos corretos)
            registrarDisparo(clientePath, {
              data: new Date().toISOString(),
              numeroTelefone: telefone,
              status: sucessoDisparo, // Assume true aqui, pois está no bloco de sucesso
              etapaAquecimento: diasAquecimento - estado.diasRestantesAquecimento,
              quantidadeDisparada: estado.contadorMensagens, // Usa o contador atual da execução
              limiteDiario: quantidadeMensagensDia
            });
            console.log(`Mensagem enviada para ${telefone} (${nome}) | Total hoje: ${disparosContadosHoje + estado.contadorMensagens} de ${quantidadeMensagensDia} | sucesso`);
            salvarEstado(estado, clientePath); // Salva estado com contador incrementado

            // Salvar histórico chatid
            await saveMessageToFile(client.id || 'unknown_client', clientePath, chatId, mensagemParaEnviar, 'IA', contato, listaNome);

                    // Envia a mídia, se houver na listaData.media


            // Salvar o arquivo JSON da lista IMEDIATAMENTE
            try {
                const novoConteudoLista = JSON.stringify(lista, null, 2);
                fs.writeFileSync(listaFilePath, novoConteudoLista);
            } catch (saveErr) {
                salvarLog(`ERRO CRÍTICO ao salvar lista ${listaNome} após disparo para ${telefone}: ${saveErr instanceof Error ? saveErr.message : saveErr}`, clientePath);
            }

            // Pausa entre mensagens
            const tempoEspera = gerarTempoAleatorio(intervaloDe, intervaloAte);
            await new Promise(resolve => setTimeout(resolve, tempoEspera));

            // Verificação e Notificação de Progresso
            if (targetChatId) {
                try {
                    const listaAtualizadaContent = fs.readFileSync(listaFilePath, 'utf8');
                    const listaAtualizada = JSON.parse(listaAtualizadaContent);
                    const totalContatosLista = listaAtualizada.contatos?.length || 0;
                    const disparadosLista = (listaAtualizada.contatos || []).filter((c: any) => c.disparo === "sim").length;
                    if (totalContatosLista > 0) {
                        const porcentagem = Math.floor((disparadosLista / totalContatosLista) * 100);
                        const marcoAtual = Math.floor(porcentagem / 10) * 10;
                        estado.notificacoesEnviadas = estado.notificacoesEnviadas || {};
                        estado.notificacoesEnviadas[listaNome] = estado.notificacoesEnviadas[listaNome] || [];
                        if (marcoAtual >= 50 && marcoAtual < 100 && !estado.notificacoesEnviadas[listaNome].includes(marcoAtual)) {
                            const nomeCliente = path.basename(clientePath);
                            const mensagemNotificacao = `🔔 *Progresso Cliente ${nomeCliente}* 🔔\n\nLista: *${listaNome}*\nDisparos atingiram *${marcoAtual}%* (${disparadosLista}/${totalContatosLista}).\n\nConsidere adicionar mais contatos ou preparar a próxima lista.`;
                            salvarLog(`Enviando notificação de progresso (${marcoAtual}%) para ${targetChatId}`, clientePath);
                            try {
                                await client.sendText(targetChatId, mensagemNotificacao);
                                await updateLastSentMessageDate(clientePath, chatId);
                                estado.notificacoesEnviadas[listaNome].push(marcoAtual);
                                salvarEstado(estado, clientePath);
                            } catch (notifyError) {
                                salvarLog(`Falha ao enviar notificação de progresso para ${targetChatId}: ${notifyError}`, clientePath);
                            }
                        }
                    }
                } catch (progressError) {
                    salvarLog(`Erro ao verificar/notificar progresso da lista ${listaNome}: ${progressError}`, clientePath);
                }
            }

            // Pausa de 1 hora
            if (quantidadeSequencia > 0 && (disparosContadosHoje + estado.contadorMensagens) % quantidadeSequencia === 0) { // Usa total do dia para pausa
                registrarEstado(estado, clientePath);
                salvarLog(`Pausa de 1 hora após ${disparosContadosHoje + estado.contadorMensagens} mensagens totais no dia.`, clientePath);
                await new Promise(resolve => setTimeout(resolve, 3600000));
            }

          } catch (error) {
            salvarLog(`Disparo - Erro ao enviar mensagem para ${telefone} (${nome}): ${error}`, clientePath);
          }
        } // Fim do loop de contatos (for i)

        // Verifica se o loop processou o último contato da lista com sucesso
        // Esta verificação deve ocorrer APÓS o loop 'for (let i...'
        // e ANTES do 'break' caso tenha saído por limite/horário.
        // A forma mais segura é verificar o índice salvo no estado.
        if (estado.indiceContatoAtual === lista.contatos.length - 1) {
             salvarLog(`Fim da lista ${listaNome} alcançado após processar o último contato.`, clientePath);

             // Tenta gerar e enviar o relatório específico da lista
             try {
                 // Passa o objeto 'lista' que ainda está no escopo
                 await criarEnviarRelatorioLista(client, clientePath, listaNome, lista);
             } catch (reportListaError) {
                 salvarLog(`Erro ao gerar/enviar relatório para a lista ${listaNome}: ${reportListaError}`, clientePath);
             }

             // Limpa o estado para indicar que esta lista terminou e a próxima pode começar
             estado.listaAtualNome = '';
             estado.indiceContatoAtual = 0; // Reseta para a próxima lista
             // Limpa também as notificações enviadas para esta lista específica
             if (estado.notificacoesEnviadas && estado.notificacoesEnviadas[listaNome]) {
                 delete estado.notificacoesEnviadas[listaNome];
             }
             salvarEstado(estado, clientePath); // Salva o estado atualizado
             const indiceListaAtual = estado.indiceListaAtual;
             estado.indiceListaAtual = indiceListaAtual + 1;
             salvarEstado(estado, clientePath);
           } else {
             salvarEstado(estado, clientePath);
           }
         } else {
           estado.indiceListaAtual = 0;
           salvarEstado(estado, clientePath);
         }

      // Se nenhum disparo foi feito neste ciclo, aguarda
      if (!disparoRealizadoNesteCiclo && (disparosContadosHoje < quantidadeMensagensDia)) {
          salvarLog(`Nenhum disparo realizado neste ciclo. Total do dia: ${disparosContadosHoje}/${quantidadeMensagensDia}. Aguardando 6 horas para a próxima atualização.`, clientePath);
          await new Promise(resolve => setTimeout(resolve, 6 * 600000));
      }

    } // Fim do loop while(true)

  } catch (error) {
    salvarLog(`Disparo - Erro GERAL não capturado no loop principal: ${error}`, clientePath);
    // Tenta gerar relatório final em caso de erro fatal, se houve disparos
    if (estado.disparosTentadosHoje && !estado.relatorioGeradoHoje) {
        salvarLog(`Tentando gerar relatório final devido a erro fatal...`, clientePath);
         try {
            // Passa a data atual no momento do erro fatal
            await criarEnviarRelatorioDiario(client, clientePath, new Date());
            estado.relatorioGeradoHoje = true; // Marca mesmo em erro para não tentar de novo
            salvarEstado(estado, clientePath);
        } catch (reportError) {
            salvarLog(`Erro ao gerar relatório diário após erro fatal: ${reportError}`, clientePath);
        }
    }
    throw error; // Propaga o erro para o loop de recuperação
  }
};

// Função para iniciar o processo de disparo com recuperação de erros (mantida)
const iniciarDisparoComRecuperacao = async (client: any, clientePath: any) => {
  while (true) {
    try {
      await dispararMensagens(client, clientePath);
      salvarLog("Loop principal de disparo terminou inesperadamente. Reiniciando em 1 minuto.", clientePath);
      await new Promise(resolve => setTimeout(resolve, 60000));
    } catch (error) {
      salvarLog(`Disparo - Erro capturado no loop de recuperação: ${error}. Reiniciando em 1 minuto.`, clientePath);
      console.error(`Erro no processo de disparo. Tentando recuperar...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
};

export { dispararMensagens, iniciarDisparoComRecuperacao };
