import { criarEnviarRelatorioDiario } from '../relatorio/relatorioDiario.ts';


async function relatorios(client: any, clientePath: string) { // Modifique para aceitar client como parâmetro
    // Lê o horário do relatório do arquivo .regrasdisparo
      await criarEnviarRelatorioDiario(client, clientePath, new Date())
     .catch((error) => console.error('Erro ao enviar relatorio:', error));
    }




export { relatorios }
