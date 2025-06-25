import * as fs from 'fs'; // Importar fs para existsSync
import * as fsPromises from 'fs/promises'; // Importar fs/promises para operações assíncronas
import path from 'path'; // Importar path
import { getPasta } from '@/backend/disparo/disparo'; // Importar getPasta
 
// GET /api/blocked-numbers?clientId=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId'); // Manter clientId para obter o caminho da pasta
 
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'ClientId é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
 
    // --- Lógica de Carregamento Local ---
    const clienteFolderPath = getPasta(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local
    const localBlockedNumbersPath = path.join(clienteFolderPath, 'config', 'ignoredChatIds.json');
    let localBlockedNumbers = [];
    try {
        if (fs.existsSync(localBlockedNumbersPath)) {
            const localContent = await fsPromises.readFile(localBlockedNumbersPath, 'utf-8');
            localBlockedNumbers = JSON.parse(localContent);
            console.log(`[API /api/blocked-numbers GET] Números bloqueados carregados localmente para ${clientId}`);
        }
    } catch (localError) {
        console.error(`[API /api/blocked-numbers GET] Erro ao carregar números bloqueados localmente para ${clientId}:`, localError);
        // Continuar, mas logar o erro
    }
    // --- Fim Lógica de Carregamento Local ---
 
    return new Response(JSON.stringify({ blockedNumbers: localBlockedNumbers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }); // Retornando apenas os dados locais
  } catch (error) {
    console.error('Erro ao buscar números bloqueados:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar números bloqueados' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
 
// POST /api/blocked-numbers - Adicionar número bloqueado localmente
export async function POST(request) {
  try {
    const { clientId, number } = await request.json(); // Remover clienteSequencialId
 
    if (!clientId || !number) {
      return new Response(
        JSON.stringify({ error: 'ClientId e número são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
 
    const numeroLimpo = number.replace(/\D/g, '');
    if (!numeroLimpo) {
        return new Response(JSON.stringify({ error: 'Número de telefone inválido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
 
    // --- Lógica de Salvamento Local ---
    const clienteFolderPath = getPasta(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local
    const localBlockedNumbersPath = path.join(clienteFolderPath, 'config', 'ignoredChatIds.json');
    let localBlockedNumbers = [];
 
    // Tenta carregar números bloqueados locais existentes
    try {
        if (fs.existsSync(localBlockedNumbersPath)) {
            const localContent = await fsPromises.readFile(localBlockedNumbersPath, 'utf-8');
            localBlockedNumbers = JSON.parse(localContent);
        }
    } catch (localError) {
        console.error(`[API /api/blocked-numbers POST] Erro ao carregar números bloqueados localmente para ${clientId} antes de salvar:`, localError);
        // Continuar, mas logar o erro
    }
 
    // Adiciona o número bloqueado se não existir localmente
    if (!localBlockedNumbers.includes(numeroLimpo)) {
        localBlockedNumbers.push(numeroLimpo);
        // Salva a lista atualizada localmente
        try {
            await fsPromises.writeFile(localBlockedNumbersPath, JSON.stringify(localBlockedNumbers, null, 2), 'utf-8');
            console.log(`[API /api/blocked-numbers POST] Número ${numeroLimpo} bloqueado localmente para ${clientId}`);
        } catch (localError) {
            console.error(`[API /api/blocked-numbers POST] Erro ao salvar números bloqueados localmente para ${clientId}:`, localError);
            // Continuar, mas logar o erro
        }
    } else {
        console.log(`[API /api/blocked-numbers POST] Número ${numeroLimpo} já existia localmente para ${clientId}.`);
    }
    // --- Fim Lógica de Salvamento Local ---
 
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao bloquear número:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao bloquear número' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
 
// DELETE /api/blocked-numbers - Desbloquear número localmente
export async function DELETE(request) {
  try {
    const { clientId, number } = await request.json(); // Remover clienteSequencialId
 
    if (!clientId || !number) {
      return new Response(
        JSON.stringify({ error: 'ClientId e número são obrigatórios para desbloquear' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
 
    const numeroLimpo = number.replace(/\D/g, '');
    if (!numeroLimpo) {
        return new Response(JSON.stringify({ error: 'Número de telefone inválido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
 
    // --- Lógica de Exclusão Local ---
    const clienteFolderPath = getPasta(clientId); // Usar clientId (tipo/nomePasta) para obter o caminho local
    const localBlockedNumbersPath = path.join(clienteFolderPath, 'config', 'ignoredChatIds.json');
    let localBlockedNumbers = [];
 
    // Tenta carregar números bloqueados locais existentes
    try {
        if (fs.existsSync(localBlockedNumbersPath)) {
            const localContent = await fsPromises.readFile(localBlockedNumbersPath, 'utf-8');
            localBlockedNumbers = JSON.parse(localContent);
    }
    } catch (localError) {
        console.error(`[API /api/blocked-numbers DELETE] Erro ao carregar números bloqueados localmente para ${clientId} antes de excluir:`, localError);
        // Continuar, mas logar o erro
    }
 
    // Remove o número bloqueado se existir localmente
    const numeroChatid = `${numeroLimpo}@c.us`;
    const numeroIndex = localBlockedNumbers.indexOf(numeroChatid);
    if (numeroIndex !== -1) {
        localBlockedNumbers.splice(numeroIndex, 1);
        // Salva a lista atualizada localmente
        try {
            await fsPromises.writeFile(localBlockedNumbersPath, JSON.stringify(localBlockedNumbers, null, 2), 'utf-8');
            console.log(`[API /api/blocked-numbers DELETE] Número ${numeroLimpo}@c.us desbloqueado localmente para ${clientId}`);
        } catch (localError) {
            console.error(`[API /api/blocked-numbers DELETE] Erro ao salvar números bloqueados localmente para ${clientId}:`, localError);
            // Continuar, mas logar o erro
        }
    } else {
        console.warn(`[API /api/blocked-numbers DELETE] Número ${numeroLimpo} não encontrado localmente para ${clientId}.`);
    }
    // --- Fim Lógica de Exclusão Local ---
 
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao desbloquear número:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao desbloquear número' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
