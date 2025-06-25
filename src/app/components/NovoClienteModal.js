'use client';

import { useState, useEffect } from 'react';
import NovoClienteConfigModal from './NovoClienteConfigModal';
import styles from './DuplicateCheckModal.module.css';

export default function NovoClienteModal({ isOpen, onClose, modelos, onSave }) {
  const [etapa, setEtapa] = useState(1); // 1: Selecionar Modelo, 2: Editar Dados
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [dadosCliente, setDadosCliente] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [envData, setEnvData] = useState({});
  const [novoClienteId, setNovoClienteId] = useState('');

  useEffect(() => {
    if (isOpen) {
      console.log('[NovoClienteModal] Resetando estado ao abrir.');
      setEtapa(1);
      setModeloSelecionado('');
      setDadosCliente({});
      setError('');
      setIsLoading(false);
      setEnvData({});
      setNovoClienteId('');
    }
  }, [isOpen]);

  const handleProximaEtapa = async () => {
    console.log('[NovoClienteModal] handleProximaEtapa iniciado.');
    if (!dadosCliente.nome || dadosCliente.nome.trim() === '') {
      setError('Por favor, digite o nome do cliente.');
      return;
    }
    if (!modeloSelecionado) {
      setError('Por favor, selecione um modelo.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const clienteId = `ativos/${dadosCliente.nome}`;
      setNovoClienteId(clienteId);
      console.log(`[NovoClienteModal] Chamando API para copiar arquivos. Modelo: ${modeloSelecionado}, Cliente ID: ${clienteId}`);

      // Chamar o endpoint da API para copiar os arquivos
      const copiarArquivosResponse = await fetch('/api/create-client-functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'copiarArquivosDoModelo',
          modeloId: modeloSelecionado,
          novoClienteId: clienteId,
        }),
      });

      console.log('[NovoClienteModal] Resposta da API (copiar):', copiarArquivosResponse.status);

      if (!copiarArquivosResponse.ok) {
        const errorBody = await copiarArquivosResponse.text();
        console.error('[NovoClienteModal] Erro na API (copiar):', errorBody);
        throw new Error('Erro ao copiar arquivos do modelo');
      }

      const copiarArquivosResult = await copiarArquivosResponse.json();
      console.log('[NovoClienteModal] Resultado da API (copiar):', copiarArquivosResult);
      setEnvData(copiarArquivosResult.envData || {});
      console.log('[NovoClienteModal] Estado envData atualizado:', copiarArquivosResult.envData || {}); // <-- LOG FRONTEND 1

      setEtapa(2);
      console.log('[NovoClienteModal] Mudando para etapa 2.');
    } catch (error) {
      console.error('[NovoClienteModal] Erro em handleProximaEtapa:', error);
      setError('Erro ao processar os dados. Verifique o console.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoltarEtapa = () => {
    console.log('[NovoClienteModal] Voltando para etapa 1.');
    setEtapa(1);
    setError('');
  };

  const handleSalvarConfig = async (config) => {
    console.log('[NovoClienteModal] handleSalvarConfig iniciado. Config recebida:', config);
    setIsLoading(true);
    setError('');
    try {
      const dadosCompletos = { ...dadosCliente, ...config };
      console.log(`[NovoClienteModal] Chamando API para salvar dados. Cliente ID: ${novoClienteId}, Dados:`, dadosCompletos);
      // Chamar o endpoint da API para salvar os dados no Firebase
      const salvarDadosResponse = await fetch('/api/create-client-functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'salvarDadosNoFirebase',
          novoClienteId: novoClienteId,
          dados: dadosCompletos, // Envia os dados combinados
          modeloSelecionado: modeloSelecionado,
        }),
      });

      console.log('[NovoClienteModal] Resposta da API (salvar):', salvarDadosResponse.status);

      if (!salvarDadosResponse.ok) {
        const errorBody = await salvarDadosResponse.text();
        console.error('[NovoClienteModal] Erro na API (salvar):', errorBody);
        throw new Error('Erro ao salvar dados no Firebase');
      }

      console.log('[NovoClienteModal] Dados salvos com sucesso, fechando modal.');
      onClose(); // Fecha o modal principal
    } catch (error) {
      console.error('[NovoClienteModal] Erro em handleSalvarConfig:', error);
      setError('Erro ao processar os dados. Verifique o console.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  console.log(`[NovoClienteModal] Renderizando. Etapa: ${etapa}, envData:`, envData); // <-- LOG FRONTEND 2

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ minWidth: '500px' }}>
        <h2>Novo Cliente</h2>
        {error && <p className={styles.error}>{error}</p>}

        {etapa === 1 && (
          <div>
            <h3>Etapa 1: Crie o Novo Cliente</h3>
            <label htmlFor="nomeCliente">Nome do Cliente:</label>
            <input
              type="text"
              id="nomeCliente"
              placeholder="Digite o nome do cliente"
              value={dadosCliente.nome || ''}
              onChange={(e) => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
              className={styles.input}
              style={{ marginBottom: '1rem', width: '100%' }}
            />
            <label htmlFor="modeloCliente">Modelo:</label>
            <select
              id="modeloCliente"
              value={modeloSelecionado}
              onChange={(e) => setModeloSelecionado(e.target.value)}
              className={styles.input}
              style={{ marginBottom: '1rem', width: '100%' }}
            >
              <option value="">-- Selecione um modelo --</option>
              {modelos.map((modelo) => (
                <option key={modelo} value={modelo}>
                  {modelo}
                </option>
              ))}
            </select>
            <div className={styles.buttonGroup}>
              <button onClick={onClose} className={styles.cancelButton}>Cancelar</button>
              <button onClick={handleProximaEtapa} className={styles.saveButton} disabled={isLoading}>
                {isLoading ? 'Processando...' : 'Próximo'}
              </button>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <NovoClienteConfigModal
            isOpen={etapa === 2}
            onClose={handleVoltarEtapa} // Permite voltar para a etapa 1
            envData={envData} // Passa os dados do .env
            onSave={handleSalvarConfig} // Função para salvar tudo no final
          />
        )}
      </div>
    </div>
  );
}