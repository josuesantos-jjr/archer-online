'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import OptionsMenu from '../components/OptionsMenu';
import { useRouter } from 'next/navigation';

export default function DraggableCard({
  cliente,
  onEditarCliente,
  onIniciarCliente,
  onMoveToType,
  onCopy,
  onPaste,
  onDuplicate,
  onAbrirRelatorioCliente, // Nova prop
  onDownloadClientFolder, // Nova prop para baixar pasta
}) {
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(cliente.status);
  const [envStatus, setEnvStatus] = useState('Carregando...');
  const [sessionStatusDisplay, setSessionStatusDisplay] = useState('Carregando...');
  const [disparoInfo, setDisparoInfo] = useState({
    statusGeral: 'carregando', // 'em_andamento', 'concluido', 'sem_listas_ativas', 'sem_listas_disparo', 'erro', 'carregando'
    listasAtivasCount: 0,
    listaAtual: {
      indice: 0,
      progressoPercentual: 0,
    },
    totalListasNaFila: 0,
    logErro: null,
    loading: true,
  });
  const router = useRouter();
  const [showErrorLogModal, setShowErrorLogModal] = useState(false); // Estado para modal de erro

  const handleToggleErrorLog = () => {
    setShowErrorLogModal(!showErrorLogModal);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        id: cliente.id,
        currentType: cliente.folderType,
        name: cliente.name,
      })
    );
  };

  // Hook para verificar status do .env
  useEffect(() => {
    const checkEnvStatus = async () => {
      try {
        const response = await fetch(
          `/api/env-status?clientId=${encodeURIComponent(`${cliente.folderType}/${cliente.name}`)}`
        );
        const data = await response.json();
        if (data.status) {
          setEnvStatus(data.status);
        }
      } catch (error) {
        console.error('Erro ao verificar status do .env:', error);
        setEnvStatus('Erro ao ler status');
      }
    };
    checkEnvStatus();
    // A atualização pode ser feita recarregando a lista de clientes no dashboard principal
  }, [cliente.folderType, cliente.name]);


  // Hook para buscar status da sessão do infoCliente.json
  useEffect(() => {
    const fetchSessionStatus = async () => {
      try {
        const response = await fetch(
          `/api/client-config?clientId=${encodeURIComponent(`${cliente.folderType}/${cliente.name}`)}`
        );
        const data = await response.json();
        if (data && data.STATUS_SESSION) {
          setSessionStatusDisplay(data.STATUS_SESSION);
        } else {
          setSessionStatusDisplay('N/A'); // Or some default status if not found
        }
      } catch (error) {
        console.error('Erro ao verificar status da sessão:', error);
        setSessionStatusDisplay('Erro');
      }
    };

    // Only fetch if not a model, similar to disparoInfo
    if (cliente.folderType !== 'modelos') {
      fetchSessionStatus();
    } else {
      setSessionStatusDisplay('N/A (Modelo)');
    }
  }, [cliente.folderType, cliente.name]); // Depend on client folderType and name

  // Hook para buscar informações de disparo reais
  useEffect(() => {
    const fetchDisparoInfo = async () => {
      setDisparoInfo((prev) => ({
        ...prev,
        loading: true,
        statusGeral: 'carregando',
      }));
      try {
        const response = await fetch(
          `/api/disparo-status?clientId=${encodeURIComponent(`${cliente.folderType}/${cliente.name}`)}`
        );
        if (!response.ok) {
          throw new Error(`Erro na API: ${response.statusText}`);
        }
        const data = await response.json();
        setDisparoInfo({
          statusGeral: data.statusGeral || 'sem_listas_disparo',
          listasAtivasCount: data.listasAtivasCount || 0,
          listaAtual: data.listaAtual || { indice: 0, progressoPercentual: 0 },
          totalListasNaFila: data.totalListasNaFila || 0,
          logErro: data.logErro || null,
          loading: false,
        });
      } catch (error) {
        console.error(
          `Erro ao buscar info de disparo para ${cliente.folderType}/${cliente.name}:`,
          error
        );
        setDisparoInfo({
          statusGeral: 'erro',
          listasAtivasCount: 0,
          listaAtual: { indice: 0, progressoPercentual: 0 },
          totalListasNaFila: 0,
          logErro: error.message || 'Falha ao buscar dados.',
          loading: false,
        });
      }
    };

    if (cliente.folderType !== 'modelos') {
      fetchDisparoInfo();
    } else {
      // Define um estado padrão para modelos, sem fazer chamada à API
      setDisparoInfo({
        statusGeral: 'n/a',
        listasAtivasCount: 0,
        listaAtual: { indice: 0, progressoPercentual: 0 },
        totalListasNaFila: 0,
        logErro: null,
        loading: false,
      });
    }
  }, [cliente.id, cliente.folderType, cliente.name]); // Adiciona cliente.name como dependência

  const handleStartStop = async () => {
    if (loading) return;
    setLoading(true); // Inicia o estado de carregamento

    try {
      // Determina a ação com base no sessionStatusDisplay
      const action = sessionStatusDisplay.toLowerCase() === 'inchat' ? 'stop' : 'start';
      
      // Chama a função do pai para iniciar/parar o cliente
      await onIniciarCliente(cliente.name, cliente.folderType, action);

      // Não é necessário verificar o status do PM2 aqui,
      // pois o fetchSessionStatus já fará isso periodicamente.
      // Apenas atualiza o display para um estado intermediário se desejar.
      if (action === 'start') {
        setSessionStatusDisplay('Conectando...');
      } else {
        setSessionStatusDisplay('Desconectando...');
      }

    } catch (error) {
      console.error('Erro ao iniciar/parar cliente:', error);
      // Em caso de erro, reverte o estado de carregamento e talvez o status
      setSessionStatusDisplay('Erro');
    } finally {
      setLoading(false); // Finaliza o estado de carregamento
    }
  };

  return (
    <>
      {' '}
      {/* Adiciona Fragmento React */}
      <div
        draggable
        onDragStart={handleDragStart}
        className={`${styles.card} ${styles[cliente.type]}`}
      >
        <div className={styles.cardHeader}>
          <h2>{cliente.name}</h2>
          <div className={styles.cardActions}>
            <span
              className={`${styles.statusBadge} ${styles[sessionStatusDisplay.toLowerCase() === 'inchat' ? 'statusActive' : 'statusInactive']}`}
            >
              {sessionStatusDisplay}
            </span>
            <OptionsMenu
              clientName={cliente.name}
              clientType={cliente.folderType}
              onCopy={() => onCopy(cliente.folderType, cliente.name)}
              onPaste={() => onPaste(cliente.folderType, cliente.name)}
              onDuplicate={() => onDuplicate(cliente.folderType, cliente.name)}
              onMoveToType={onMoveToType}
              onDownloadFolder={() => onDownloadClientFolder(`${cliente.folderType}/${cliente.name}`)} // Passa a nova prop
            />
          </div>
        </div>
        <div className={`${styles.cardContent} ${styles.disparoInfoSection}`}>
          {/* Informações de Disparo Reais */}
          {cliente.folderType !== 'modelos' ? (
            disparoInfo.loading ? (
              <p>Carregando info disparo...</p>
            ) : (
              <>
                {/* Status Geral do Disparo */}
                <p className={styles.disparoStatusLine}>
                  <span>Disparo: </span>
                  <span
                    className={`${styles.disparoStatusBadge} ${styles[`disparoStatus${disparoInfo.statusGeral.replace('_', '')}`]}`}
                  >
                    {disparoInfo.statusGeral === 'em_andamento'
                      ? 'Em Andamento'
                      : disparoInfo.statusGeral === 'concluido'
                        ? 'Concluído'
                        : disparoInfo.statusGeral === 'sem_listas_ativas'
                          ? 'Sem Listas Ativas'
                          : disparoInfo.statusGeral === 'sem_listas_disparo'
                            ? 'Sem Listas para Disparo'
                            : disparoInfo.statusGeral === 'erro'
                              ? 'Erro'
                              : disparoInfo.statusGeral === 'carregando'
                                ? 'Carregando...'
                                : 'N/A'}
                  </span>
                  {disparoInfo.statusGeral === 'erro' &&
                    disparoInfo.logErro && (
                      <button
                        onClick={handleToggleErrorLog}
                        className={styles.errorLogIcon}
                        title="Ver Log de Erro"
                      >
                        ℹ️
                      </button>
                    )}
                </p>

                {/* Número de Listas Ativas */}
                {(disparoInfo.statusGeral === 'em_andamento' ||
                  disparoInfo.statusGeral === 'concluido' ||
                  disparoInfo.statusGeral === 'sem_listas_ativas') &&
                  disparoInfo.listasAtivasCount > 0 && (
                    <p>Listas Ativas: {disparoInfo.listasAtivasCount}</p>
                  )}

                {/* Progresso da Lista Atual */}
                {disparoInfo.statusGeral === 'em_andamento' &&
                  disparoInfo.listaAtual &&
                  disparoInfo.totalListasNaFila > 0 && (
                    <>
                      <p>
                        Progresso: {disparoInfo.listaAtual.progressoPercentual}%
                        Concluído - {disparoInfo.listaAtual.indice} /{' '}
                        {disparoInfo.totalListasNaFila}
                      </p>
                      <div className={styles.disparoProgressBarContainer}>
                        <div
                          className={styles.disparoProgressBar}
                          style={{
                            width: `${disparoInfo.listaAtual.progressoPercentual}%`,
                          }}
                          title={`${disparoInfo.listaAtual.progressoPercentual}%`}
                        >
                          {/* Opcional: Texto dentro da barra */}
                          {/* {disparoInfo.listaAtual.progressoPercentual}% */}
                        </div>
                      </div>
                    </>
                  )}
              </>
            )
          ) : (
            <p className={styles.disparoStatusLine}>
              <span>Disparo: N/A (Modelo)</span>
            </p>
          )}
          {/* Manter Status .env se relevante */}
          {/* <p>Status .env: <span className={styles.envStatus}>{envStatus}</span></p> */}
        </div>
        <div className={styles.cardActions}>
          <button
            onClick={() =>
              onEditarCliente(`${cliente.folderType}/${cliente.name}`)
            }
            className={`${styles.actionButton} ${styles.actionButtonEdit}`}
          >
            <span className={styles.buttonText}>Editar</span>
          </button>
          {cliente.folderType !== 'modelos' && (
            <>
              <button
                onClick={handleStartStop}
                disabled={loading}
                className={`${styles.actionButton} ${sessionStatusDisplay.toLowerCase() === 'inchat' ? styles.actionButtonStop : ''}`}
              >
                <span className={styles.buttonText}>
                  {loading
                    ? 'Aguarde...'
                    : sessionStatusDisplay.toLowerCase() === 'inchat'
                      ? 'Parar'
                      : 'Iniciar'}
                </span>
              </button>
              <button
                onClick={onAbrirRelatorioCliente} // Chama a função passada por prop
                className={`${styles.actionButton} ${styles.actionButtonReport}`}
              >
                <span className={styles.buttonText}>Relatório</span>
              </button>
            </>
          )}
        </div>
      </div>
      {/* Modal de Log de Erro */}
      {showErrorLogModal && (
        <div
          className={styles.errorLogModalOverlay}
          onClick={handleToggleErrorLog}
        >
          <div
            className={styles.errorLogModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Log de Erro do Disparo</h3>
            <pre>{disparoInfo.logErro || 'Nenhum log de erro disponível.'}</pre>
            <button onClick={handleToggleErrorLog}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );

}
