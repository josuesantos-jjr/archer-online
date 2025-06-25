'use client';

import React from 'react';

export default function ContatoInfoPopup({ isOpen, onClose, contatoData }) {
  if (!isOpen || !contatoData) return null;

  // Dados de exemplo (substituir pelos dados reais de contatoData)
  const {
    nome = 'Nome do Contato',
    telefone = '(XX) XXXXX-XXXX',
    origem = 'Lista Exemplo', // ou "Contato Direto"
    statusFollowup = 'Nível 1', // ou "Sem Followup", "Concluído"
    demonstrouInteresse = true,
    isLead = true,
    momentoConversao = '2025-04-11 10:30',
    resumoIA = 'Resumo gerado pela IA sobre as interações e interesses do contato...',
  } = contatoData;

  const handleVerConversa = () => {
    // TODO: Implementar lógica para abrir histórico da conversa
    console.log('Abrir histórico da conversa para:', telefone);
    alert("Funcionalidade 'Ver Conversa' ainda não implementada.");
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>Detalhes do Contato</h3>
          <button onClick={onClose} className="close-button">
            &amp;times;
          </button>
        </div>
        <div className="popup-body">
          <div className="info-section">
            <strong>Nome:</strong> <span>{nome}</span>
          </div>
          <div className="info-section">
            <strong>Telefone:</strong> <span>{telefone}</span>
          </div>
          <div className="info-section">
            <strong>Origem:</strong> <span>{origem}</span>
          </div>
          <div className="info-section">
            <strong>Status Follow-up:</strong> <span>{statusFollowup}</span>
          </div>
          <div className="info-section">
            <strong>Demonstrou Interesse:</strong>{' '}
            <span>{demonstrouInteresse ? 'Sim' : 'Não'}</span>
          </div>
          <div className="info-section">
            <strong>É Lead:</strong> <span>{isLead ? 'Sim' : 'Não'}</span>
            {isLead && (
              <span className="conversion-time">
                {' '}
                (Convertido em: {momentoConversao})
              </span>
            )}
          </div>
          <div className="info-section summary-section">
            <strong>Resumo IA:</strong>
            <p>{resumoIA}</p>
          </div>
        </div>
        <div className="popup-footer">
          <button onClick={handleVerConversa} className="conversa-button">
            Ver Conversa
          </button>
          <button onClick={onClose} className="fechar-popup-button">
            Fechar
          </button>
        </div>
      </div>

      <style jsx>{`
        .popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(
            0,
            0,
            0,
            0.7
          ); /* Mais escuro para destacar popup */
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1050; /* Acima do modal principal */
        }
        .popup-content {
          background: white;
          padding: 20px 30px;
          border-radius: 8px;
          width: 90%;
          max-width: 600px; /* Tamanho adequado para detalhes */
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .popup-header h3 {
          margin: 0;
          font-size: 1.2rem;
          color: #333;
        }
        .close-button {
          background: none;
          border: none;
          font-size: 1.8rem;
          cursor: pointer;
          color: #aaa;
          padding: 0 5px;
        }
        .close-button:hover {
          color: #333;
        }
        .popup-body {
          overflow-y: auto;
          flex-grow: 1;
          margin-bottom: 20px;
        }
        .info-section {
          margin-bottom: 12px;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .info-section strong {
          color: #555;
          margin-right: 8px;
          display: inline-block;
          min-width: 150px; /* Alinhamento */
        }
        .info-section span,
        .info-section p {
          color: #333;
        }
        .summary-section p {
          margin-top: 5px;
          background-color: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          font-style: italic;
          color: #555;
        }
        .conversion-time {
          font-size: 0.85rem;
          color: #6c757d;
          margin-left: 5px;
        }
        .popup-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        .popup-footer button {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }
        .conversa-button {
          background-color: #17a2b8; /* Azul claro */
          color: white;
        }
        .conversa-button:hover {
          background-color: #138496;
        }
        .fechar-popup-button {
          background-color: #6c757d; /* Cinza */
          color: white;
        }
        .fechar-popup-button:hover {
          background-color: #5a6268;
        }

        /* --- Media Queries para Responsividade --- */

        @media (max-width: 768px) {
          .popup-content {
            padding: 15px 20px; /* Reduz padding */
            max-width: 90%;
          }
          .popup-header h3 {
            font-size: 1.1rem;
          }
          .info-section {
            font-size: 0.9rem;
          }
          .info-section strong {
            min-width: 120px; /* Reduz min-width */
          }
          .popup-footer {
            gap: 8px;
          }
          .popup-footer button {
            padding: 7px 14px;
            font-size: 0.85rem;
          }
        }

        @media (max-width: 480px) {
          .popup-content {
            padding: 10px 15px;
            max-width: 95%;
          }
          .popup-header h3 {
            font-size: 1rem;
          }
          .info-section strong {
            display: block; /* Empilha label e valor */
            min-width: auto; /* Remove min-width */
            margin-bottom: 3px; /* Espaço abaixo do label */
            color: #333; /* Deixa label um pouco mais escuro */
          }
          .info-section span,
          .info-section p {
            display: block; /* Garante que valor fique abaixo */
          }
          .summary-section p {
            padding: 8px;
            font-size: 0.9em;
          }
          .conversion-time {
            font-size: 0.8rem;
            display: block; /* Quebra linha */
            margin-left: 0;
            margin-top: 3px;
          }
          .popup-footer {
            flex-direction: column; /* Empilha botões */
            align-items: stretch; /* Estica botões */
          }
          .popup-footer button {
            width: 100%;
            padding: 8px 12px;
            font-size: 0.9rem; /* Aumenta um pouco para toque */
          }
        }
      `}</style>
    </div>
  );
}
