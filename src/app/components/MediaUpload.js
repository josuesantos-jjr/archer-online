'use client';

import { useState, useEffect } from 'react';

export default function MediaUpload({
  media = [],
  onUpload,
  onMediaDelete, // Callback para notificar exclusão
  onMediaRename, // Callback para notificar renomeação
  listaNome,
  clientId,
  selectedMediaPath,
  onSelectMedia,
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [openMenuIndex, setOpenMenuIndex] = useState(null); // Estado para controlar qual menu está aberto (DEFINIDO UMA VEZ)

  const handleFileUpload = async (event, tipo) => {
    const file = event.target.files[0];
    if (!file) return;

    event.target.value = null;
    setUploading(true);

    const defaultName = file.name.replace(/\.[^/.]+$/, '');
    const customNameInput = window.prompt(
      `Digite um nome para o arquivo "${file.name}" (opcional):`,
      defaultName
    );

    if (customNameInput === null) {
      setUploading(false);
      return;
    }

    const finalCustomName = customNameInput.trim() || defaultName;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);
      formData.append('listaNome', listaNome || `lista_${Date.now()}`);
      formData.append('tipo', tipo);
      formData.append('customName', finalCustomName);

      const response = await fetch('/api/listas/upload-media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido no upload');
      }

      const data = await response.json();
      onUpload({ arquivo: data.arquivo, tipo: data.tipo });
    } catch (error) {
      console.error('Erro no upload:', error);
      alert(`Erro ao fazer upload do arquivo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (index, relativePath) => {
    // DEFINIDO UMA VEZ
    if (!relativePath) return;
    const fileName = relativePath.split('/').pop();
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o arquivo "${fileName}"? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setOpenMenuIndex(null);

    try {
      const response = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, relativeFilePath: relativePath }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao excluir mídia');
      }

      console.log('Mídia excluída com sucesso:', relativePath);
      if (onMediaDelete) {
        onMediaDelete(index, relativePath);
      }
    } catch (error) {
      console.error('Erro ao excluir mídia:', error);
      alert(`Falha ao excluir mídia: ${error.message}`);
    }
  };

  const handleRename = async (index, currentRelativePath) => {
    // DEFINIDO UMA VEZ
    if (!currentRelativePath) return;

    const currentFileName = currentRelativePath.split('/').pop() || '';
    const currentNameWithoutExt = currentFileName.replace(/\.[^/.]+$/, '');
    const newNameInput = window.prompt(
      `Digite o novo nome para "${currentFileName}" (sem extensão):`,
      currentNameWithoutExt
    );

    if (newNameInput === null || !newNameInput.trim()) {
      setOpenMenuIndex(null);
      return;
    }

    const newFileNameWithoutExt = newNameInput.trim();
    setOpenMenuIndex(null);

    try {
      const response = await fetch('/api/media/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          currentRelativePath,
          newFileNameWithoutExt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status} ao renomear`);
      }

      console.log(`Mídia renomeada com sucesso para: ${data.newRelativePath}`);
      if (onMediaRename) {
        onMediaRename(index, currentRelativePath, data.newRelativePath);
      }
    } catch (error) {
      console.error('Erro ao renomear mídia:', error);
      alert(`Falha ao renomear mídia: ${error.message}`);
    }
  };

  return (
    <div className="media-upload">
      <div className="upload-buttons">
        <label className="upload-button">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'imagem')}
            disabled={uploading || !listaNome}
            style={{ display: 'none' }}
            title={!listaNome ? 'Digite um nome para a lista primeiro' : ''}
          />
          {uploading ? 'Enviando...' : '📸 Add Imagem'}
        </label>
        <label className="upload-button">
          <input
            type="file"
            accept="video/*"
            onChange={(e) => handleFileUpload(e, 'video')}
            disabled={uploading || !listaNome}
            style={{ display: 'none' }}
            title={!listaNome ? 'Digite um nome para a lista primeiro' : ''}
          />
          {uploading ? 'Enviando...' : '🎥 Add Vídeo'}
        </label>
        <label className="upload-button">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => handleFileUpload(e, 'audio')}
            disabled={uploading || !listaNome}
            style={{ display: 'none' }}
            title={!listaNome ? 'Digite um nome para a lista primeiro' : ''}
          />
          {uploading ? 'Enviando...' : '🎵 Add Áudio'}
        </label>
        <label className="upload-button">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={(e) => handleFileUpload(e, 'outro')}
            disabled={uploading || !listaNome}
            style={{ display: 'none' }}
            title={!listaNome ? 'Digite um nome para a lista primeiro' : ''}
          />
          {uploading ? 'Enviando...' : '📄 Add Documento'}
        </label>
      </div>

      {media.length > 0 && (
        <div className="media-preview">
          <h4>Arquivos de Mídia (Selecione um para enviar com a mensagem):</h4>
          <div className="media-select-option">
            <input
              type="radio"
              id={`media-select-none-${listaNome || 'default'}`}
              name={`media-select-${listaNome || 'default'}`}
              value=""
              checked={!selectedMediaPath}
              onChange={() => onSelectMedia(null)}
              disabled={disabled}
            />
            <label htmlFor={`media-select-none-${listaNome || 'default'}`}>
              Nenhum (Enviar apenas texto)
            </label>
          </div>
          <div className="media-grid">
            {media.map((item, index) => {
              const mediaUrl = item.arquivo
                ? `/api/media?clientId=${encodeURIComponent(clientId || '')}&filePath=${encodeURIComponent(item.arquivo)}`
                : null; // Usa query param
              const fileName = item.arquivo
                ? item.arquivo.split('/').pop()
                : 'arquivo_invalido';

              return (
                <div
                  key={index}
                  className={`media-item ${selectedMediaPath === item.arquivo ? 'selected' : ''}`}
                >
                  <div className="media-select-option">
                    <input
                      type="radio"
                      id={`media-select-${listaNome || 'default'}-${index}`}
                      name={`media-select-${listaNome || 'default'}`}
                      value={item.arquivo || ''}
                      checked={selectedMediaPath === item.arquivo}
                      onChange={() => onSelectMedia(item.arquivo)}
                      disabled={disabled || !item.arquivo}
                    />
                    <label
                      htmlFor={`media-select-${listaNome || 'default'}-${index}`}
                      className="media-info-label"
                    >
                      <span className="file-icon">📄</span>
                      <span className="file-name" title={fileName}>
                        {fileName}
                      </span>
                    </label>
                    {/* Botão de Menu de Opções */}
                    <div className="media-actions-menu">
                      <button
                        className="menu-trigger-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuIndex(
                            openMenuIndex === index ? null : index
                          );
                        }}
                        title="Opções"
                        disabled={disabled || !item.arquivo}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>
                      {/* Dropdown Menu */}
                      {openMenuIndex === index && (
                        <div className="dropdown-content">
                          <a
                            href={mediaUrl}
                            download={fileName}
                            onClick={() => setOpenMenuIndex(null)}
                          >
                            Baixar
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(index, item.arquivo);
                            }}
                          >
                            Renomear
                          </button>
                          <button
                            className="delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(index, item.arquivo);
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .media-upload {
          margin: 15px 0;
        }
        .upload-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 15px;
        }
        .upload-button {
          padding: 8px 16px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
        }
        .upload-button:hover {
          background: #e9ecef;
        }
        .upload-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .media-preview {
          margin-top: 15px;
        }
        .media-preview h4 {
          margin: 0 0 10px;
          color: #495057;
        }
        .media-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(250px, 1fr)
          ); /* Aumenta um pouco a largura mínima */
          gap: 15px;
          margin-top: 10px;
        }
        .media-item {
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 10px;
          background: #fff;
          position: relative;
          transition: border-color 0.2s;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .media-item.selected {
          border-color: #007bff;
          box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
        }
        .media-select-option {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-grow: 1; /* Ocupa espaço */
        }
        .media-preview > .media-select-option {
          margin-bottom: 10px; /* Margem apenas para a opção "Nenhum" */
          width: auto; /* Não força largura total */
          flex-grow: 0;
        }

        .media-select-option input[type='radio'] {
          margin: 0;
          cursor: pointer;
          flex-shrink: 0;
        }
        .media-select-option input[type='radio']:disabled {
          cursor: not-allowed;
        }
        .media-select-option label {
          cursor: pointer;
          flex-grow: 1;
          font-weight: normal;
          font-size: 0.9em;
          display: flex;
          align-items: center;
          gap: 5px;
          overflow: hidden;
        }
        .media-info-label {
          flex-grow: 1;
          display: flex;
          align-items: center;
          gap: 5px;
          overflow: hidden;
          cursor: pointer;
        }
        .media-info-label .file-icon {
          font-size: 1.2em;
          flex-shrink: 0;
        }
        .media-info-label .file-name {
          flex-grow: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .media-actions-menu {
          position: relative;
          flex-shrink: 0;
          margin-left: auto;
        }
        .menu-trigger-button {
          background: none;
          border: none;
          padding: 5px;
          cursor: pointer;
          color: #6c757d;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .menu-trigger-button:hover {
          background-color: #f0f0f0;
          color: #333;
        }
        .menu-trigger-button:disabled {
          color: #adb5bd;
          cursor: not-allowed;
          background: none;
        }
        .dropdown-content {
          position: absolute;
          right: 0;
          top: 100%;
          background-color: white;
          min-width: 120px;
          box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
          z-index: 10;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 2px;
        }
        .dropdown-content a,
        .dropdown-content button {
          color: black;
          padding: 8px 12px;
          text-decoration: none;
          display: block;
          width: 100%;
          text-align: left;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 0.9em;
        }
        .dropdown-content a:hover,
        .dropdown-content button:hover {
          background-color: #f1f1f1;
        }
        .dropdown-content button.delete {
          color: #dc3545;
        }
        .dropdown-content button.delete:hover {
          background-color: #f8d7da;
        }
        .media-error-placeholder {
          color: red;
          font-size: 0.9em;
          padding: 10px;
          background: #fdd;
          border: 1px solid red;
          border-radius: 4px;
          margin-top: 5px;
        }

        /* --- Media Queries para Responsividade --- */

        @media (max-width: 768px) {
          .upload-buttons {
            gap: 8px; /* Menor espaço */
          }
          .upload-button {
            padding: 6px 12px;
            font-size: 13px;
          }
          .media-grid {
            grid-template-columns: repeat(
              auto-fill,
              minmax(200px, 1fr)
            ); /* Menor min-width */
            gap: 10px;
          }
          .media-item {
            padding: 8px;
          }
          .media-select-option label {
            font-size: 0.85em;
          }
          .media-info-label .file-name {
            font-size: 0.9em; /* Ajusta tamanho do nome do arquivo */
          }
          .menu-trigger-button {
            padding: 4px; /* Menor padding no botão de menu */
          }
          .dropdown-content a,
          .dropdown-content button {
            padding: 6px 10px;
            font-size: 0.85em;
          }
        }

        @media (max-width: 480px) {
          .upload-buttons {
            gap: 6px;
          }
          .upload-button {
            padding: 5px 10px;
            font-size: 12px;
            flex-grow: 1; /* Faz botões ocuparem espaço */
          }
          .media-grid {
            grid-template-columns: 1fr; /* Uma coluna */
            gap: 8px;
          }
          .media-item {
            padding: 6px;
          }
          .media-select-option label {
            font-size: 0.8em;
          }
          .media-info-label .file-name {
            font-size: 0.85em;
          }
        }
      `}</style>
    </div>
  );
}
