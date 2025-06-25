'use client';

import { useState, useEffect } from 'react';
import ListasModal from './ListasModal.js';
import RegrasDisparoModal from './RegrasDisparoModal.js';
import FollowUpConfigModal from './FollowUpConfigModal.js'; 
import GatilhosConfigModal from './GatilhosConfigModal.js'; 

export default function EditClientModal({ isOpen, onClose, clientId, onSave }) {
  const [showListasModal, setShowListasModal] = useState(false);
  const [showRegrasModal, setShowRegrasModal] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false); 
  const [showGatilhosModal, setShowGatilhosModal] = useState(false); 
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({}); 

  useEffect(() => {
    setError(null);
    setLoading(false);

    if (isOpen && clientId) {
      fetch(`/api/client-config?clientId=${encodeURIComponent(clientId)}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            throw new Error(data.error);
          }
          setFormData(data);
        })
        .catch((err) => {
          console.error('Error loading client config:', err);
          setError('Erro ao carregar configuração do cliente: ' + err.message);
        });
    }
  }, [isOpen, clientId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev, 
      [name]: value, 
    }));
  };

  const handleGeminiPromptChange = (index, key, value) => {
    setFormData(prev => {
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

  const handleNestedChange = (parentKey, nestedKey) => (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [nestedKey]: value
      }
    }));
  };

  const handleArrayChange = (arrayKey, index, itemKey = null) => (e) => {
    const { value } = e.target;
    setFormData(prev => {
      const newArray = [...prev[arrayKey]];
      if (itemKey !== null) {
        newArray[index] = {
          ...newArray[index],
          [itemKey]: value
        };
      } else {
        newArray[index] = value;
      }
      return { ...prev, [arrayKey]: newArray };
    });
  };

  const handleToggleCollapse = (key) => {
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const [oldClientType, oldClientName] = clientId.split('/');
      const newClientName = formData.name; 

      if (oldClientName !== newClientName) {
        const renameResponse = await fetch('/api/client-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'rename',
            oldClientId: clientId, 
            newClientName: newClientName, 
          }),
        });

        const renameResult = await renameResponse.json();

        if (!renameResponse.ok) {
          throw new Error(renameResult.error || 'Erro ao renomear pasta do cliente');
        }
      } else {
        console.log('Client folder name not changed. Skipping rename operation.');
      }

      const saveConfigResponse = await fetch('/api/create-client-functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'salvarDadosNoEnv', 
          novoClienteId: clientId, 
          dados: formData, 
        }),
      });

      if (!saveConfigResponse.ok) {
        let errorDetail = `Erro HTTP: ${saveConfigResponse.status}`;

        try {
          const errorBody = await saveConfigResponse.text();
          errorDetail += ` - Detalhes: ${errorBody}`;
          console.error('Save config API error details:', errorBody);
        } catch (readError) {
          errorDetail += ' - Não foi possível ler detalhes do erro.';
        }

        if (saveConfigResponse.status === 405) {
           throw new Error(`Operação não permitida na API de configuração (${saveConfigResponse.status}). Verifique os logs do servidor.`);
        } else {
           throw new Error(`Erro ao salvar configurações do cliente: ${errorDetail}`);
        }
      }

      const saveConfigResult = await saveConfigResponse.json();
      console.log('Client config saved successfully:', saveConfigResult);

      onSave(clientId);
      onClose();

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Editar Configuração do Cliente</h2>
          <p className="modal-description">
            Todos os campos são redimensionáveis. Arraste o canto inferior
            direito para ajustar o tamanho.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-content">
            {Object.entries(formData)
              .filter(([key]) => key !== 'qr_code' && key !== 'GEMINI_LINK') 
              .map(([key, value]) => (
                <div className={`form-group ${typeof value === 'object' && value !== null && !Array.isArray(value) ? 'collapsible' : ''}`} key={key}>
                  {typeof value === 'object' && value !== null && !Array.isArray(value) ? (
                    <div className="form-group-header" onClick={() => handleToggleCollapse(key)}>
                      <label htmlFor={key}>{key}</label>
                      <span className={`collapse-icon ${collapsedSections[key] ? 'collapsed' : ''}`}>
                        {collapsedSections[key] ? '▲' : '▼'}
                      </span>
                    </div>
                  ) : (
                    <label htmlFor={key}>{key}</label>
                  )}

                  {typeof value === 'object' && value !== null && !Array.isArray(value) ? (
                    !collapsedSections[key] && (
                      <div className="nested-fields">
                        {Object.entries(value).map(([nestedKey, nestedValue]) => (
                          <div key={nestedKey} className="form-group-inner">
                            <label htmlFor={`${key}-${nestedKey}`}>{nestedKey}</label>
                            <textarea
                              id={`${key}-${nestedKey}`}
                              name={`${key}.${nestedKey}`}
                              value={nestedValue}
                              onChange={handleNestedChange(key, nestedKey)}
                              rows={6}
                            />
                          </div>
                        ))}
                      </div>
                    )
                  ) : Array.isArray(value) ? ( 
                    <div className="array-fields"> 
                      {value.map((item, index) => (
                        <div key={index} className="array-item"> 
                          {typeof item === 'object' && item !== null ? (
                            Object.entries(item).map(([itemKey, itemValue]) => (
                              <div key={itemKey} className="form-group-inner">
                                <label htmlFor={`${key}-${index}-${itemKey}`}>{itemKey}</label>
                                <textarea
                                  id={`${key}-${index}-${itemKey}`}
                                  name={`${key}.${index}.${itemKey}`} 
                                  value={itemValue}
                                  onChange={handleArrayChange(key, index, itemKey)} 
                                  rows={6}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="form-group-inner">
                              <label htmlFor={`${key}-${index}`}>{`Item ${index}`}</label>
                              <textarea
                                id={`${key}-${index}`}
                                name={`${key}.${index}`} 
                                value={item}
                                onChange={handleArrayChange(key, index)} 
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      id={key}
                      name={key}
                      value={value}
                      onChange={handleChange}
                      rows={['AQ_PROMPT'].includes(key) ? 6 : 2} 
                    />
                  )}
                </div>
              ))}
          </div>

          <div className="button-bar">
            <div className="left-buttons">
              <button
                type="button"
                onClick={() => setShowListasModal(true)}
                className="listas-button"
              >
                Listas
              </button>
              <button
                type="button"
                onClick={() => setShowRegrasModal(true)}
                className="regras-button"
              >
                Regras de Disparo
              </button>
              <button
                type="button"
                onClick={() => setIsFollowUpModalOpen(true)}
                className="followup-button" 
              >
                Editar FollowUp
              </button>
              <button
                type="button"
                onClick={() => setShowGatilhosModal(true)}
                className="gatilhos-button" 
              >
                Configurar Gatilhos
              </button>
            </div>
            <div className="right-buttons">
              <button type="button" onClick={onClose} className="cancel-button">
                Cancelar
              </button>
              <button type="submit" className="save-button" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ListasModal
        isOpen={showListasModal}
        onClose={() => setShowListasModal(false)}
        clientId={clientId}
        clienteSequencialId={formData.CLIENTE_ID} 
      />

      <RegrasDisparoModal
        isOpen={showRegrasModal}
        onClose={() => setShowRegrasModal(false)}
        clientId={clientId}
        clienteSequencialId={formData.CLIENTE_ID}
      />

      <FollowUpConfigModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        clientId={clientId}
        clienteSequencialId={formData.CLIENTE_ID}
      />

      <GatilhosConfigModal
        isOpen={showGatilhosModal}
        onClose={() => setShowGatilhosModal(false)}
        clientId={clientId}
        clienteSequencialId={formData.CLIENTE_ID}
      />

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
          padding: 20px;
          backdrop-filter: blur(2px);
        }

        .modal-content {
          background: white;
          padding: 20px; 
          border-radius: 12px;
          width: 90%;
          max-width: 1000px;
          height: 90vh;
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

        form {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .form-content {
          flex: 1;
          overflow-y: auto;
          padding-right: 8px;
          margin-bottom: 20px;
        }

        .form-content::-webkit-scrollbar {
          width: 8px;
        }

        .form-content::-webkit-scrollbar-track {
          background: #f1f3f5;
          border-radius: 4px;
        }

        .form-content::-webkit-scrollbar-thumb {
          background-color: #00b894;
          border-radius: 4px;
          border: 2px solid #f1f3f5;
        }

        .form-group {
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 6px;
          background: #f8f9fa;
          position: relative; 
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

        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          min-height: 36px;
          line-height: 1.5;
        }

        .form-group textarea:focus {
          outline: none;
          border-color: #00b894;
          box-shadow: 0 0 0 2px rgba(0, 184, 148, 0.1);
        }

        .form-group.collapsible {
          border: 1px dashed #ccc; 
          border-radius: 4px;
          background-color: #e9ecef; 
          padding: 0; 
          margin-bottom: 15px; 
        }

        .form-group.collapsible .form-group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px; 
          cursor: pointer;
          background-color: #dcdcdc; 
          border-bottom: 1px solid #ccc;
        }

        .form-group.collapsible .form-group-header label {
          margin-bottom: 0; 
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .form-group.collapsible .collapse-icon {
          font-size: 1.2rem;
          transition: transform 0.2s ease;
          color: #555; /* Cor para melhor visibilidade */
          position: relative;
          top: 2px; /* Ajuste fino no posicionamento vertical */
        }

        .form-group.collapsible .collapse-icon {
          transition: transform 0.2s ease;
        }

        .form-group.collapsible .collapse-icon.collapsed {
          transform: rotate(-90deg);
        }

        .form-group.collapsible .nested-fields {
          padding: 15px; 
        }

        .array-item {
          margin-bottom: 15px; 
          padding: 10px;
          border: 1px dashed #ccc; 
          border-radius: 4px;
          background-color: #f8f9fa; 
        }

        .array-item:last-child {
          margin-bottom: 0;
        }

        .form-group-inner {
          margin-bottom: 15px; 
        }

        .form-group-inner:last-child {
          margin-bottom: 0; 
        }

        .form-group-inner label {
          font-weight: 500; 
          font-size: 13px; 
          color: #495057;
        }

        .form-group-inner textarea {
          min-height: 80px; 
        }

        .button-bar {
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
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

        .listas-button {
          background: #0984e3;
        }

        .listas-button:hover {
          background: #0873c4;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .regras-button {
          background: #ff7f50; 
        }

        .regras-button:hover {
          background: #ff6347; 
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .followup-button {
          background: #6f42c1; 
        }

        .followup-button:hover {
          background: #5a32a3; 
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .gatilhos-button {
          background: #a29bfe; 
        }

        .gatilhos-button:hover {
          background: #6c5ce7; 
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

        @media (max-width: 768px) {
          .modal-content {
            max-width: 95%; 
            padding: 15px; 
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
          .form-group textarea {
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
      `}</style>
    </div>
  );
}
