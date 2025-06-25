'use client';

import { useState, useEffect } from 'react';
import styles from './PM2Panel.module.css';

// Componente Modal Simples para Logs
function LogModal({ isOpen, onClose, processName, logs, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className={styles.logModalOverlay}>
      <div className={styles.logModalContent}>
        <h3 className={styles.logModalTitle}>Logs para: {processName}</h3>
        <button onClick={onClose} className={styles.logModalCloseButton}>
          ×
        </button>
        <div className={styles.logModalBody}>
          {isLoading ? (
            <p>Carregando logs...</p>
          ) : (
            <pre className={styles.logPre}>
              {Array.isArray(logs) && logs.length > 0
                ? logs.map((log, index) => (
                    `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
                  )).join('\n')
                : 'Nenhum log encontrado ou erro ao buscar.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PM2Panel() {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // Estado para loading de botões de controle

  // Estados para o modal de logs
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [currentLogProcess, setCurrentLogProcess] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    const fetchProcesses = async () => {
      try {
        const response = await fetch('/api/pm2-status');
        if (!response.ok) {
          // Se a API retornar um erro (mesmo que 200 com array vazio agora), trata aqui
          console.error('Error fetching PM2 status:', response.statusText);
          setProcesses([]); // Define como vazio em caso de erro de fetch
          // Poderia definir um estado de erro para exibir mensagem
          return; // Sai da função fetchProcesses
        }
        const data = await response.json();
        // Verifica se data é um array antes de definir o estado
        if (Array.isArray(data)) {
            setProcesses(data);
        } else {
            console.error('Invalid data received from /api/pm2-status:', data);
            setProcesses([]); // Define como vazio se os dados não forem um array
        }
      } catch (error) {
        console.error('Error fetching PM2 processes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProcesses();
    const interval = setInterval(fetchProcesses, 5000);
    return () => clearInterval(interval);
  }, []);


  const handleControlAction = async (processName, action) => {
    if (actionLoading === `${processName}-${action}`) return; // Evita cliques múltiplos
    setActionLoading(`${processName}-${action}`);
    try {
      const response = await fetch('/api/client-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: processName, action: action }),
      });
      console.log(`[PM2Panel] Received response object from API for ${processName} action ${action}`, response); // Log do objeto response
      const data = await response.json();
      console.log(`[PM2Panel] API /api/client-control response for ${processName} action ${action}:`, data); // Log da resposta

      if (!response.ok) {
        throw new Error(data.error || `Falha ao ${action} o processo`);
      }
      // A atualização da lista ocorrerá no próximo fetch do useEffect
    } catch (error) {
      console.error(`Erro ao ${action} processo ${processName}:`, error);
      alert(`Erro ao tentar ${action} o processo: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

    // Função para buscar e mostrar logs
    const handleViewLogs = async (processName) => {
      setCurrentLogProcess(processName);
      setIsLogModalOpen(true);
      setLogLoading(true);
      setLogContent(''); // Limpa logs anteriores
      try {
        const response = await fetch(`/api/pm2-logs/${processName}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error || data.details || 'Erro desconhecido ao buscar logs'
          );
        }
        setLogContent(data.logs);
      } catch (error) {
        console.error(`Erro ao buscar logs para ${processName}:`, error);
        setLogContent(`Erro ao carregar logs: ${error.message}`);
      } finally {
        setLogLoading(false);
      }
    };
  
    const closeLogModal = () => {
      setIsLogModalOpen(false);
      setCurrentLogProcess(null);
      setLogContent('');
    };
  

  if (loading && processes.length === 0) { // Mostra loading inicial apenas se não houver processos ainda
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>Carregando processos...</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Status dos Processos</h2>
      {processes.length === 0 && !loading ? (
        <p className={styles.noProcesses}>
          Nenhum processo PM2 encontrado ou PM2 não está acessível.
        </p>
      ) : (
        <div className={styles.processGrid}>
          {processes.map((process, index) => (
          <div
            key={index}
            className={`${styles.processCard} ${styles[process.status]}`}
          >
            <h3 className={styles.processName}>{process.name}</h3>
            <div className={styles.processInfo}>
              <span className={styles.status}>
                {process.status === 'online' ? 'Executando' : 'Pausado'}
              </span>
              <span className={styles.stats}>
                CPU: {process.cpu.toFixed(1)}% | RAM: {Math.round(process.memory / 1024 / 1024)}MB
              </span>
              <div className={styles.controls}>
                 {/* Botão Parar (sempre visível se o processo existe, mas desabilitado se já parado) */}
                 <button
                    className={`${styles.controlButton} ${styles.stopButton}`}
                    onClick={() => {
                      console.log(`Attempting to stop process: ${process.name}`);
                      handleControlAction(process.name, 'stop');
                    }}
                    disabled={
                      process.status !== 'online' ||
                      actionLoading === `${process.name}-stop`
                    }
                    title={
                      process.status !== 'online'
                        ? 'Processo não está online'
                        : 'Parar processo'
                    }
                  >
                    {actionLoading === `${process.name}-stop`
                      ? 'Parando...'
                      : 'Parar'}
                  </button>
                  {/* Botão Ver Logs */}
                  <button
                    className={`${styles.controlButton} ${styles.logsButton}`}
                    onClick={() => {
                      console.log(`Attempting to view logs for process: ${process.name}`);
                      handleViewLogs(process.name);
                    }}
                    disabled={actionLoading === `${process.name}-logs`} // Desabilita se já estiver carregando logs para este
                    title="Ver logs recentes"
                  >
                    {actionLoading === `${process.name}-logs`
                      ? 'Carregando...'
                      : 'Ver Logs'}
                  </button>
                  {/* Botão Deletar */}
                  <button
                    className={`${styles.controlButton} ${styles.deleteButton}`}
                    onClick={() => {
                      if (
                        confirm(
                          `Tem certeza que deseja DELETAR a instância PM2 "${process.name}"? Isso removerá o processo da lista do PM2.`
                        )
                      ) {
                        console.log(`Attempting to delete process: ${process.name}`);
                        handleControlAction(process.name, 'delete');
                      }
                    }}
                    disabled={actionLoading === `${process.name}-delete`}
                    title="Deletar processo do PM2"
                  >
                    {actionLoading === `${process.name}-delete`
                      ? 'Deletando...'
                      : 'Deletar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Renderiza o Modal de Logs */}
      <LogModal
        isOpen={isLogModalOpen}
        onClose={closeLogModal}
        processName={currentLogProcess}
        logs={logContent}
        isLoading={logLoading}
      />
    </div>
  );
}
