'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './OptionsMenu.module.css';

export default function OptionsMenu({
  clientName,
  clientType,
  onCopy,
  onPaste,
  onDuplicate,
  onMoveToType,
  onDownloadFolder, // Nova prop para a função de download
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.optionsContainer} ref={menuRef}>
      <button
        className={styles.optionsButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Opções"
      >
        {/* Three dots icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.optionsMenu}>
          <button
            onClick={() => {
              onCopy();
              setIsOpen(false);
            }}
          >
            Copiar
          </button>
          <button
            onClick={() => {
              onPaste();
              setIsOpen(false);
            }}
          >
            Colar
          </button>
          <button
            onClick={() => {
              onDuplicate();
              setIsOpen(false);
            }}
          >
            Duplicar
          </button>
          <button
            onClick={() => {
              onDownloadFolder(); // Chama a nova função de download
              setIsOpen(false);
            }}
          >
            Baixar Pasta
          </button>
          <div className={styles.submenu}>
            <button>Mover para...</button>
            <div className={styles.submenuContent}>
              {['ativos', 'cancelados', 'modelos'].map(
                (type) =>
                  type !== clientType && (
                    <button
                      key={type}
                      onClick={() => {
                        onMoveToType(type);
                        setIsOpen(false);
                      }}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
