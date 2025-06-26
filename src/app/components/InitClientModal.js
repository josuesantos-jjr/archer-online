'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './InitClientModal.module.css';

const STAGES = {
  LOADING: 'loading',
  COUNTDOWN: 'countdown',
  STATUS_CHECK: 'status_check',
  QR_CODE: 'qr_code',
  CONNECTED: 'connected',
};

import QRCode from 'qrcode'; // Importa a biblioteca qrcode para gerar no frontend

const QrCodeDisplay = ({ clientId }) => {
  const [qrCodeSrc, setQrCodeSrc] = useState('');
  const [loadingQr, setLoadingQr] = useState(true);
  const [errorQr, setErrorQr] = useState(false);

  const generateQrCodeFromUrl = useCallback(async (urlCode) => {
    try {
      const dataUrl = await QRCode.toDataURL(urlCode, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 8
      });
      setQrCodeSrc(dataUrl);
      setLoadingQr(false);
    } catch (err) {
      console.error('Erro ao gerar QR Code no frontend:', err);
      setErrorQr(true);
      setLoadingQr(false);
    }
  }, []);

  useEffect(() => {
    let intervalId;

    const fetchQrCode = async () => {
      setLoadingQr(true);
      setErrorQr(false);
      try {
        const response = await fetch(
          `/api/qr-code/${encodeURIComponent(clientId)}?t=${Date.now()}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.qrCode) {
            // Se a API retornou a imagem Base64 diretamente
            setQrCodeSrc(data.qrCode);
            setLoadingQr(false);
          } else if (data.qrCodeData && data.qrCodeData.urlCode) {
            // Se a API retornou o urlCode do JSON, gera o QR code no frontend
            await generateQrCodeFromUrl(data.qrCodeData.urlCode);
          } else {
            console.warn('QR Code ou dados do QR Code não encontrados na resposta.');
            setQrCodeSrc('');
            setLoadingQr(false);
          }
        } else if (response.status === 404) {
          // QR code ainda não gerado ou não encontrado, continua tentando
          setLoadingQr(false);
          setQrCodeSrc('');
        } else {
          // Outros erros do servidor
          console.error('Erro ao buscar QR code:', response.statusText);
          setErrorQr(true);
          setLoadingQr(false);
          setQrCodeSrc('');
        }
      } catch (error) {
        console.error('Erro de rede ao buscar QR code:', error);
        setErrorQr(true);
        setLoadingQr(false);
        setQrCodeSrc('');
      }
    };

    // Tenta buscar o QR code a cada 15 segundos
    intervalId = setInterval(fetchQrCode, 15000);
    fetchQrCode(); // Chama uma vez imediatamente

    return () => clearInterval(intervalId); // Limpa o intervalo na desmontagem
  }, [clientId, generateQrCodeFromUrl]);

  if (loadingQr) {
    return (
      <div className={styles.qrCodeLoading}>
        <div className={styles.spinner} />
        <p>Aguardando geração do QR Code...</p>
      </div>
    );
  }

  if (errorQr) {
    return (
      <div className={styles.qrCodeError}>
        <p>Erro ao carregar QR Code. Tente novamente.</p>
      </div>
    );
  }

  if (!qrCodeSrc) {
    return (
      <div className={styles.qrCodeLoading}>
        <div className={styles.spinner} />
        <p>Aguardando geração do QR Code...</p>
      </div>
    );
  }

  return (
    <img
      src={qrCodeSrc}
      alt="QR Code"
      className={styles.qrCodeImage}
    />
  );
};

const StageComponent = ({
  stage,
  countdown,
  qrCodeTimer,
  connectionStatus,
  clientId,
  clientLogs, // Keep this prop, as it's now passed from InitClientModal
}) => {
  switch (stage) {
    case STAGES.LOADING:
      return (
        <div className={styles.loadingStage}>
          <div className={styles.spinner} />
          <p>Carregando...</p>
        </div>
      );

    case STAGES.COUNTDOWN:
      return (
        <div className={styles.countdownStage}>
          <p>Aguarde para iniciar</p>
          <div className={styles.countdownCircle}>{countdown}</div>
        </div>
      );

    case STAGES.STATUS_CHECK:
    case STAGES.QR_CODE:
    case STAGES.CONNECTED:
      return (
        <div className={styles.statusStage}>
          <div className={styles.statusHeader}>
            <h3>Status da conexão</h3>
            <p>{connectionStatus}</p>
          </div>

          {stage === STAGES.QR_CODE && (
            <div className={styles.qrCodeSection}>
              <p>Não conectado</p>
              <p>Carregando QR Code ({qrCodeTimer}s)</p>
              <div className={styles.qrCodeContainer}>
                <QrCodeDisplay clientId={clientId} />
              </div>
            </div>
          )}

          {stage === STAGES.CONNECTED && (
            <div className={styles.connectedSection}>
              <div className={styles.checkmark}>✓</div>
              <p>Conectado com sucesso!</p>
            </div>
          )}

          {clientLogs && (
            <div className={styles.logSection}>
              <h3>Logs da Instância:</h3>
              <pre className={styles.logContent}>{clientLogs}</pre>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
};

export default function InitClientModal({ isOpen, onClose, clientId, action }) {
  const [stage, setStage] = useState(STAGES.LOADING);
  const [countdown, setCountdown] = useState(10);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [qrCodeTimer, setQrCodeTimer] = useState(50);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldClose, setShouldClose] = useState(false);
  const [clientLogs, setClientLogs] = useState(''); // New state for logs
  const [loadingLogs, setLoadingLogs] = useState(false); // New state for loading logs

  useEffect(() => {
    if (!isOpen) {
      setStage(STAGES.LOADING);
      setCountdown(1);
      setQrCodeTimer(50);
      setShouldClose(false);
      return;
    }

    // Initial loading animation (2s)
    setIsTransitioning(true);
    const loadingTimer = setTimeout(() => {
      setStage(STAGES.COUNTDOWN);
      setIsTransitioning(false);
    }, 2000);

    return () => clearTimeout(loadingTimer);
  }, [isOpen]);

  const fetchClientLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch(`/api/pm2-logs/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClientLogs(data.logs);
      } else {
        console.error('Failed to fetch client logs:', response.statusText);
        setClientLogs('Failed to load logs.');
      }
    } catch (error) {
      console.error('Error fetching client logs:', error);
      setClientLogs('Error loading logs.');
    } finally {
      setLoadingLogs(false);
    }
  }, [clientId]);

  useEffect(() => {
    let logIntervalId;
    if (isOpen) {
      fetchClientLogs(); // Fetch logs immediately when modal opens
      logIntervalId = setInterval(fetchClientLogs, 5000); // Fetch logs every 5 seconds
    }
    return () => clearInterval(logIntervalId); // Clear interval on unmount or when modal closes
  }, [isOpen, fetchClientLogs]);

  useEffect(() => {
    if (shouldClose) {
      const closeTimer = setTimeout(() => {
        onClose();
      }, 1500); // Wait for animations to complete
      return () => clearTimeout(closeTimer);
    }
  }, [shouldClose, onClose]);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/client-config?clientId=${encodeURIComponent(clientId)}`);
      const data = await response.json();
      
      const status = data.STATUS_SESSION || '';
      setConnectionStatus(status);

      if (status.toLowerCase() === 'inchat') {
        setIsTransitioning(true);
        setStage(STAGES.CONNECTED);
        setShouldClose(true); // Trigger auto-close after animations
      } else {
        // Para qualquer outro status (incluindo 'disconnected', 'notlogged', ou qualquer outro),
        // sempre tenta mostrar o QR Code.
        setStage(STAGES.QR_CODE);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  }, [
    clientId,
    setConnectionStatus,
    setStage,
    setIsTransitioning,
    setShouldClose,
  ]);

  const startClient = useCallback(async () => {
    try {
      const response = await fetch('/api/client-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, action: 'start' }),
      });

      if (!response.ok) {
        console.error('Failed to start client:', response.statusText);
      }
    } catch (error) {
      console.error('Error starting client:', error);
    }
  }, [clientId]);

  const stopClient = useCallback(async () => {
    try {
      const response = await fetch('/api/client-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, action: 'stop' }),
      });

      if (!response.ok) {
        console.error('Failed to stop client:', response.statusText);
      }
    } catch (error) {
      console.error('Error stopping client:', error);
    }
  }, [clientId]);

  useEffect(() => {
    let timerId; // Use a single variable for the timer ID

    if (stage === STAGES.COUNTDOWN) {
      if (countdown > 0) {
        // Timer to decrement countdown
        timerId = setTimeout(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        // countdown === 0
        // Timer for stage transition
        setIsTransitioning(true);
        timerId = setTimeout(() => {
          setStage(STAGES.STATUS_CHECK);
          if (action === 'start') {
            startClient();
          } else if (action === 'stop') {
            stopClient();
          }
          checkConnectionStatus();
          setIsTransitioning(false);
        }, 1000); // Delay transition
      }
    }

    // Cleanup function: clear the active timer
    return () => clearTimeout(timerId);
  }, [
    stage,
    countdown,
    action,
    startClient,
    stopClient,
    checkConnectionStatus,
  ]); // Added missing dependencies

  useEffect(() => {
    if (stage === STAGES.QR_CODE && qrCodeTimer > 0) {
      const timer = setInterval(() => {
        setQrCodeTimer((prev) => prev - 1);
        checkConnectionStatus();
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [stage, qrCodeTimer]);

  // Function definitions moved before the useEffect hooks that use them

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <div
          className={`${styles.content} ${isTransitioning ? styles.transitioning : ''}`}
        >
          <StageComponent
            stage={stage}
            countdown={countdown}
            qrCodeTimer={qrCodeTimer}
            connectionStatus={connectionStatus}
            clientId={clientId}
            clientLogs={clientLogs} // Pass logs to StageComponent
          />
        </div>
      </div>
    </div>
  );
}
