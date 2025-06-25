'use client';

import { useState, useEffect } from 'react';
import styles from './DuplicateCheckModal.module.css';

export default function DuplicateCheckModal({
  isOpen,
  onClose,
  duplicateData,
  originalContacts,
  onConfirmSave,
}) {
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isSavingFiltered, setIsSavingFiltered] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && originalContacts && duplicateData) {
      // Crie um Set de números de telefone duplicados limpos para busca rápida
      const knownDuplicatePhoneNumbers = new Set(
        duplicateData
          .map((dup) =>
            dup.phoneNumber
              ? String(dup.phoneNumber).replace(/\D/g, '')
              : null
          ) // Verifica se phoneNumber existe
          .filter((phoneNumber) => phoneNumber !== null) // Remove entradas nulas
      );

      // Filtre os contatos originais, removendo aqueles cujos números de telefone já existem em duplicateData
      const contactsWithoutKnownDuplicates = originalContacts.filter(
        (contact) => {
          // Verifica se contact.telefone existe antes de limpar e comparar
          const cleanedContactPhoneNumber = contact.telefone
            ? String(contact.telefone).replace(/\D/g, '')
            : null;
          // Mantém o contato se o número de telefone existir E não estiver na lista de duplicados conhecidos
          return (
            cleanedContactPhoneNumber !== null &&
            !knownDuplicatePhoneNumbers.has(cleanedContactPhoneNumber)
          );
        }
      );

      // Agora, filtre 'contactsWithoutKnownDuplicates' para garantir que apenas números únicos permaneçam
      const finalUniqueContacts = [];
      const seenPhoneNumbersInCurrentList = new Set();

      for (const contact of contactsWithoutKnownDuplicates) {
        const cleanedContactPhoneNumber = contact.telefone
          ? String(contact.telefone).replace(/\D/g, '')
          : null;
        if (
          cleanedContactPhoneNumber &&
          !seenPhoneNumbersInCurrentList.has(cleanedContactPhoneNumber)
        ) {
          finalUniqueContacts.push(contact);
          seenPhoneNumbersInCurrentList.add(cleanedContactPhoneNumber);
        }
      }

      setFilteredContacts(finalUniqueContacts);
      setIsSavingAll(false);
      setIsSavingFiltered(false);
      setError(null);
    }
  }, [originalContacts, isOpen, duplicateData]); // Adicionado duplicateData como dependência

  if (!isOpen) return null;

  const handleRemoveDuplicate = (phoneNumberToRemove) => {
    setFilteredContacts((prev) => {
      const cleanedPhoneNumberToRemove = String(phoneNumberToRemove).replace(/\D/g, '');
      return prev.filter((contact) => String(contact.telefone).replace(/\D/g, '') !== cleanedPhoneNumberToRemove);
    });
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    setError(null);
    try {
      await onConfirmSave(originalContacts);
    } catch (err) {
      setError(
        'Erro ao tentar salvar todos os contatos: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleSaveFiltered = async () => {
    if (filteredContacts.length === 0) {
      setError(
        'Não há contatos únicos para salvar. Cancele ou remova menos duplicados.'
      );
      return;
    }
    setIsSavingFiltered(true);
    setError(null);
    try {
      await onConfirmSave(filteredContacts);
    } catch (err) {
      setError(
        'Erro ao tentar salvar contatos filtrados: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsSavingFiltered(false);
    }
  };

  const removedCount = originalContacts.length - filteredContacts.length;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ maxWidth: '750px' }}>
        <div className={styles.modalHeader}>
          <h2>⚠️ Contatos Duplicados Encontrados</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            disabled={isSavingAll || isSavingFiltered}
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          <p style={{ marginBottom: '1rem' }}>
            Encontramos <strong>{duplicateData.length}</strong> número(s) de
            telefone que já existem em outras listas suas. Você pode remover
            esses números da lista que está adicionando agora ou adicioná-los
            mesmo assim.
          </p>
          <div className={styles.duplicateList}>
            {duplicateData.map((dup, index) => {
              const isRemoved = !filteredContacts.some(
                (c) => String(c.telefone).replace(/\D/g, '') === String(dup.phoneNumber).replace(/\D/g, '')
              );
              return (
                <div
                  key={`${dup.phoneNumber}-${index}`}
                  className={`${styles.duplicateItem} ${
                    isRemoved ? styles.duplicateItemRemoved : ''
                  }`}
                >
                  <div>
                    <strong>{dup.phoneNumber}</strong>
                    <span className={styles.foundIn}> encontrado em:</span>{' '}
                    <ul className={styles.foundInList}>
                      {Array.isArray(dup.foundIn) ? (
                        dup.foundIn.map((loc, index) => {
                          return (
                            <li key={`${dup.phoneNumber}-${loc.listName}-${index}`}>
                              {loc.listName} (Status: {loc.disparoStatus || "Pendente"})
                            </li>
                          );
                        })
                      ) : (
                        <li>Informação não disponível</li>
                      )}
                    </ul>
                  </div>
                  <button
                    onClick={() => handleRemoveDuplicate(dup.phoneNumber)}
                    className={`${styles.removeButton} ${
                      isRemoved ? styles.removeButtonRemoved : ''
                    }`}
                    disabled={isSavingAll || isSavingFiltered || isRemoved}
                  >
                    {isRemoved ? 'Removido' : 'Remover da Nova Lista'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className={styles.summaryText}>
            Contatos a serem salvos: {filteredContacts.length}
            {removedCount > 0 && (
              <span>
                {' '}
                ({removedCount} duplicado(s) removido(s) desta adição)
              </span>
            )}
          </p>
        </div>
        <div className={styles.modalFooter}>
          <div className={styles.buttonGroup}>
            <button
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSavingAll || isSavingFiltered}
            >
              Cancelar Adição
            </button>
            <div className={styles.buttonGroupActions}>
              <button
                onClick={handleSaveFiltered}
                className={`${styles.saveButton} ${styles.yellowButton}`}
                disabled={
                  isSavingAll ||
                  isSavingFiltered ||
                  filteredContacts.length === 0
                }
              >
                {isSavingFiltered
                  ? 'Salvando...'
                  : `Salvar ${filteredContacts.length} Únicos`}
              </button>
              <button
                onClick={handleSaveAll}
                className={styles.saveButton}
                disabled={isSavingAll || isSavingFiltered}
              >
                {isSavingAll
                  ? 'Salvando...'
                  : `Salvar Todos ${originalContacts.length} Mesmo Assim`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
