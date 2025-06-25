import React, { useState } from 'react';

const TerminalModal = ({ isOpen, onClose }) => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCommandChange = (e) => {
    setCommand(e.target.value);
  };

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;

    setIsLoading(true);
    setOutput(prevOutput => prevOutput + `> ${command}\n`); // Adiciona o comando ao output

    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();

      if (response.ok) {
        setOutput(prevOutput => prevOutput + data.output + '\n');
      } else {
        setOutput(prevOutput => prevOutput + `Erro: ${data.error}\n`);
      }
    } catch (error) {
      console.error('Erro ao enviar comando para a API:', error);
      setOutput(prevOutput => prevOutput + `Erro de comunicação com a API: ${error.message}\n`);
    } finally {
      setIsLoading(false);
      setCommand(''); // Limpa o campo de comando após a execução
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleExecuteCommand();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        color: '#cccccc',
        padding: '20px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h2 style={{ marginTop: 0, color: '#ffffff' }}>Terminal e Logs</h2>
        <div style={{
          flexGrow: 1,
          backgroundColor: '#000000',
          color: '#00ff00',
          padding: '10px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          marginBottom: '10px',
          borderRadius: '4px',
          border: '1px solid #333',
        }}>
          {output}
        </div>
        <input
          type="text"
          value={command}
          onChange={handleCommandChange}
          onKeyPress={handleKeyPress}
          placeholder="Digite seu comando aqui..."
          disabled={isLoading}
          style={{
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #333',
            backgroundColor: '#2d2d2d',
            color: '#cccccc',
            fontFamily: 'monospace',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleExecuteCommand}
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: isLoading ? '#555' : '#007bff',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Executando...' : 'Executar Comando'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#6c757d',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminalModal;