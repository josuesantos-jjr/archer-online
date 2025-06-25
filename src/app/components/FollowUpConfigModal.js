// src/app/components/FollowUpConfigModal.js (Refatorado para JS e estilo similar a RegrasDisparoModal)
'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Configuração padrão inicial para o estado do formulário
const defaultConfig = {
  ativo: false,
  niveis: 5,
  promptGeral: true,
  prompt: '',
  promptsPorNivel: ['', '', '', '', ''],
  intervalosDias: [1, 3, 7, 15, 30],
  recorrencia: false,
  diasRecorrencia: 30,
  promptAnalise: '',
  midiaPorNivel: Array(5).fill({ ativado: false, arquivos: [], tipos: [] }), // Inicializa com 5 níveis padrão
};
 
 export default function FollowUpConfigModal({
   isOpen,
   onClose,
   clientId,
}) {
  const [config, setConfig] = useState(defaultConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Função para buscar a configuração atual
  const fetchConfig = useCallback(async () => {
    if (!clientId || !clientId.includes('/')) {
      console.error(
        'FollowUpConfigModal: clientId inválido ou nulo:',
        clientId
      );
      setError('ID do cliente inválido para buscar configuração.');
      return;
    }
    const folderType = clientId.split('/')[0];
    const clientName = clientId.substring(clientId.indexOf('/') + 1);
    console.log(
      `[FollowUpConfigModal JS] Fetching config for: folderType=${folderType}, clientName=${clientName}`
    );
    setIsLoading(true);
    setError(null);
    try {
      // Envia parâmetros separados
      const response = await fetch(
        `/api/followup-config?clientId=${encodeURIComponent(clientId)}`
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'Erro ao buscar configuração de follow-up'
        );
      }
      // A API retorna um objeto com a chave 'config' contendo as configurações
      const fetchedConfig = data.config || {};
      // Mescla a configuração carregada com a padrão para garantir todos os campos
      let mergedConfig = { ...defaultConfig, ...fetchedConfig };

      // Garante que 'niveis' seja um número e ajusta arrays
      mergedConfig.niveis = parseInt(mergedConfig.niveis, 10) || 5;

      // Ajusta promptsPorNivel
      mergedConfig.promptsPorNivel = Array.isArray(mergedConfig.promptsPorNivel)
        ? mergedConfig.promptsPorNivel.slice(0, mergedConfig.niveis)
        : [];
      while (mergedConfig.promptsPorNivel.length < mergedConfig.niveis) {
        mergedConfig.promptsPorNivel.push('');
      }

      // Ajusta intervalosDias
      mergedConfig.intervalosDias = Array.isArray(mergedConfig.intervalosDias)
        ? mergedConfig.intervalosDias.slice(0, mergedConfig.niveis)
        : [];
      while (mergedConfig.intervalosDias.length < mergedConfig.niveis) {
        const lastVal =
          mergedConfig.intervalosDias[mergedConfig.intervalosDias.length - 1] ||
          0;
        mergedConfig.intervalosDias.push(lastVal + 1);
      }

      // Ajusta midiaPorNivel
      mergedConfig.midiaPorNivel = Array.isArray(mergedConfig.midiaPorNivel)
        ? mergedConfig.midiaPorNivel.slice(0, mergedConfig.niveis)
        : [];
      while (mergedConfig.midiaPorNivel.length < mergedConfig.niveis) {
        mergedConfig.midiaPorNivel.push({ ativado: false, arquivos: [], tipos: [] });
      }
      // Garante que cada item em midiaPorNivel tenha a estrutura completa
      mergedConfig.midiaPorNivel = mergedConfig.midiaPorNivel.map(item => ({
        ativado: item.ativado || false,
        arquivos: item.arquivos || [],
        tipos: item.tipos || [],
      }));

      setConfig(mergedConfig);
      console.log('[FollowUpConfigModal JS] Config loaded:', mergedConfig);
    } catch (err) {
      console.error('Erro ao buscar configuração de follow-up:', err);
      setError(
        `Erro ao carregar configuração: ${err.message}. Usando valores padrão.`
      );
      setConfig(defaultConfig); // Carrega padrão em caso de erro
    } finally {
      setIsLoading(false);
    }
  }, [clientId]); // Depende de clientId

  // Busca config quando o modal abre
  useEffect(() => {
    // Adiciona verificação explícita para clientId
    if (isOpen && clientId) {
      fetchConfig();
    }
  }, [isOpen, fetchConfig, clientId]);

  // Handler genérico para inputs, selects e checkboxes/switches
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith('intervalosDias-')) {
      const index = parseInt(name.split('-')[1], 10);
      const newIntervalos = [...config.intervalosDias];
      newIntervalos[index] = parseInt(value, 10) || 0;
      setConfig((prev) => ({ ...prev, intervalosDias: newIntervalos }));
    } else if (name.startsWith('promptsPorNivel-')) {
      const index = parseInt(name.split('-')[1], 10);
      const newPrompts = [...config.promptsPorNivel];
      newPrompts[index] = value;
      setConfig((prev) => ({ ...prev, promptsPorNivel: newPrompts }));
    } else {
      const newValue = type === 'checkbox' ? checked : value;
      setConfig((prev) => ({
        ...prev,
        [name]:
          name === 'niveis' || name === 'diasRecorrencia'
            ? parseInt(newValue, 10) || 0
            : newValue, // Converte números
      }));
    }

    // Ajusta os arrays de promptsPorNivel e intervalosDias se o número de níveis mudar
    if (name === 'niveis') {
      const newNiveis = parseInt(value, 10) || 1;
      setConfig((prev) => {
        const currentPrompts = prev.promptsPorNivel || [];
        const currentIntervals = prev.intervalosDias || [];
        const newPrompts = currentPrompts.slice(0, newNiveis);
        const newIntervals = currentIntervals.slice(0, newNiveis);

        while (newPrompts.length < newNiveis) newPrompts.push('');
        while (newIntervals.length < newNiveis) {
          const lastVal = newIntervals[newIntervals.length - 1] || 0;
          newIntervals.push(lastVal + 1);
        }

        // Ajusta midiaPorNivel
        const currentMidia = prev.midiaPorNivel || [];
        const newMidia = currentMidia.slice(0, newNiveis);
        while (newMidia.length < newNiveis) {
          newMidia.push({ ativado: false, arquivos: [], tipos: [] });
        }
        
        return {
          ...prev,
          niveis: newNiveis,
          promptsPorNivel: newPrompts,
          intervalosDias: newIntervals,
          midiaPorNivel: newMidia,
        };
      });
    }
  };

  // Handler para o checkbox de mídia por nível
  const handleChangeMedia = (e) => {
    const { name, checked } = e.target;
    const index = parseInt(name.split('-')[1], 10); // Extrai o índice do nome

    setConfig((prev) => {
      const newMidiaPorNivel = [...prev.midiaPorNivel];
      newMidiaPorNivel[index] = {
        ...newMidiaPorNivel[index],
        ativado: checked,
      };
      return { ...prev, midiaPorNivel: newMidiaPorNivel };
    });
  };

  // Handler para upload de arquivos de mídia
  const handleFileUpload = async (e, levelIndex) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('clientId', clientId);
    // Usar um nome genérico para o gatilho, ou um nome específico para follow-up
    // Por simplicidade, vou usar 'followup-media' como nome do gatilho para o upload
    formData.append('gatilhoNome', `followup-nivel-${levelIndex + 1}`);
    // O tipo de mídia será determinado no backend, mas podemos enviar um genérico se necessário
    formData.append('tipoMidia', 'varios'); // Indica que pode ser vários tipos

    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload-gatilho-media', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload da mídia');
      }

      console.log('Upload de mídia bem-sucedido:', data);

      // Atualiza o estado com os novos arquivos e seus tipos
      setConfig((prev) => {
        const newMidiaPorNivel = [...prev.midiaPorNivel];
        const currentMedia = newMidiaPorNivel[levelIndex] || { ativado: false, arquivos: [], tipos: [] };

        // Adiciona os novos arquivos e tipos, evitando duplicatas se o mesmo arquivo for selecionado novamente
        const updatedArquivos = [...currentMedia.arquivos];
        const updatedTipos = [...currentMedia.tipos];

        data.uploadedFilePaths.forEach((filePath, idx) => {
          if (!updatedArquivos.includes(filePath)) {
            updatedArquivos.push(filePath);
            updatedTipos.push(data.uploadedFileTypes[idx] || 'other'); // Agora o backend retorna uploadedFileTypes
          }
        });
        
        newMidiaPorNivel[levelIndex] = {
          ...currentMedia,
          arquivos: updatedArquivos,
          tipos: updatedTipos,
        };
        return { ...prev, midiaPorNivel: newMidiaPorNivel };
      });
    } catch (err) {
      console.error('Erro no upload de mídia:', err);
      setError(`Erro no upload de mídia: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para remover um arquivo de mídia
  const handleRemoveMedia = (levelIndex, fileIndex) => {
    setConfig((prev) => {
      const newMidiaPorNivel = [...prev.midiaPorNivel];
      const currentMedia = newMidiaPorNivel[levelIndex];

      if (currentMedia) {
        const updatedArquivos = currentMedia.arquivos.filter((_, idx) => idx !== fileIndex);
        const updatedTipos = currentMedia.tipos.filter((_, idx) => idx !== fileIndex);

        newMidiaPorNivel[levelIndex] = {
          ...currentMedia,
          arquivos: updatedArquivos,
          tipos: updatedTipos,
        };
      }
      return { ...prev, midiaPorNivel: newMidiaPorNivel };
    });
  };

  // Handler para salvar
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Garante que os valores numéricos sejam números
      const configToSave = {
        ...config,
        niveis: parseInt(config.niveis, 10) || 5,
        diasRecorrencia: parseInt(config.diasRecorrencia, 10) || 30,
        intervalosDias: config.intervalosDias.map((d) => parseInt(d, 10) || 1),
      };

      // Extrai tipo e nome para enviar separados (se necessário, mas POST geralmente usa body)
      // A API POST atual ainda lê do searchParams, então vamos manter a URL por enquanto
      // Se a API POST for alterada para ler do body, esta parte precisará mudar.
      const folderType = clientId.split('/')[0];
      const clientName = clientId.substring(clientId.indexOf('/') + 1);
      const response = await fetch('/api/followup-config', {
        method: 'PUT', // Alterado para PUT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...configToSave }), // Adicionar clientId
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar configuração');
      }
      console.log('Configuração de Follow-up salva:', result.message);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar configuração de follow-up:', err);
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Opções para o select de níveis
  const nivelOptions = Array.from({ length: 10 }, (_, i) => i + 1);

  if (!isOpen) return null;

  return (
    // Usa classes CSS similares ao RegrasDisparoModal
    <div className="modal-overlay regras-modal-overlay">
      <div className="modal-content regras-modal-content">
        <div className="modal-header">
          <h2>Configuração de Follow-up ({clientId})</h2>
          <button
            onClick={onClose}
            className="close-button"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {isLoading && !Object.keys(config).length ? (
          <p>Carregando configuração...</p>
        ) : (
          <div className="form-content">
            {/* Ativar Follow-up */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="ativo"
                  checked={config.ativo || false}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                Ativar Follow-ups Automáticos
              </label>
            </div>

            {/* Número de Níveis */}
            <div className="form-group">
              <label htmlFor="followup-niveis">Número de Níveis (1-10)</label>
              <select
                id="followup-niveis"
                name="niveis"
                value={config.niveis || 5}
                onChange={handleChange}
                className="form-input"
                disabled={isLoading}
              >
                {nivelOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Prompt Geral vs Individual */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="promptGeral"
                  checked={config.promptGeral || false}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                Usar Prompt Geral (vs. por nível)
              </label>
            </div>

            {/* Inputs de Prompt */}
            {config.promptGeral ? (
              <div className="form-group">
                <label htmlFor="followup-prompt">Prompt Geral</label>
                <textarea
                  id="followup-prompt"
                  name="prompt"
                  value={config.prompt || ''}
                  onChange={handleChange}
                  className="form-input"
                  rows="3"
                  disabled={isLoading}
                  placeholder="Prompt usado para todos os níveis. Use {conversationHistory} para histórico."
                />
                <p className="input-description">
                  Prompt usado para todos os níveis. Use{' '}
                  {'{conversationHistory}'} para histórico.
                </p>
              </div>
            ) : (
              Array.from({ length: config.niveis || 0 }).map((_, index) => (
                <div key={`prompt-${index}`} className="form-group">
                  <label htmlFor={`followup-prompt-${index}`}>
                    Prompt Nível {index + 1}
                  </label>
                  <textarea
                    id={`followup-prompt-${index}`}
                    name={`promptsPorNivel-${index}`}
                    value={config.promptsPorNivel?.[index] || ''}
                    onChange={handleChange}
                    className="form-input"
                    rows="2"
                    disabled={isLoading}
                    placeholder={`Prompt para o nível ${index + 1}.`}
                  />
                  <p className="input-description">
                    Use {'{conversationHistory}'} para histórico.
                  </p>

                  {/* Seção de Mídia por Nível */}
                  <div className="media-section-per-level">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name={`midiaPorNivel-${index}`}
                        checked={config.midiaPorNivel?.[index]?.ativado || false}
                        onChange={handleChangeMedia}
                        disabled={isLoading}
                      />
                      Ativar Envio de Mídia
                    </label>

                    {config.midiaPorNivel?.[index]?.ativado && (
                      <div className="media-upload-area">
                        <p className="media-label">Mídia:</p>
                        <label htmlFor={`media-upload-${index}`} className="upload-button">
                          Selecionar Arquivo(s)
                          <input
                            type="file"
                            id={`media-upload-${index}`}
                            name={`media-upload-${index}`}
                            multiple
                            onChange={(e) => handleFileUpload(e, index)}
                            disabled={isLoading}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {config.midiaPorNivel?.[index]?.arquivos?.length > 0 && (
                          <ul className="media-list">
                            {config.midiaPorNivel[index].arquivos.map((file, fileIndex) => (
                              <li key={fileIndex} className="media-item">
                                <span>{file.split('/').pop()} ({config.midiaPorNivel[index].tipos[fileIndex]})</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedia(index, fileIndex)}
                                  disabled={isLoading}
                                  className="remove-media-button"
                                >
                                  Remover
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Prompt de Análise */}
            <div className="form-group">
              <label htmlFor="followup-prompt-analise">
                Prompt de Análise (Opcional)
              </label>
              <textarea
                id="followup-prompt-analise"
                name="promptAnalise"
                value={config.promptAnalise || ''}
                onChange={handleChange}
                className="form-input"
                rows="3"
                disabled={isLoading}
                placeholder="Prompt para a IA decidir se inicia o follow-up. Resposta esperada: SIM ou NAO. Use {conversationHistory} para histórico."
              />
              <p className="input-description">
                Prompt para a IA decidir se inicia o follow-up. Resposta esperada: SIM
                ou NAO. Use {'{conversationHistory}'} para histórico.
              </p>
            </div>

            {/* Intervalos */}
            <h3 className="section-subtitle">
              Intervalos (dias após última interação)
            </h3>
            {Array.from({ length: config.niveis || 0 }).map((_, index) => (
              <div key={`intervalo-${index}`} className="form-group">
                <label htmlFor={`followup-intervalo-${index}`}>
                  Intervalo Nível {index + 1} (dias)
                </label>
                <input
                  type="number"
                  id={`followup-intervalo-${index}`}
                  name={`intervalosDias-${index}`}
                  value={config.intervalosDias?.[index] || ''}
                  onChange={handleChange}
                  className="form-input"
                  min="1"
                  disabled={isLoading}
                />
              </div>
            ))}

            {/* Recorrência */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="recorrencia"
                  checked={config.recorrencia || false}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                Ativar Recorrência (após último nível)
              </label>
            </div>
            {config.recorrencia && (
              <div className="form-group">
                <label htmlFor="followup-dias-recorrencia">
                  Intervalo Recorrência (dias)
                </label>
                <input
                  type="number"
                  id="followup-dias-recorrencia"
                  name="diasRecorrencia"
                  value={config.diasRecorrencia || ''}
                  onChange={handleChange}
                  className="form-input"
                  min="1"
                  disabled={isLoading}
                />
                <p className="input-description">
                  Dias após o último follow-up para reiniciar o ciclo.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="button-bar">
          <button
            onClick={onClose}
            className="cancel-button"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="save-button"
            disabled={isLoading}
          >
            {isLoading ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>

      {/* Estilos copiados e adaptados de RegrasDisparoModal */}
      <style jsx>{`
        .regras-modal-overlay {
          /* Reutilizando nome para consistência, mas é o overlay do FollowUp */
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1100; /* Mesmo z-index ou maior que o EditClientModal */
          padding: 20px;
        }
        .regras-modal-content {
          /* Reutilizando nome */
          background: white;
          color: #333; /* Cor de texto padrão */
          padding: 25px;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 15px;
          margin-bottom: 20px;
          border-bottom: 1px solid #dee2e6;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.3rem;
          color: #343a40;
        }
        .close-button {
          background: none;
          border: none;
          font-size: 2rem;
          cursor: pointer;
          color: #6c757d;
          padding: 0 5px;
          line-height: 1;
        }
        .close-button:hover {
          color: #343a40;
        }
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          padding: 12px 18px;
          border-radius: 5px;
          margin-bottom: 20px;
          font-size: 0.95rem;
        }
        .form-content {
          flex-grow: 1;
          overflow-y: auto;
          padding: 10px;
          margin-bottom: 20px;
          scrollbar-width: thin;
          scrollbar-color: #adb5bd #f8f9fa;
        }
        .form-content::-webkit-scrollbar {
          width: 8px;
        }
        .form-content::-webkit-scrollbar-track {
          background: #f1f3f5;
          border-radius: 4px;
        }
        .form-content::-webkit-scrollbar-thumb {
          background-color: #adb5bd;
          border-radius: 4px;
        }
        .form-group {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e9ecef;
        }
        .form-group:last-child {
          border-bottom: none;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          font-size: 1rem;
          color: #495057;
        }
        .form-input,
        textarea.form-input {
          /* Estilo unificado */
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
          box-sizing: border-box;
          background-color: #fff;
          line-height: 1.5;
        }
        textarea.form-input {
          resize: vertical;
          min-height: 60px;
        }
        .form-input:focus,
        textarea.form-input:focus {
          border-color: #80bdff;
          outline: 0;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        select.form-input {
          height: calc(1.5em + 20px + 2px);
          appearance: none;
          background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007bff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
          background-repeat: no-repeat;
          background-position: right 1rem center;
          background-size: 0.65em auto;
          padding-right: 2.5rem;
        }
        .input-description {
          font-size: 0.85rem;
          color: #6c757d;
          margin-top: 6px;
          margin-bottom: 0;
        }
        .checkbox-label {
          /* Estilo para label de checkbox */
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: normal;
          font-size: 1rem;
          cursor: pointer;
        }
        .checkbox-label input[type='checkbox'] {
          cursor: pointer;
          margin: 0;
          width: 17px;
          height: 17px;
        }
        .section-subtitle {
          /* Estilo para subtítulos como "Intervalos" */
          font-size: 1.1rem;
          font-weight: 600;
          color: #495057;
          margin-top: 25px;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e9ecef;
        }
        .button-bar {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }
        .button-bar button {
          padding: 12px 25px;
          border-radius: 5px;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition:
            background-color 0.2s ease,
            transform 0.1s ease;
        }
        .button-bar button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .cancel-button {
          background-color: #6c757d;
        }
        .cancel-button:hover {
          background-color: #5a6268;
        }
        .save-button {
          background-color: #28a745;
        }
        .save-button:hover {
          background-color: #218838;
        }
        .save-button:disabled,
        .cancel-button:disabled {
          background-color: #adb5bd;
          cursor: not-allowed;
          transform: none;
        }

        /* Estilos para a nova seção de mídia */
        .media-section-per-level {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed #e9ecef;
        }

        .media-label {
          font-weight: 600;
          margin-bottom: 8px;
          color: #495057;
          font-size: 0.95rem;
        }

        .media-upload-area {
          margin-top: 10px;
          padding: 15px;
          border: 1px dashed #ced4da;
          border-radius: 5px;
          background-color: #f8f9fa;
          text-align: center;
        }

        .upload-button {
          display: inline-block;
          background-color: #007bff;
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s ease;
        }

        .upload-button:hover {
          background-color: #0056b3;
        }

        .media-list {
          list-style: none;
          padding: 0;
          margin-top: 15px;
          text-align: left;
        }

        .media-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #e9ecef;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .media-item span {
          flex-grow: 1;
          word-break: break-all;
          margin-right: 10px;
        }

        .remove-media-button {
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: background-color 0.2s ease;
        }

        .remove-media-button:hover {
          background-color: #c82333;
        }

        /* --- Media Queries para Responsividade --- */

        @media (max-width: 768px) {
          .regras-modal-content {
            /* Ajusta padding geral */
            padding: 20px;
          }
          .modal-header h2 {
            font-size: 1.2rem;
          }
          .form-group label {
            font-size: 0.95rem;
          }
          .form-input,
          textarea.form-input {
            padding: 8px 12px;
            font-size: 0.95rem;
          }
          .input-description {
            font-size: 0.8rem;
          }
          .button-bar {
            flex-direction: column; /* Empilha botões */
            align-items: stretch; /* Faz botões ocuparem largura */
            gap: 10px;
          }
          .button-bar button {
            padding: 10px 20px;
            font-size: 0.95rem;
          }
        }

        @media (max-width: 480px) {
          .regras-modal-content {
            padding: 15px;
          }
          .modal-header h2 {
            font-size: 1.1rem;
          }
          .form-group label {
            font-size: 0.9rem;
          }
          .form-input,
          textarea.form-input {
            padding: 8px 10px;
            font-size: 0.9rem;
          }
          .checkbox-label {
            font-size: 0.9rem;
            gap: 8px;
          }
          .checkbox-label input[type='checkbox'] {
            width: 15px;
            height: 15px;
          }
          .button-bar button {
            padding: 10px 15px;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}
