'use client';

import { useState, useEffect } from 'react';
import styles from './StartClientModal.module.css';
import InitClientModal from './InitClientModal';

export default function StartClientModal({
  isOpen,
  onClose,
  clientId,
  onStart,
}) {
  const [loading, setLoading] = useState(false);
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);
  const [clientStatus, setClientStatus] = useState('unknown');
  const [loadingStatus, setLoadingStatus] = useState(false);

  const handleStartClient = async () => {
    setLoading(true);
    try {
      onStart();
      setIsInitModalOpen(true);
      fetchClientLogs(); // Fetch logs when starting client
    } finally {
      setLoading(false);
    }
  };

  const checkClientStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch(`/api/client-control?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClientStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking client status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkClientStatus();
    }
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.content}>
            <h2>
              {clientStatus === 'online' ? 'Parar Cliente' : 'Iniciar Cliente'}
            </h2>
            <p>
              Tem certeza que deseja{' '}
              {clientStatus === 'online' ? 'parar' : 'iniciar'} o cliente{' '}
              {clientId}?
            </p>
            <div className={styles.buttonContainer}>
              <button
                className={`${styles.button} ${styles.confirmButton}`}
                onClick={handleStartClient}
                disabled={loading || loadingStatus}
              >
                {loading
                  ? 'Processando...'
                  : clientStatus === 'online'
                    ? 'Parar'
                    : 'Iniciar'}
              </button>
              <button
                className={`${styles.button} ${styles.cancelButton}`}
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
      <InitClientModal
        isOpen={isInitModalOpen}
        onClose={() => setIsInitModalOpen(false)}
        clientId={clientId}
        action={clientStatus === 'online' ? 'stop' : 'start'}
      />
    </>
  );
}
