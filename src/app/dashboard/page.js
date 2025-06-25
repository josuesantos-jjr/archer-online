"use client";

import { useState, useEffect } from 'react';
// Removido useSession e signOut, pois NextAuth.js foi desabilitado.
// A funcionalidade de "Sair" precisará ser reavaliada se a autenticação for reativada.
import { useRouter } from 'next/navigation';
import ThemeToggle from '../components/ThemeToggle';
import EditClientModal from '../components/EditClientModal';
import StartClientModal from '../components/StartClientModal';
import InitClientModal from '../components/InitClientModal';
import NovoClienteModal from '../components/NovoClienteModal'; 
import ChatAna from '../components/ChatAna';
import DroppableSection from './DroppableSection';
import PM2Panel from '../components/PM2Panel';
import RelatoriosModal from '../components/RelatoriosModal'; 
import TerminalModal from '../components/TerminalModal'; 
import styles from '../page.module.css';
import axios from 'axios';
console.log('[Dashboard] Página do dashboard renderizada!');
export default function Dashboard() {
  // Removido o uso de useSession, pois NextAuth.js foi desabilitado.
  // As variáveis session e status não são mais necessárias para o acesso direto.
  const router = useRouter();
  const [clientes, setClientes] = useState([]);
  const [modelosList, setModelosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingModelos, setLoadingModelos] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [startingClientId, setStartingClientId] = useState(null);
  const [initializingClientId, setInitializingClientId] = useState(null);
  const [novoClienteModalOpen, setNovoClienteModalOpen] = useState(false);
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);

  const [relatoriosModalOpen, setRelatoriosModalOpen] = useState(false);

  // Removido o useEffect de redirecionamento para permitir acesso direto ao dashboard.
  // Se a autenticação for necessária no futuro, esta lógica precisará ser reavaliada.

  const fetchClientes = async () => {
    console.log("Dashboard: Iniciando fetchClientes...");
    setLoading(true);
    try {
      console.log("Dashboard: Chamando axios.post('/api/listClientes')...");
      const res = await axios.post('/api/listClientes');
      console.log("Dashboard: Resposta da API recebida:", res.status);

      // A lógica de leitura do infoCliente.json foi movida para o backend.
      // A API /api/listClientes agora deve retornar os clientes com o nome já incluído.
      setClientes(res.data);
      console.log(`Dashboard: ${res.data.length} clientes definidos no estado.`);
    } catch (error) {
      console.error('Dashboard: Erro ao buscar clientes:', error);
      // Assumindo que setError é uma função definida em outro lugar ou que deve ser adicionada
      // setError('Falha ao carregar clientes. Verifique o console.');
    } finally {
      console.log("Dashboard: Finalizando fetchClientes (finally).");
      setLoading(false);
    }
  };

  // Função para buscar modelos
  const fetchModelos = async () => {
    setLoadingModelos(true);
    try {
      console.log('[Dashboard] Buscando modelos da API...');
      const res = await axios.get('/api/list-models');
      console.log('[Dashboard] Modelos recebidos da API:', res.data.models);
      setModelosList(res.data.models || []);
    } catch (error) {
      console.error('[Dashboard] Erro ao buscar modelos:', error);
      setModelosList([]);
    } finally {
      setLoadingModelos(false);
    }
  };

  useEffect(() => {
    // Chamadas para buscar clientes e modelos agora são executadas diretamente,
    // pois a autenticação foi desabilitada para acesso direto ao dashboard.
    fetchClientes();
    fetchModelos();
  }, []); // Removida a dependência 'status'

  const handleEditarCliente = (clientId) => {
    setSelectedClientId(clientId);
    setEditModalOpen(true);
  };

  const handleSaveConfig = async (newClientId) => {
    console.log('[Dashboard] handleSaveConfig chamado. Novo Cliente ID:', newClientId);
    // Após salvar a configuração do novo cliente, atualiza a lista de clientes
    
    await fetchClientes();
    // Não fecha o modal aqui, o NovoClienteModal gerencia o fechamento após o salvamento final
    try {
      const res = await axios.post('/api/listClientes');
      setClientes(res.data);

      if (newClientId && newClientId !== selectedClientId) {
        setSelectedClientId(null);
        setEditModalOpen(false);
      }
    } catch (error) {
      console.error('Erro ao atualizar lista de clientes:', error);
    }
    
  };

  const handleIniciarCliente = async (clientName, folderType, action) => {
    const clientId = `${folderType}/${clientName}`;
    if (action === 'start') {
      try {
        setInitializingClientId(clientId); // Define o ID do cliente antes de qualquer operação assíncrona
        setInitModalOpen(true); // Abre o modal imediatamente

        await axios.post('/api/client-control', { clientId, action: 'start' });
        await fetchClientes(); // Atualiza a lista de clientes após o início
      } catch (error) {
        console.error('Erro ao iniciar cliente:', error);
        // Em caso de erro, pode ser útil fechar o modal ou mostrar uma mensagem de erro
        setInitModalOpen(false);
        setInitializingClientId(null);
      }
    } else {
      axios
        .post('/api/client-control', { clientId, action: 'stop' })
        .then(() => fetchClientes())
        .catch((error) => console.error('Erro ao parar cliente:', error));
    }
  };

  const handleStartClient = async () => {
    try {
      await axios.post('/api/client-control', {
        clientId: startingClientId,
        action: 'start',
      });
    } catch (error) {
      console.error('Erro ao iniciar cliente:', error);
    } finally {
      setStartModalOpen(false);
      setStartingClientId(null);
    }
  };

  const handleMoveToType = async (clientName, sourceType, targetType) => {
    try {
      const response = await axios.post('/api/client-operations', {
        operation: 'move',
        sourceClient: `${sourceType}/${clientName}`,
        targetType
      });

      if (response.data.success) {
        const res = await axios.post('/api/listClientes');
        setClientes(res.data);
      }
    } catch (error) {
      console.error('Erro ao mover cliente:', error);
    }
  };

  const handleCopyClient = async (sourceType, clientName) => {
    try {
      await axios.post('/api/client-operations', {
        operation: 'copy',
        sourceClient: `${sourceType}/${clientName}`
      });
    } catch (error) {
      console.error('Erro ao copiar cliente:', error);
    }
  };

  const handlePasteClient = async (targetType, newName) => {
    try {
      const response = await axios.post('/api/client-operations', {
        operation: 'paste',
        targetType,
        targetName: newName
      });

      if (response.data.success) {
        const res = await axios.post('/api/listClientes');
        setClientes(res.data);
      }
    } catch (error) {
      console.error('Erro ao colar cliente:', error);
    }
  };

  const handleDuplicateClient = async (sourceType, clientName) => {
    try {
      const response = await axios.post('/api/client-operations', {
        operation: 'duplicate',
        sourceClient: `${sourceType}/${clientName}`
      });

      if (response.data.success) {
        const res = await axios.post('/api/listClientes');
        setClientes(res.data);
      }
    } catch (error) {
      console.error('Erro ao duplicar cliente:', error);
    }
  };

  const handleAbrirRelatorioCliente = (clientId) => {
    console.log('Abrindo relatório para o cliente:', clientId);
    setSelectedClientId(clientId);
    setRelatoriosModalOpen(true);
  };

  // Handler para abrir o modal de novo cliente
  const handleAbrirNovoClienteModal = () => {
    setNovoClienteModalOpen(true);
  };

  // Handler para abrir o modal do terminal
  const handleAbrirTerminalModal = () => {
    setTerminalModalOpen(true);
  };

  // Função para lidar com o salvamento do novo cliente
  const handleSalvarNovoCliente = async (modelo, dados) => {
    console.log("[Dashboard] handleSalvarNovoCliente chamado.");
    setLoading(true);
    // setError(null); // Comentado pois setError não está definido aqui
    try {
      // 1. Criar o cliente (copiar arquivos do modelo)
      const response = await axios.post('/api/create-client-functions', {
        action: 'copiarArquivosDoModelo',
        modeloId: modelo,
        novoClienteId: `${dados.folderType}/${dados.name}`
      });
      if (!response.ok) {
        throw new Error(response.data.error || 'Erro ao criar cliente');
      }

      // 2. Salvar a configuração do cliente
      const saveConfigResponse = await axios.post('/api/save-client-config', {
        clientId: `${dados.folderType}/${dados.name}`,
        config: dados
      });
      if (!saveConfigResponse.ok) {
        throw new Error(saveConfigResponse.data.error || 'Erro ao salvar configuração');
      }

      // 3. Atualizar a lista de clientes
      await fetchClientes();

      // 4. Fechar o modal
      setNovoClienteModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar novo cliente:", error);
      // setError('Erro ao salvar novo cliente: ' + (error instanceof Error ? error.message : String(error))); // Comentado pois setError não está definido aqui
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadClientFolder = async (clientId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/download-client-folder?clientId=${encodeURIComponent(clientId)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro desconhecido ao baixar pasta');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileNameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `${clientId.replace('/', '-')}-folder.zip`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`Pasta do cliente ${clientId} baixada com sucesso.`);

    } catch (err) {
      console.error('Erro ao baixar pasta do cliente:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedClients = {
    ativos: clientes.filter((c) => {
      console.log(`[Dashboard] Filtrando cliente ${c.id || 'N/A'}: folderType = ${c.folderType}, Comparando com 'ativos'`);
      const isAtivo = c.folderType === 'ativos';
      console.log(`[Dashboard] Cliente ${c.id || 'N/A'} é ativo? ${isAtivo}`);
      return isAtivo;
    }),
    cancelados: clientes.filter((c) => {
      console.log(`[Dashboard] Filtrando cliente ${c.id || 'N/A'}: folderType = ${c.folderType}, Comparando com 'cancelados'`);
      const isCancelado = c.folderType === 'cancelados';
      console.log(`[Dashboard] Cliente ${c.id || 'N/A'} é cancelado? ${isCancelado}`);
      return isCancelado;
    }),
  };

  console.log('[Dashboard] Clientes agrupados:', groupedClients);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Dashboard de Clientes</h1>
          {/* Botão Novo Cliente */}
          <button
            onClick={handleAbrirNovoClienteModal}
            className={styles.signOutButton}
            style={{ marginLeft: '15px', marginRight: '15px' }}
          >
            Novo Cliente
          </button>
          {/* Botão Terminal */}
          <button
            onClick={handleAbrirTerminalModal}
            className={styles.signOutButton}
            style={{ marginLeft: '15px', marginRight: '15px' }}
          >
            Terminal
          </button>
          <button
            onClick={() => setRelatoriosModalOpen(true)}
            className={styles.signOutButton}
            style={{ marginLeft: '15px' }}
          >
            Relatórios
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={styles.signOutButton}
          >
            Sair
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>
        {/* PM2 Panel */}
        <PM2Panel />

        {/* Restante do conteúdo */}
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loader}></div>
            <p>Carregando clientes...</p>
          </div>
        ) : (
          <div className={styles.sections}>
            <DroppableSection
              type="ativos"
              title="Clientes Ativos"
              clientes={groupedClients.ativos}
              onEditarCliente={handleEditarCliente}
              onIniciarCliente={handleIniciarCliente}
              onMoveToType={handleMoveToType}
              onCopy={handleCopyClient}
              onPaste={handlePasteClient}
              onDuplicate={handleDuplicateClient}
              onAbrirRelatorioCliente={handleAbrirRelatorioCliente}
              onDownloadClientFolder={handleDownloadClientFolder}
            />

            <DroppableSection
              type="cancelados"
              title="Clientes Cancelados"
              clientes={groupedClients.cancelados}
              onEditarCliente={handleEditarCliente}
              onIniciarCliente={handleIniciarCliente}
              onMoveToType={handleMoveToType}
              onCopy={handleCopyClient}
              onPaste={handlePasteClient}
              onDuplicate={handleDuplicateClient}
              onAbrirRelatorioCliente={handleAbrirRelatorioCliente}
              onDownloadClientFolder={handleDownloadClientFolder}
            />

            <DroppableSection
              type="modelos"
              title="Modelos"
              clientes={modelosList.map(modeloName => ({ id: `modelos/${modeloName}`, name: modeloName, folderType: 'modelos', status: 'modelo' }))}
              onEditarCliente={handleEditarCliente}
              onMoveToType={handleMoveToType}
              onCopy={handleCopyClient}
              onPaste={handlePasteClient}
              onDuplicate={handleDuplicateClient}
              onAbrirRelatorioCliente={handleAbrirRelatorioCliente}
              onDownloadClientFolder={handleDownloadClientFolder}
            />
          </div>
        )}
      </main>

      <EditClientModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        clientId={selectedClientId}
        onSave={handleSaveConfig}
      />

      <InitClientModal
        isOpen={initModalOpen}
        onClose={() => {
          setInitModalOpen(false);
          setInitializingClientId(null);
        }}
        clientId={initializingClientId}
      />
      <ChatAna />

      <RelatoriosModal
        visible={relatoriosModalOpen}
        onClose={() => {
          setRelatoriosModalOpen(false);
          setSelectedClientId(null);
        }}
        reportClientId={selectedClientId}
      />

      {/* Modal Novo Cliente */}
      <NovoClienteModal
        isOpen={novoClienteModalOpen}
        onClose={() => setNovoClienteModalOpen(false)}
        modelos={modelosList}
        onSave={handleSalvarNovoCliente}
      />

      {/* Modal Terminal */}
      <TerminalModal
        isOpen={terminalModalOpen}
        onClose={() => setTerminalModalOpen(false)}
      />

      {/* Tornar ThemeToggle fixo e sobreposto */}
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 1000,
        }}
      >
        <ThemeToggle />
      </div>
    </div>
  );
}
