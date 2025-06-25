'use client';

import { useState, useEffect } from 'react';

export default function EditClientModal({ isOpen, onClose, clientId, onSave }) {
  const [formData, setFormData] = useState({
    CLIENTE: '',
    STATUS: '',
    AI_SELECTED: '',
    GEMINI_KEY: '',
    GEMINI_KEY_BG: '',
    GEMINI_KEY_AQ: '',
    GEMINI_KEY_CHAT: '',
    GEMINI_KEY_RESERVA: '',
    TARGET_CHAT_ID: '',
    AQ_PROMPT: '',
    GEMINI_PROMPT: '',
    GEMINI_LINK: '',
    NAME_PROMPT: '',
    INTEREST_PROMPT: '',
    ORCAMENTO_PROMPT: '',
    SUMMARY_PROMPT: '',
    POMPT_PROSPEC: '',
    POMPT_REMARKETING: '',
    POMPT_ATIVOS: '',
    POMPT_CANCELADOS: '',
    POMPT_DESISTENCIA: '',
    AUDIO_FILE_PATH: '',
  });

  useEffect(() => {
    if (isOpen && clientId) {
      // Fetch current .env content
      fetch(`/api/client-config?clientId=${encodeURIComponent(clientId)}`)
        .then((res) => res.json())
        .then((data) => {
          setFormData(data);
        })
        .catch((err) => console.error('Error loading client config:', err));
    }
  }, [isOpen, clientId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/save-client-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          config: formData,
        }),
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Editar Configuração do Cliente</h2>
        <form onSubmit={handleSubmit}>
          {Object.entries(formData).map(([key, value]) => (
            <div key={key} className="form-group">
              <label htmlFor={key}>{key}</label>
              <input
                type="text"
                id={key}
                name={key}
                value={value}
                onChange={handleChange}
              />
            </div>
          ))}
          <div className="button-group">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancelar
            </button>
            <button type="submit" className="save-button">
              Salvar
            </button>
          </div>
        </form>
      </div>

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
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 10px;
          max-width: 800px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .button-group {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .save-button {
          background: #00b894;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .save-button:hover {
          background: #00a383;
        }

        .cancel-button {
          background: #636e72;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .cancel-button:hover {
          background: #535c60;
        }
      `}</style>
    </div>
  );
}
