'use client';

import { useState, useEffect } from 'react';
// Não precisamos mais importar styles de DuplicateCheckModal, usaremos CSS-in-JS

export default function NovoClienteConfigModal({ isOpen, onClose, envData, onSave }) {
  const [config, setConfig] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[NovoClienteConfigModal] Prop envData recebida:', envData);
    if (envData && typeof envData === 'object') {
      setConfig(prevConfig => ({
        ...prevConfig, // Mantém estado anterior se necessário
        ...envData, // Sobrescreve com novos dados
        GEMINI_PROMPT: Array.isArray(envData.GEMINI_PROMPT) ? envData.GEMINI_PROMPT : (envData.GEMINI_PROMPT ? [{ "Prompt Principal": envData.GEMINI_PROMPT }] : []), // Garante que GEMINI_PROMPT é um array
      }));
      console.log('[NovoClienteConfigModal] Estado config atualizado:', envData);
    } else {
      console.log('[NovoClienteConfigModal] envData inválido ou não é objeto, resetando config.');
      setConfig({});
    }
  }, [envData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  }; // Mantido para campos não-GEMINI_PROMPT

  // Nova função para lidar com mudanças nos campos dentro de GEMINI_PROMPT
  const handleGeminiPromptChange = (index, key, value) => {
    setConfig(prev => {
      const newGeminiPrompt = [...prev.GEMINI_PROMPT];
      if (newGeminiPrompt[index]) {
        newGeminiPrompt[index] = {
          ...newGeminiPrompt[index],
          [key]: value
        };
      }
      return { ...prev, GEMINI_PROMPT: newGeminiPrompt };
    });
  };

  const handleSalvar = async () => {
    console.log('[NovoClienteConfigModal] handleSalvar chamado. Config atual:', config);
    setIsLoading(true);
    setError('');
    try {
      await onSave(config);
    } catch (err) {
      console.error("[NovoClienteConfigModal] Erro ao chamar onSave:", err);
      setError(err.message || 'Erro ao salvar. Verifique o console.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  console.log('[NovoClienteConfigModal] Renderizando. Estado config:', config);
  const configKeys = Object.keys(config || {});

  return (
    // Reutiliza a estrutura e classes do EditClientModal
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          {/* Título ajustado para a Etapa 2 */}
          <h2>Etapa 2: Configure o Cliente</h2>
          <p className="modal-description">
            Ajuste as configurações carregadas do arquivo .env do cliente.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Formulário para os campos do .env */}
        <div className="form-content"> {/* Adiciona scroll se necessário */}
          {configKeys.length === 0 && !isLoading && (
            <p>Nenhuma configuração encontrada no arquivo .env ou o arquivo está sendo carregado.</p>
          )}

          {configKeys
            .filter(key => key !== 'CLIENTE') // Adicionado filtro para 'CLIENTE'
            .map((key) => (
              <div className="form-group" key={key}> {/* Reutiliza classe form-group */}
                {key === 'GEMINI_PROMPT' ? (
                  // Renderiza campos para cada item dentro do array GEMINI_PROMPT
                  <div>
                    <label>{key}</label>
                    {Array.isArray(config[key]) && config[key].map((promptItem, index) => (
                      <div key={index} className="gemini-prompt-item"> {/* Nova classe para itens do array */}
                        {Object.entries(promptItem).map(([promptKey, promptValue]) => (
                          <div key={promptKey} className="form-group-inner"> {/* Nova classe para campos internos */}
                            <label htmlFor={`gemini-prompt-${index}-${promptKey}`}>{promptKey}</label>
                            <textarea
                              id={`gemini-prompt-${index}-${promptKey}`}
                              name={`gemini-prompt-${index}-${promptKey}`}
                              value={promptValue}
                              onChange={(e) => handleGeminiPromptChange(index, promptKey, e.target.value)}
                              rows={6} // Define um número de linhas padrão para os campos do prompt
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Renderiza campos normais para outros campos
                  <>
                    <label htmlFor={key}>{key}</label> {/* Reutiliza estilo de label */}
                    <textarea // Usar textarea para campos potencialmente longos
                      id={key} name={key} value={config[key] || ''} onChange={handleChange} rows={3} // Ajuste conforme necessário
                    />
                  </>
                )}
              </div>
            ))}
        </div>

        {/* Barra de botões */}
        <div className="button-bar"> {/* Reutiliza classe button-bar */}
          <div className="left-buttons"> {/* Mantém estrutura para possível expansão */}
             {/* Espaço para botões à esquerda, se necessário no futuro */}
          </div>
          <div className="right-buttons"> {/* Reutiliza classe right-buttons */}
            <button type="button" onClick={onClose} className="cancel-button"> {/* Reutiliza classe cancel-button */}
              Voltar
            </button>
            <button
              type="button" // Não é submit de form aqui
              onClick={handleSalvar}
              className="save-button" // Reutiliza classe save-button
              disabled={isLoading}
            >
              {isLoading ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </div>
      </div>

      {/* Estilos JSX copiados e adaptados do EditClientModal */}
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1100;
          animation: fadeIn 0.3s ease;
          padding: 20px;
          backdrop-filter: blur(2px);
        }

        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 12px;
          width: 90%;
          max-width: 800px; /* Ajustado para talvez ser um pouco menor que o edit */
          height: 85vh; /* Ajustado */
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
          animation: slideIn 0.3s ease;
        }

        .modal-header {
          flex-shrink: 0;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header h2 {
          margin: 0 0 10px 0;
          color: #2d3436;
        }

        .modal-description {
          margin: 0;
          color: #868e96;
          font-size: 14px;
        }

        .error-message {
          flex-shrink: 0;
          margin: 0 0 20px;
          padding: 12px;
          border-radius: 6px;
          background-color: #fff5f5;
          color: #c92a2a;
          font-size: 14px;
          border: 1px solid #ffc9c9;
        }

        /* Ajuste para remover o form e usar div */
        .form-content {
          flex: 1;
          overflow-y: auto;
          padding-right: 8px; /* Espaço para scrollbar */
          margin-bottom: 20px; /* Espaço antes da barra de botões */
          min-height: 0; /* Necessário para flexbox com overflow */
        }

        /* Estilos do Scrollbar */
        .form-content::-webkit-scrollbar {
          width: 8px;
        }
        .form-content::-webkit-scrollbar-track {
          background: #f1f3f5;
          border-radius: 4px;
        }
        .form-content::-webkit-scrollbar-thumb {
          background-color: #00b894; /* Cor do tema */
          border-radius: 4px;
          border: 2px solid #f1f3f5;
        }

        .form-group {
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 6px;
          background: #f8f9fa;
          position: relative; /* Necessário para o pseudo-elemento */
        }
        .form-group:hover {
          background: #f1f3f5;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2d3436;
          font-size: 14px;
        }
        /* Estilo para textarea (preferível para valores .env) */
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical; /* Permite redimensionar verticalmente */
          min-height: 36px; /* Altura mínima */
          line-height: 1.5;
          box-sizing: border-box; /* Garante que padding não aumente o tamanho total */
        }
        .form-group textarea:focus {
          outline: none;
          border-color: #00b894;
          box-shadow: 0 0 0 2px rgba(0, 184, 148, 0.1);
        }

        /* Estilos específicos para os campos dentro de GEMINI_PROMPT */
        .gemini-prompt-item {
          margin-bottom: 15px; /* Espaço entre os objetos do array */
          padding: 10px;
          border: 1px dashed #ccc; /* Borda tracejada para separar visualmente */
          border-radius: 4px;
          background-color: #e9ecef; /* Fundo levemente diferente */
        }

        .form-group-inner {
          margin-bottom: 15px; /* Espaço entre os campos dentro de um objeto */
        }

        .form-group-inner:last-child {
          margin-bottom: 0; /* Remove margem do último campo interno */
        }

        .form-group-inner label {
          font-weight: 500; /* Fonte um pouco menos negrito */
          font-size: 13px; /* Fonte menor */
          color: #495057;
        }

        .form-group-inner textarea {
          min-height: 80px; /* Altura mínima maior para campos de prompt */
        }

        .button-bar {
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center; /* Alinha verticalmente os botões */
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        .left-buttons,
        .right-buttons {
          display: flex;
          gap: 10px;
        }
        .button-bar button {
          padding: 12px 24px;
          border-radius: 6px;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s ease;
        }
        .save-button {
          background: #00b894;
        }
        .save-button:disabled {
          background: #a0a0a0;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }
        .save-button:hover:not(:disabled) {
          background: #00a383;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .cancel-button {
          background: #636e72;
        }
        .cancel-button:hover {
          background: #535c60;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        /* Media Queries copiadas do EditClientModal */
        @media (max-width: 768px) {
          .modal-content {
            max-width: 95%;
            padding: 15px;
            height: 90vh; /* Aumenta um pouco a altura em telas menores */
          }
          .button-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 15px;
          }
          .left-buttons,
          .right-buttons {
            justify-content: center;
            flex-wrap: wrap;
          }
          .button-bar button {
            padding: 10px 15px;
            font-size: 14px;
          }
        }
        @media (max-width: 480px) {
          .modal-header h2 {
            font-size: 1.2rem;
          }
          .modal-description {
            font-size: 12px;
          }
          .form-group {
            padding: 10px;
          }
          .form-group label {
            font-size: 13px;
          }
          .form-group textarea { /* Ajustado para textarea */
            font-size: 13px;
          }
          .button-bar button {
            padding: 8px 12px;
            font-size: 13px;
          }
          .left-buttons,
          .right-buttons {
            gap: 8px;
          }
        }

        /* Keyframes para animações */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}