'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos para os gatilhos
// TODO: Adicionar importação para o arquivo de estilos do modal, se houver um comum


export default function GatilhosConfigModal({ isOpen, onClose, clientId, clienteSequencialId }) {
  const [config, setConfig] = useState({
    ativar_funcao_gatilhos: false,
    gatilhos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      // Carregar configuração de gatilhos
      fetch(`/api/gatilhos-config?clientId=${encodeURIComponent(clientId)}`)
        .then(res => {
          if (!res.ok) {
            // Se a resposta não for OK, tentar ler como texto para debug
            return res.text().then(text => {
              console.error('Erro na resposta da API /api/gatilhos-config:', res.status, text);
              throw new Error(`Erro HTTP ${res.status}: ${text.substring(0, 100)}...`); // Limita o tamanho do erro
            });
          }
          return res.json();
        })
        .then(data => {
          if (data.error) {
            throw new Error(data.error);
          }
          setConfig(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Erro ao carregar configuração de gatilhos:', err);
          setError('Erro ao carregar configuração de gatilhos: ' + err.message);
          setLoading(false);
        });
    }
  }, [isOpen, clientId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGatilhoInputChange = (index, e) => {
    const { name, value } = e.target;
    setConfig(prevConfig => {
      const newGatilhos = [...prevConfig.gatilhos];
      newGatilhos[index] = {
        ...newGatilhos[index],
        [name]: value,
      };
      return { ...prevConfig, gatilhos: newGatilhos };
    });
  };

  const handleGatilhoToggle = (index, e) => {
    const { checked } = e.target;
    setConfig(prevConfig => {
      const newGatilhos = [...prevConfig.gatilhos];
      newGatilhos[index] = {
        ...newGatilhos[index],
        ativo: checked,
      };
      return { ...prevConfig, gatilhos: newGatilhos };
    });
  };

  const handleAddGatilho = () => {
    setConfig(prevConfig => ({
      ...prevConfig,
      gatilhos: [
        ...prevConfig.gatilhos,
        {
          id: uuidv4(), // Gerar ID único
          nome: '',
          frase_ativacao: '',
          arquivo_midia: '', // Manter para compatibilidade ou uso de arquivo único
          tipo_midia: '', // Manter para compatibilidade ou uso de arquivo único
          varios_arquivos: false, // Novo campo para indicar múltiplos arquivos
          arquivos_midia: [], // Novo campo para armazenar caminhos de múltiplos arquivos
          ativo: true, // Novo gatilho ativo por padrão
        },
      ],
    }));
  };

  const handleRemoveGatilho = (id) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      gatilhos: prevConfig.gatilhos.filter(gatilho => gatilho.id !== id),
    }));
  };

  // A lógica de upload de arquivo será tratada pelo componente MediaUpload
  // A função handleFileUpload original pode ser removida ou adaptada se necessário para o MediaUpload
  // const handleFileUpload = async (index, file) => { ... }

  // TODO: Implementar lógica para selecionar mídia existente (requer API para listar arquivos e um modal/componente de seleção)
  // Esta lógica também pode ser integrada ou chamada pelo componente MediaUpload
  const handleSelectExistingMedia = (index) => {
      alert('Funcionalidade de selecionar mídia existente ainda não implementada.');
      // Implementar lógica para abrir um modal/seletor de arquivos
      // e atualizar o gatilho com o arquivo selecionado.
  };


const [selectedFiles, setSelectedFiles] = useState(null); // Estado para armazenar arquivos selecionados temporariamente

  const handleFileChange = (index, files) => {
    setSelectedFiles(files);
    // Opcional: Limpar o estado de arquivos salvos no gatilho ao selecionar novos arquivos para upload
    // setConfig(prevConfig => {
    //     const newGatilhos = [...prevConfig.gatilhos];
    //     newGatilhos[index] = {
    //         ...newGatilhos[index],
    //         arquivo_midia: '',
    //         arquivos_midia: [],
    //     };
    //     return { ...prevConfig, gatilhos: newGatilhos };
    // });
  };

  const handleUpload = async (index) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('Por favor, selecione um ou mais arquivos para enviar.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('clientId', clientId);
    // Usar o nome do gatilho para a pasta de destino
    formData.append('gatilhoNome', config.gatilhos[index].nome || config.gatilhos[index].id);
    // Adicionar o tipo de mídia selecionado ao formData
    formData.append('tipoMidia', config.gatilhos[index].tipo_midia || ''); // Envia o tipo de mídia selecionado

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    try {
      const response = await fetch('/api/upload-gatilho-media', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload da mídia.');
      }

      console.log('Upload de mídia do gatilho bem-sucedido:', result);

      // Atualizar o estado do gatilho com os caminhos dos arquivos retornados
      setConfig(prevConfig => {
          const newGatilhos = [...prevConfig.gatilhos];
          newGatilhos[index] = {
              ...newGatilhos[index],
              // Se for múltiplos arquivos, salva o array de caminhos
              // Se for arquivo único, salva o primeiro caminho (ou ajusta a API para retornar um único caminho)
              arquivo_midia: newGatilhos[index].varios_arquivos ? '' : result.uploadedFilePaths[0], // Limpa arquivo_midia se for múltiplos
              tipo_midia: result.tipoMidia || '', // Usa o tipo de mídia recebido do endpoint
              arquivos_midia: newGatilhos[index].varios_arquivos ? result.uploadedFilePaths : [], // Salva array se for múltiplos
          };
          return { ...prevConfig, gatilhos: newGatilhos };
      });

      setSelectedFiles(null); // Limpar arquivos selecionados após upload

    } catch (err) {
      console.error('Erro ao fazer upload da mídia do gatilho:', err);
      setError('Erro ao fazer upload da mídia: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/save-gatilhos-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, config }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar configuração de gatilhos.');
      }

      console.log('Configuração de gatilhos salva com sucesso:', result);
      onClose(); // Fechar modal após salvar

    } catch (err) {
      console.error('Erro ao salvar configuração de gatilhos:', err);
      setError('Erro ao salvar configuração de gatilhos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
      <div className="modal-content"> {/* Container principal */}
        <div className="modal-header">
          <h2>Configurar Gatilhos</h2>
          <div className="actions">
             <button className="add-button" onClick={handleAddGatilho}>
               Novo Gatilho
             </button>
             <button onClick={onClose} className="close-button">Voltar</button>
          </div>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {loading ? (
          <p>Carregando dados...</p>
        ) : (
          <> {/* Fragmento para agrupar conteúdo sem div extra */}
            <div className="form-content">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="ativar_funcao_gatilhos"
                    checked={config.ativar_funcao_gatilhos}
                    onChange={handleInputChange}
                  />
                  Ativar Função de Gatilhos
                </label>
              </div>

              <h3>Gatilhos Configurados</h3>
              {config.gatilhos.length === 0 ? (
                <p>Nenhum gatilho configurado.</p>
              ) : (
                config.gatilhos.map((gatilho, index) => (
                  <div key={gatilho.id} className="form-group gatilho-item">
                    
                    <label className="switch"> {/* Usar a classe switch para o toggle */}
                      <input
                        type="checkbox"
                        name="ativo"
                        checked={gatilho.ativo}
                        onChange={(e) => handleGatilhoToggle(index, e)}
                      />
                      <span className="slider"></span>
                      <span className="switch-label">Gatilho Ativo</span> {/* Adicionar label visual */}
                    </label>

                    <label>Nome do Gatilho:</label>
                    <input
                      type="text"
                      name="nome"
                      value={gatilho.nome}
                      onChange={(e) => handleGatilhoInputChange(index, e)}
                      className="form-input"
                    />

                    <label>Frase de Ativação:</label>
                    <input
                      type="text"
                      name="frase_ativacao"
                      value={gatilho.frase_ativacao}
                      onChange={(e) => handleGatilhoInputChange(index, e)}
                      className="form-input"
                    />

<div className="form-group"> {/* Seção de Mídia para Gatilhos */}
                      <label>Mídia:</label>
                      {/* Checkbox para selecionar modo de arquivo único ou múltiplos */}
                      <label>
                        <input
                          type="checkbox"
                          name="varios_arquivos"
                          checked={gatilho.varios_arquivos}
                          onChange={(e) => handleGatilhoInputChange(index, { target: { name: 'varios_arquivos', value: e.target.checked } })}
                        />
                        Permitir múltiplos arquivos
                      </label>

                      {/* Seleção do tipo de mídia */}
                      <div className="form-group">
                        <label htmlFor={`tipo_midia-${index}`}>Tipo de Mídia:</label>
                        <select
                          id={`tipo_midia-${index}`}
                          name="tipo_midia"
                          value={gatilho.tipo_midia || ''}
                          onChange={(e) => handleGatilhoInputChange(index, e)}
                          className="form-input"
                        >
                          <option value="">Selecione o tipo...</option>
                          <option value="image">Imagem</option>
                          <option value="audio">Áudio</option>
                          <option value="video">Vídeo</option>
                          <option value="document">Documento</option>
                        </select>
                      </div>

                      {/* Input para upload de arquivo(s) */}
                      <input
                        type="file"
                        multiple={gatilho.varios_arquivos} // Habilita múltiplos se a opção estiver marcada
                        onChange={(e) => handleFileChange(index, e.target.files)}
                        className="form-input" // Pode precisar de estilos específicos
                      />

                      {/* Exibir arquivos selecionados/salvos */}
                      {gatilho.varios_arquivos ? (
                        <ul>
                          {gatilho.arquivos_midia.map((arquivo, fileIndex) => (
                            <li key={fileIndex}>{arquivo}</li> // Exibir apenas o nome do arquivo ou caminho relativo
                          ))}
                        </ul>
                      ) : (
                        gatilho.arquivo_midia && <p>Arquivo selecionado: {gatilho.arquivo_midia}</p> // Exibir arquivo único
                      )}

                      {/* Botão para upload - a lógica será implementada depois */}
                      <button type="button" onClick={() => handleUpload(index)} disabled={loading}>
                        {loading ? 'Enviando...' : 'Enviar Arquivo(s)'}
                      </button>

                      {/* TODO: Implementar lógica para selecionar mídia existente para gatilhos */}
                      {/* <button type="button" onClick={() => handleSelectExistingMedia(index)}>
                        Selecionar Mídia Existente
                      </button> */}
                    </div>
                    <button type="button" onClick={() => handleRemoveGatilho(gatilho.id)} className="delete-button">
                      Remover Gatilho
                    </button>
                  </div>
                ))
              )}
            </div> {/* Fim do form-content */}
          </>
        )}


        <div className="button-bar"> {/* Usar a classe button-bar */}
          <div className="left-buttons">
            {/* Botões de ação secundária, se houver */}
          </div>
          <div className="right-buttons">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="save-button" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div><style jsx>{`

      .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000; /* Ajuste conforme necessário */
          padding: 20px;
        }
        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 8px;
          max-height: 90vh;
          overflow-y: auto;
          width: 80%;
          max-width: 700px; /* Ajuste conforme necessário */
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eee;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
        }
        .actions {
          display: flex;
          gap: 0.5rem;
        }
        .form-content {
          flex-grow: 1;
          overflow-y: auto;
          padding-right: 10px; /* Para evitar que a barra de rolagem cubra o conteúdo */
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.25rem;
          font-weight: 500;
        }
        .form-input {
          width: 100%;
          padding: 0.6rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        .gatilho-item {
          border: 1px solid #e0e0e0;
          padding: 1rem;
          margin-bottom: 1rem;
          border-radius: 4px;
          background-color: #f9f9f9;
          position: relative; /* Para permitir o posicionamento absoluto do switch */

        }
        .error-message {
          color: #d8000c;
          background-color: #ffdddd;
          border: 1px solid #d8000c;
          padding: 0.75rem;
          border-radius: 4px;
          margin: 1rem 0;
        }
        .button-bar {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-between; /* Para alinhar botões à esquerda e direita */
          gap: 0.5rem;
        }
        .left-buttons, .right-buttons {
            display: flex;
            gap: 0.5rem;
        }

        /* Estilos de Botões (copiados/adaptados de ListasModal.js) */
        .add-button, .close-button, .save-button, .cancel-button, .delete-button {
            padding: 8px 16px; border: 1px solid transparent; cursor: pointer; border-radius: 4px;
            font-size: 14px; font-weight: 500; transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .add-button { background-color: #42a5f5; color: white; border-color: #42a5f5; }
        .add-button:hover { background-color: #1e88e5; border-color: #1e88e5; }
        .close-button { background-color: #ffa726; color: white; border-color: #ffa726; }
        .close-button:hover { background-color: #fb8c00; border-color: #fb8c00; }
        .cancel-button { background-color: #bdbdbd; color: #333; border-color: #bdbdbd; }
        .cancel-button:hover { background-color: #9e9e9e; border-color: #9e9e9e; }
        .save-button { background-color: #26a69a; color: white; border-color: #26a69a; }
        .save-button:hover { background-color: #00897b; border-color: #00897b; }
        .save-button:disabled { background-color: #b2dfdb; border-color: #b2dfdb; color: #757575; cursor: not-allowed; }
        .delete-button { background-color: #ef5350; color: white; border-color: #ef5350; }
        .delete-button:hover { background-color: #e53935; border-color: #e53935; }

        /* Estilos para o Switch (copiados/adaptados de ListasModal.js) */
        .switch {
          /* position: relative; /* Mantido implicitamente por 'absolute' para o contexto de .slider */
          /* display: inline-block; /* Removido, pois 'absolute' o torna block-level */
          /* width: 34px; /* Removido para permitir que o label se expanda com o texto */
          height: 20px;
          /* flex-shrink: 0; /* Não diretamente aplicável a 'absolute' neste contexto */
          /* vertical-align: middle; /* Removido */
          /* margin-right: 8px; /* Removido */
          position: absolute; /* Posicionamento absoluto */
          top: 1rem; /* Alinha com o padding superior do .gatilho-item */
          right: 1rem; /* Alinha à direita, respeitando o padding do .gatilho-item */
          display: flex; /* Para alinhar o texto e o botão visual */
          align-items: center; /* Alinha verticalmente ao centro */
          gap: 8px; /* Espaço entre o texto e o botão visual */

        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          /* position: absolute;  Mudado para relative para fluir com flexbox */
          position: relative;
          display: inline-block; /* Para ser um flex item com dimensões */
          width: 34px; /* Largura do botão visual */
          height: 20px; /* Altura do botão visual */
          cursor: pointer;
          /* top: 0; left: 0; right: 0; bottom: 0; /* Não mais necessário com position relative */
          background-color: #ccc;
          transition: .4s;
          border-radius: 20px;
          flex-shrink: 0; /* Para não encolher se o texto for muito grande */
        }
        .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        input:checked + .slider { background-color: #4CAF50; }
        input:checked + .slider:before { transform: translateX(14px); }
        .switch-label {
          /* vertical-align: middle; /* Não é mais necessário com flex align-items: center */
          font-size: 0.7em; /* Mantido do CSS do usuário */
          order: -2; /* Coloca o texto à esquerda do botão visual */
          white-space: nowrap; /* Evita quebra de linha no texto do label */
        }
      `}
      </style></>

   );
 }

/* Definição duplicada da função DuplicateCheckModal removida. Oponente agora é importado. */
