'use client';

import { useState } from 'react';
import styles from '../page.module.css';
import DraggableCard from './DraggableCard';

export default function DroppableSection({
  type,
  title,
  clientes,
  onEditarCliente,
  onIniciarCliente,
  onMoveToType,
  onCopy,
  onPaste,
  onDuplicate,
  onDownloadClientFolder // Nova prop
}) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add(styles.sectionOver);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove(styles.sectionOver);
  };

  const handleDrop = (e) => {
    console.log(`[DroppableSection ${type}] handleDrop triggered`); // Log 1: Evento disparado
    e.preventDefault();
    e.currentTarget.classList.remove(styles.sectionOver);
    try {
      const rawData = e.dataTransfer.getData('application/json');
      console.log(`[DroppableSection ${type}] Raw data received:`, rawData); // Log 2: Dados brutos
      const data = JSON.parse(rawData);
      console.log(`[DroppableSection ${type}] Parsed data:`, data); // Log 3: Dados parseados
      // Verifica se o drop é em uma seção diferente
      if (data.currentType !== type) {
        // Verifica se já existe um cliente com o mesmo nome na seção de destino
        const existsInTarget = clientes.some(cliente => cliente.name === data.name);

        if (existsInTarget) {
          // Se já existe, mostra um alerta e não tenta mover
          console.warn(`[DroppableSection ${type}] Client "${data.name}" already exists in this section. Move blocked.`); // Log 6: Bloqueado
          alert(`Não é possível mover "${data.name}". Já existe um cliente com esse nome na seção "${title}". Renomeie um dos clientes primeiro.`);
        } else {
          // Se não existe, procede com a movimentação
          console.log(`[DroppableSection ${type}] Calling onMoveToType:`, data.name, data.currentType, type); // Log 4: Chamando a função
          onMoveToType(data.name, data.currentType, type);
        }
      } else {
        console.log(`[DroppableSection ${type}] Drop in same section, ignored.`); // Log 5: Soltura na mesma seção
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  return (
    <section 
      className={styles.section}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.cardGrid}>
        {clientes.length > 0 ? (
          clientes.map(cliente => (
            <DraggableCard
              key={cliente.id}
              cliente={cliente}
              onEditarCliente={onEditarCliente}
              onIniciarCliente={(name, folderType, showModal) => onIniciarCliente(name, folderType, showModal)}
              onMoveToType={(targetType) => onMoveToType(cliente.name, type, targetType)}
              onCopy={() => onCopy(type, cliente.name)}
              onPaste={() => onPaste(type, cliente.name)}
              onDuplicate={() => onDuplicate(type, cliente.name)}
              onDownloadClientFolder={onDownloadClientFolder} // Passa a prop para DraggableCard
            />
          ))
        ) : (
          <p className={styles.emptyMessage}>
            {type === 'modelos' ? 'Nenhum modelo disponível' : 'Nenhum cliente nesta seção'}
          </p>
        )}
      </div>
    </section>
  );
}