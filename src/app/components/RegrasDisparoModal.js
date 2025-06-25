'use client';

import { useState, useEffect, useCallback } from 'react';

// Define um objeto com os valores padrão e descrições para cada regra
const REGRAS_DEFAULT = {
  DISPARO_ESTRATEGIA: {
    value: 'todas_ativas',
    description: 'Define quais listas serão usadas para disparo.',
  },
  DISPARO_LISTAS_SELECIONADAS: {
    value: '',
    description:
      'Nomes das listas selecionadas (separados por vírgula), se estratégia for "selecionadas".',
  },
  HORARIO_INICIAL: {
    value: '08:00',
    description: 'Horário de início dos disparos (HH:MM)',
  },
  HORARIO_FINAL: {
    value: '18:00',
    description: 'Horário de término dos disparos (HH:MM)',
  },
  DIA_INICIAL: {
    value: 'segunda',
    description: 'Primeiro dia da semana para disparos',
  },
  DIA_FINAL: {
    value: 'sexta',
    description: 'Último dia da semana para disparos',
  },
  INTERVALO_DE: {
    value: '30',
    description: 'Intervalo mínimo entre mensagens (segundos)',
  },
  INTERVALO_ATE: {
    value: '60',
    description: 'Intervalo máximo entre mensagens (segundos)',
  },
  QUANTIDADE_INICIAL: {
    value: '10',
    description: 'Quantidade de mensagens no primeiro dia de aquecimento',
  },
  DIAS_AQUECIMENTO: {
    value: '7',
    description: 'Número de dias para o período de aquecimento',
  },
  QUANTIDADE_LIMITE: {
    value: '100',
    description: 'Quantidade máxima de mensagens por dia após aquecimento',
  },
  QUANTIDADE_SEQUENCIA: {
    value: '50',
    description:
      'Pausar por 1h após esta quantidade de mensagens (0 para desativar)',
  },
  // MIDIA removida
};

// Helper para gerar opções de horário (00:00, 00:30, ..., 23:30)
const gerarOpcoesHorario = () => {
  const horarios = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const horaFormatada = String(h).padStart(2, '0');
      const minutoFormatado = String(m).padStart(2, '0');
      horarios.push(`${horaFormatada}:${minutoFormatado}`);
    }
  }
  return horarios;
};
const opcoesHorario = gerarOpcoesHorario();

// Opções para os dias da semana
const opcoesDia = [
  { value: 'domingo', label: 'Domingo' },
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terça', label: 'Terça-feira' }, // Corrigido para 'terça' com cedilha
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
];

export default function RegrasDisparoModal({ isOpen, onClose, clientId, clienteSequencialId }) {
  const [regras, setRegras] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listasDisponiveis, setListasDisponiveis] = useState([]);
  const [loadingListas, setLoadingListas] = useState(false);

  // Estado derivado para listas selecionadas (array)
  const listasSelecionadas = regras.DISPARO_LISTAS_SELECIONADAS
    ? regras.DISPARO_LISTAS_SELECIONADAS.split(',').filter(Boolean)
    : [];

  // Função para buscar as regras atuais
  const fetchRegras = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/regras-disparo?clientId=${encodeURIComponent(clientId)}`
      );
      const responseData = await response.json(); // Renomeado para evitar conflito
      if (!response.ok) {
        throw new Error(responseData.error || 'Erro ao buscar regras');
      }
      // Acessa as regras dentro da propriedade 'regras' do objeto retornado
      const regrasRecebidas = responseData.regras || {};
      
      const regrasCompletas = {};
      Object.keys(REGRAS_DEFAULT).forEach((key) => {
        // Usa o valor recebido se existir, caso contrário usa o padrão
        regrasCompletas[key] =
          regrasRecebidas[key] !== undefined ? regrasRecebidas[key] : REGRAS_DEFAULT[key].value;
      });
      setRegras(regrasCompletas);
    } catch (err) {
      console.error('Erro ao buscar regras:', err);
      setError(`Erro ao carregar regras: ${err.message}`);
      const defaultValues = {};
      Object.keys(REGRAS_DEFAULT).forEach((key) => {
        defaultValues[key] = REGRAS_DEFAULT[key].value;
      });
      setRegras(defaultValues);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Função para buscar as listas disponíveis
  const fetchListas = useCallback(async () => {
    if (!clientId) return;
    
    setLoadingListas(true);
    try {
      const response = await fetch(
        `/api/list-client-lists?clientId=${encodeURIComponent(clientId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar listas');
      }
      setListasDisponiveis(data.listNames || []);
    } catch (err) {
      console.error('Erro ao buscar listas:', err);
      setError(`Erro ao carregar listas disponíveis: ${err.message}`);
      setListasDisponiveis([]);
    } finally {
      setLoadingListas(false);
    }
  }, [clientId]);

  // Busca regras e listas quando o modal abre
  useEffect(() => {
    if (isOpen) {
      fetchRegras();
      fetchListas();
    }
  }, [isOpen, fetchRegras, fetchListas]);

  // Handler para mudança nos inputs e selects
  const handleChange = (e) => {
    const { name, value } = e.target;
    setRegras((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handler para mudança nos checkboxes das listas
  const handleListaSelectionChange = (e) => {
    const { value, checked } = e.target;
    const currentSelected = regras.DISPARO_LISTAS_SELECIONADAS
      ? regras.DISPARO_LISTAS_SELECIONADAS.split(',').filter(Boolean)
      : [];
    let newSelected;
    if (checked) {
      newSelected = [...currentSelected, value];
    } else {
      newSelected = currentSelected.filter((name) => name !== value);
    }
    setRegras((prev) => ({
      ...prev,
      DISPARO_LISTAS_SELECIONADAS: newSelected.join(','),
    }));
  };

  // Handler para salvar as regras
  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const regrasParaSalvar = { ...regras };
      if (regrasParaSalvar.DISPARO_ESTRATEGIA !== 'selecionadas') {
        regrasParaSalvar.DISPARO_LISTAS_SELECIONADAS = '';
      }
      // Remover a chave MIDIA se ela existir acidentalmente
      delete regrasParaSalvar.MIDIA;

      const response = await fetch('/api/regras-disparo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clienteSequencialId, regras: regrasParaSalvar }), // Adicionar ID sequencial
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar regras');
      }
      console.log('Regras salvas:', result.message);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar regras:', err);
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay regras-modal-overlay">
      <div className="modal-content regras-modal-content">
        <div className="modal-header">
          <h2>Editar Regras de Disparo para {clientId}</h2>
          <button onClick={onClose} className="close-button" disabled={loading}>
            ×
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading && !Object.keys(regras).length ? (
          <p>Carregando regras...</p>
        ) : (
          <div className="form-content">
            {/* Seção de Estratégia de Disparo */}
            <div className="form-group strategy-group">
              <label>Estratégia de Disparo</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="DISPARO_ESTRATEGIA"
                    value="todas_ativas"
                    checked={regras.DISPARO_ESTRATEGIA === 'todas_ativas'}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  Disparar para todas as listas ATIVAS
                </label>
                <label>
                  <input
                    type="radio"
                    name="DISPARO_ESTRATEGIA"
                    value="selecionadas"
                    checked={regras.DISPARO_ESTRATEGIA === 'selecionadas'}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  Selecionar listas específicas para disparo
                </label>
              </div>
              <p className="input-description">
                {REGRAS_DEFAULT.DISPARO_ESTRATEGIA.description}
              </p>
            </div>

            {/* Seção de Seleção de Listas (condicional) */}
            {regras.DISPARO_ESTRATEGIA === 'selecionadas' && (
              <div className="form-group list-selection-group">
                <label>Listas para Disparo</label>
                {loadingListas ? (
                  <p>Carregando listas...</p>
                ) : listasDisponiveis.length === 0 ? (
                  <p>Nenhuma lista encontrada na pasta de configuração.</p>
                ) : (
                  <div className="checkbox-group">
                    {listasDisponiveis.map((listName) => (
                      <label key={listName}>
                        <input
                          type="checkbox"
                          value={listName}
                          checked={listasSelecionadas.includes(listName)}
                          onChange={handleListaSelectionChange}
                          disabled={loading}
                        />
                        {listName}
                      </label>
                    ))}
                  </div>
                )}
                <p className="input-description">
                  Marque as listas que devem ser usadas. O disparo só ocorrerá
                  se a lista selecionada também estiver ATIVA.
                </p>
              </div>
            )}

            {/* Campos de Regras Normais */}
            {Object.entries(REGRAS_DEFAULT)
              .filter(
                ([key]) =>
                  key !== 'DISPARO_ESTRATEGIA' &&
                  key !== 'DISPARO_LISTAS_SELECIONADAS' &&
                  key !== 'MIDIA'
              ) // Filtra estratégia e MIDIA
              .map(([key, config]) => (
                <div key={key} className="form-group">
                  <label htmlFor={`regra-${key}`}>{key}</label>
                  {/* Condicional para renderizar select ou input */}
                  {key === 'HORARIO_INICIAL' || key === 'HORARIO_FINAL' ? (
                    <select
                      id={`regra-${key}`}
                      name={key}
                      value={regras[key] || ''}
                      onChange={handleChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Selecione...</option>
                      {opcoesHorario.map((horario) => (
                        <option key={horario} value={horario}>
                          {horario}
                        </option>
                      ))}
                    </select>
                  ) : key === 'DIA_INICIAL' || key === 'DIA_FINAL' ? (
                    <select
                      id={`regra-${key}`}
                      name={key}
                      value={regras[key] || ''}
                      onChange={handleChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Selecione...</option>
                      {opcoesDia.map((dia) => (
                        <option key={dia.value} value={dia.value}>
                          {dia.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={
                        key.startsWith('QUANTIDADE') ||
                        key.startsWith('INTERVALO') ||
                        key.startsWith('DIAS')
                          ? 'number'
                          : 'text'
                      }
                      id={`regra-${key}`}
                      name={key}
                      value={regras[key] || ''}
                      onChange={handleChange}
                      placeholder={config.description}
                      className="form-input"
                      disabled={loading}
                      min={
                        key.startsWith('QUANTIDADE') ||
                        key.startsWith('INTERVALO') ||
                        key.startsWith('DIAS')
                          ? '0'
                          : undefined
                      }
                    />
                  )}
                  <p className="input-description">{config.description}</p>
                </div>
              ))}
          </div>
        )}

        <div className="button-bar">
          <button
            onClick={onClose}
            className="cancel-button"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="save-button"
            disabled={loading || loadingListas}
          >
            {loading ? 'Salvando...' : 'Salvar Regras'}
          </button>
        </div>
      </div>

      {/* Estilos (mantendo o layout similar ao EditClientModal) */}
      <style jsx>{`
        .regras-modal-overlay {
          position: fixed; /* Fixa na tela */
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6); /* Fundo escurecido */
          display: flex; /* Habilita flexbox */
          justify-content: center; /* Centraliza horizontalmente */
          align-items: center; /* Centraliza verticalmente */
          z-index: 1100; /* Garante que fique sobre outros modais */
          padding: 20px; /* Espaçamento interno */
        }
        .regras-modal-content {
          /* Estilos do conteúdo do modal */
          background: white;
          padding: 25px; /* Aumentar padding interno */
          border-radius: 8px; /* Bordas mais suaves */
          width: 90%; /* Largura relativa */
          max-width: 800px; /* Largura máxima razoável */
          max-height: 90vh; /* Altura máxima para caber na tela */
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); /* Sombra para destacar */
          overflow: hidden; /* Previne conteúdo de vazar antes do scroll */
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 15px;
          margin-bottom: 20px; /* Aumentar margem */
          border-bottom: 1px solid #dee2e6;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.3rem; /* Aumentar fonte */
          color: #343a40;
        }
        .close-button {
          background: none;
          border: none;
          font-size: 2rem; /* Aumentar botão de fechar */
          cursor: pointer;
          color: #6c757d;
          padding: 0 5px;
          line-height: 1;
        }
        .close-button:hover {
          color: #343a40;
        }
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          padding: 12px 18px; /* Aumentar padding */
          border-radius: 5px; /* Bordas mais suaves */
          margin-bottom: 20px; /* Aumentar margem */
          font-size: 0.95rem; /* Aumentar fonte */
        }
        .form-content {
          flex-grow: 1; /* Ocupa espaço disponível */
          overflow-y: auto; /* Habilita scroll se necessário */
          padding: 10px; /* Padding interno */
          margin-bottom: 20px; /* Aumentar margem */
          /* Estilo de scrollbar (opcional) */
          scrollbar-width: thin;
          scrollbar-color: #adb5bd #f8f9fa;
        }
        .form-content::-webkit-scrollbar {
          width: 8px;
        }
        .form-content::-webkit-scrollbar-track {
          background: #f1f3f5;
          border-radius: 4px;
        }
        .form-content::-webkit-scrollbar-thumb {
          background-color: #adb5bd;
          border-radius: 4px;
        }

        .form-group {
          margin-bottom: 20px; /* Aumentar espaçamento */
          padding-bottom: 15px; /* Adicionar padding inferior */
          border-bottom: 1px solid #e9ecef; /* Linha separadora suave */
        }
        .form-group:last-child {
          border-bottom: none; /* Remove a linha do último */
        }

        .form-group label {
          display: block;
          margin-bottom: 8px; /* Aumentar espaço */
          font-weight: 600;
          font-size: 1rem; /* Aumentar fonte */
          color: #495057;
        }
        /* Estilo unificado para input e select */
        .form-input {
          width: 100%;
          padding: 10px 14px; /* Aumentar padding */
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem; /* Aumentar fonte */
          box-sizing: border-box; /* Importante */
          background-color: #fff; /* Fundo branco para select */
          line-height: 1.5; /* Melhorar alinhamento do texto */
        }
        .form-input:focus {
          border-color: #80bdff;
          outline: 0;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        /* Estilo específico para select se necessário */
        select.form-input {
          height: calc(
            1.5em + 20px + 2px
          ); /* Ajustar altura para corresponder ao input com padding */
          appearance: none; /* Remover aparência padrão */
          background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007bff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
          background-repeat: no-repeat;
          background-position: right 1rem center;
          background-size: 0.65em auto;
          padding-right: 2.5rem; /* Espaço para a seta */
        }

        .input-description {
          font-size: 0.85rem; /* Aumentar fonte */
          color: #6c757d;
          margin-top: 6px; /* Aumentar espaço */
          margin-bottom: 0;
        }

        /* Estilos para grupo de radio/checkbox */
        .strategy-group,
        .list-selection-group {
          background-color: #f8f9fa; /* Fundo mais suave para página */
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 25px;
          border: 1px solid #dee2e6;
        }
        .radio-group,
        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 10px;
        }
        .radio-group label,
        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: normal;
          font-size: 1rem; /* Aumentar fonte */
          cursor: pointer;
        }
        .radio-group input[type='radio'],
        .checkbox-group input[type='checkbox'] {
          cursor: pointer;
          margin: 0;
          width: 17px; /* Ligeiramente maior */
          height: 17px;
        }
        .list-selection-group {
          max-height: 300px; /* Um pouco mais de altura */
          overflow-y: auto;
          padding: 15px; /* Padding interno */
          border: 1px solid #ced4da;
          background-color: #fff;
        }

        .button-bar {
          display: flex;
          justify-content: flex-end;
          gap: 12px; /* Aumentar espaço */
          padding-top: 20px; /* Aumentar espaço */
          border-top: 1px solid #dee2e6;
        }
        .button-bar button {
          padding: 12px 25px; /* Aumentar padding */
          border-radius: 5px;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1rem; /* Aumentar fonte */
          font-weight: 500; /* Peso médio */
          transition:
            background-color 0.2s ease,
            transform 0.1s ease;
        }
        .button-bar button:hover:not(:disabled) {
          transform: translateY(-1px); /* Leve efeito ao passar o mouse */
        }
        .cancel-button {
          background-color: #6c757d;
        }
        .cancel-button:hover {
          background-color: #5a6268;
        }
        .save-button {
          background-color: #28a745;
        }
        .save-button:hover {
          background-color: #218838;
        }
        .save-button:disabled,
        .cancel-button:disabled {
          background-color: #adb5bd;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
