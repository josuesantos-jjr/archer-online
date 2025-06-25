'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function BlockedNumbersModal({ isOpen, onClose, clientId, clienteSequencialId }) {
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [newNumber, setNewNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Função para buscar os números bloqueados
  const fetchBlockedNumbers = useCallback(async () => {
    if (!clientId || !isOpen) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null); // Limpa mensagens anteriores
    try {
      const response = await axios.get(
        `/api/blocked-numbers?clientId=${encodeURIComponent(clientId)}`
      );
      setBlockedNumbers(response.data.blockedNumbers || []);
    } catch (err) {
      console.error('Erro ao buscar números bloqueados:', err);
      setError(
        `Erro ao carregar números: ${err.response?.data?.error || err.message}`
      );
      setBlockedNumbers([]); // Garante que a lista esteja vazia em caso de erro
    } finally {
      setLoading(false);
    }
  }, [clientId, isOpen]);

  // Busca os números quando o modal abre
  useEffect(() => {
    fetchBlockedNumbers();
  }, [fetchBlockedNumbers]); // Depende da função memoizada

  // Limpa o estado ao fechar
  useEffect(() => {
    if (!isOpen) {
      setBlockedNumbers([]);
      setNewNumber('');
      setError(null);
      setSuccessMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Handler para adicionar número
  const handleAddNumber = async (e) => {
    e.preventDefault(); // Previne recarregamento da página se estiver dentro de um form
    if (!newNumber.trim()) {
      setError('Por favor, insira um número válido.');
      return;
    }
    // Validação simples de número (apenas dígitos e talvez +)
    if (!/^\+?\d+$/.test(newNumber.trim())) {
      setError(
        "Formato de número inválido. Use apenas dígitos e opcionalmente '+' no início."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await axios.post('/api/blocked-numbers', {
        clientId,
        clienteSequencialId, // Adicionar ID sequencial
        number: newNumber.trim(),
      });
      setBlockedNumbers(response.data.blockedNumbers || []);
      setNewNumber(''); // Limpa o input
      setSuccessMessage(`Número ${newNumber.trim()} adicionado com sucesso!`);
    } catch (err) {
      console.error('Erro ao adicionar número:', err);
      setError(
        `Erro ao adicionar: ${err.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Handler para remover número
  const handleDeleteNumber = async (numberToDelete) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover o número ${numberToDelete} da lista de bloqueio?`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await axios.delete('/api/blocked-numbers', {
        data: { clientId, clienteSequencialId, number: numberToDelete }, // Adicionar ID sequencial
      });
      setBlockedNumbers(response.data.blockedNumbers || []);
      setSuccessMessage(`Número ${numberToDelete} removido com sucesso!`);
    } catch (err) {
      console.error('Erro ao remover número:', err);
      setError(`Erro ao remover: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler para excluir toda a lista
  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        `ATENÇÃO: Tem certeza que deseja EXCLUIR TODOS os números bloqueados para ${clientId}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await axios.delete('/api/blocked-numbers', {
        data: { clientId, clienteSequencialId, deleteAll: true }, // Adicionar ID sequencial
      });
      setBlockedNumbers([]);
      setSuccessMessage(
        `Todos os números bloqueados foram removidos para ${clientId}.`
      );
    } catch (err) {
      console.error('Erro ao excluir todos os números:', err);
      setError(
        `Erro ao excluir lista: ${err.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay blocked-numbers-overlay">
      <div className="modal-content blocked-numbers-content">
        <div className="modal-header">
          <h2>Gerenciar Números Bloqueados ({clientId})</h2>
          <button onClick={onClose} className="close-button" disabled={loading}>
            ×
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <form onSubmit={handleAddNumber} className="add-number-form">
          <input
            type="text"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="Digite o número a bloquear (ex: 5511999998888)"
            className="form-input"
            disabled={loading}
          />
          <button
            type="submit"
            className="add-button"
            disabled={loading || !newNumber.trim()}
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>

        <div className="blocked-list-container">
          {loading && !blockedNumbers.length ? (
            <p>Carregando números...</p>
          ) : blockedNumbers.length === 0 ? (
            <p>Nenhum número bloqueado encontrado.</p>
          ) : (
            <ul className="blocked-list">
              {blockedNumbers.map((number) => (
                <li key={number} className="blocked-list-item">
                  <span>{number}</span>
                  <button
                    onClick={() => handleDeleteNumber(number)}
                    className="delete-button"
                    disabled={loading}
                    title={`Remover ${number}`}
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="button-bar">
          <button
            onClick={handleDeleteAll}
            className="delete-all-button"
            disabled={loading || blockedNumbers.length === 0}
          >
            Excluir Todos
          </button>
          <button
            onClick={onClose}
            className="cancel-button"
            disabled={loading}
          >
            Fechar
          </button>
        </div>
      </div>

      <style jsx>{`
        .blocked-numbers-overlay {
          z-index: 1100;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .blocked-numbers-content {
          background: white;
          padding: 25px;
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 15px;
          margin-bottom: 15px;
          border-bottom: 1px solid #eee;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.4rem;
          color: #333;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 1.8rem;
          cursor: pointer;
          color: #888;
          padding: 0 5px;
          line-height: 1;
        }

        .close-button:hover {
          color: #333;
        }

        .error-message,
        .success-message {
          padding: 10px 15px;
          margin-bottom: 15px;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .success-message {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .add-number-form {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .form-input {
          flex-grow: 1;
          padding: 10px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 1rem;
        }

        .form-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
        }

        .add-button {
          padding: 10px 20px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
          transition: background-color 0.2s;
        }

        .add-button:hover:not(:disabled) {
          background-color: #218838;
        }

        .add-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .blocked-list-container {
          flex-grow: 1;
          overflow-y: auto;
          margin-bottom: 20px;
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 10px;
          background-color: #f9f9f9;
          min-height: 150px;
        }

        .blocked-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .blocked-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
          background-color: #fff;
          margin-bottom: 5px;
          border-radius: 3px;
        }

        .blocked-list-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .blocked-list-item span {
          font-size: 1rem;
          color: #333;
        }

        .delete-button {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 2px 5px;
          line-height: 1;
        }

        .delete-button:hover {
          color: #a0202d;
        }

        .delete-button:disabled {
          color: #ccc;
          cursor: not-allowed;
        }

        .button-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }

        .button-bar button {
          padding: 10px 20px;
          border-radius: 4px;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1rem;
          transition:
            background-color 0.2s,
            transform 0.1s;
        }

        .button-bar button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .delete-all-button {
          background-color: #dc3545;
          margin-right: auto;
        }

        .delete-all-button:hover:not(:disabled) {
          background-color: #c82333;
        }

        .delete-all-button:disabled {
          background-color: #f1a7af;
          cursor: not-allowed;
        }

        .cancel-button {
          background-color: #6c757d;
        }

        .cancel-button:hover:not(:disabled) {
          background-color: #5a6268;
        }

        .cancel-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .blocked-numbers-content {
            padding: 20px;
            max-width: 90%;
          }

          .modal-header h2 {
            font-size: 1.2rem;
          }

          .form-input {
            padding: 8px 10px;
            font-size: 0.95rem;
          }

          .add-button {
            padding: 8px 16px;
            font-size: 0.95rem;
          }

          .blocked-list-item span {
            font-size: 0.95rem;
          }

          .delete-button {
            font-size: 1.1rem;
          }

          .button-bar button {
            padding: 8px 16px;
            font-size: 0.95rem;
          }
        }

        @media (max-width: 480px) {
          .blocked-numbers-content {
            padding: 15px;
            max-width: 95%;
          }

          .modal-header h2 {
            font-size: 1.1rem;
          }

          .add-number-form {
            flex-direction: column;
            gap: 8px;
          }

          .add-button {
            width: 100%;
          }

          .blocked-list-item {
            padding: 6px 10px;
          }

          .blocked-list-item span {
            font-size: 0.9rem;
            word-break: break-all;
          }

          .delete-button {
            font-size: 1rem;
            padding: 2px 4px;
          }

          .button-bar {
            flex-direction: column-reverse;
            align-items: stretch;
            gap: 10px;
          }

          .button-bar button {
            width: 100%;
          }

          .delete-all-button {
            margin-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
