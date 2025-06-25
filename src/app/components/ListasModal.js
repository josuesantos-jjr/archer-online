'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import readXlsxFile from 'read-excel-file';
import Papa from 'papaparse'; // Importar PapaParse
import MediaUpload from './MediaUpload';
// Importa o componente do modal de verificação de duplicados
import DuplicateCheckModal from './DuplicateCheckModal';

export default function ListasModal({ isOpen, onClose, clientId, clienteSequencialId }) {
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [errorBlocked, setErrorBlocked] = useState(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeList, setActiveList] = useState(null);
  const [showBlockedNumbersModal, setShowBlockedNumbersModal] = useState(false);
  const [showAddBlockedNumberModal, setShowAddBlockedNumberModal] = useState(false);
  const [newBlockedNumber, setNewBlockedNumber] = useState('');
  const [novaLista, setNovaLista] = useState({
    nome: '',
    tags: '',
    contatos: '',
    mensagem: 'Olá {nome}, tudo bem? Espero que a família {sobrenome} goste dos nossos serviços.',
    media: [],
    ativo: true // Adicionado default ativo
  });
  const [menuOpen, setMenuOpen] = useState(null);
   const listaOriginal = useRef(null);
   const [contatosEditados, setContatosEditados] = useState(''); // Novo estado
   const [showMappingModal, setShowMappingModal] = useState(false);
   const [sheetHeaders, setSheetHeaders] = useState([]);
  const [sheetRows, setSheetRows] = useState([]); // Armazenar algumas linhas para preview
  const [columnMapping, setColumnMapping] = useState({ nome: '', telefone: '', tags: '' });
  const [fileData, setFileData] = useState(null); // Armazena dados da planilha para preview/headers
  const [uploadedFile, setUploadedFile] = useState(null); // Armazena o File object original
  // Estados para verificação de duplicados
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState([]);
  const [contactsToSave, setContactsToSave] = useState([]); // Armazena os contatos processados antes da verificação
  const [originalNovaListaData, setOriginalNovaListaData] = useState(null); // Para salvar nome, msg, etc.

  const carregarListas = useCallback(async () => {
    setError(null);
    setFileData(null);
    setSheetHeaders([]);
    setSheetRows([]);
    setColumnMapping({ nome: '', telefone: '', tags: '' });
    setNovaLista({
        nome: '', tags: '', contatos: '',
        mensagem: 'Olá {nome}, tudo bem? Espero que a família {sobrenome} goste dos nossos serviços.',
        media: [], ativo: true
    });


    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/listas?clientId=${encodeURIComponent(clientId)}&t=${timestamp}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido ao carregar listas');
      setListas(data.listas || []);
    } catch (error) {
      setError('Erro ao carregar listas localmente: ' + (error instanceof Error ? error.message : String(error)));
      setListas([]);
    }
  }, [clientId]);

  const carregarNumerosBloqueados = useCallback(async () => {
    setLoadingBlocked(true);
    setErrorBlocked(null);
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/blocked-numbers?clientId=${encodeURIComponent(clientId)}&t=${timestamp}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido ao buscar números bloqueados');
      setBlockedNumbers(data.blockedNumbers || []);
    } catch (err) {
      setErrorBlocked('Erro ao carregar números bloqueados: ' + (err instanceof Error ? err.message : String(err)));
      setBlockedNumbers([]);
    } finally {
      setLoadingBlocked(false);
    }
  }, [clientId]);

  // Função genérica para fechar modais secundários e resetar estados
   const closeSecondaryModal = useCallback((modalSetter) => {
      modalSetter(false);
      setError(null); // Limpa erro geral ao fechar qualquer modal secundário
      setErrorBlocked(null);
      if (modalSetter === setShowViewModal || modalSetter === setShowEditModal) {
          setActiveList(null);
          listaOriginal.current = null;
      }
      if (modalSetter === setShowMappingModal || modalSetter === setShowAddManual || modalSetter === setShowDuplicateModal) {
          setFileData(null);
          setSheetHeaders([]);
          setSheetRows([]);
          setColumnMapping({ nome: '', telefone: '', tags: '' });
          setNovaLista({ nome: '', tags: '', contatos: '', mensagem: 'Olá {nome}, tudo bem? Espero que a família {sobrenome} goste dos nossos serviços.', media: [], ativo: true });
          setDuplicateData([]);
          setContactsToSave([]);
          setOriginalNovaListaData(null);
      }
      if (modalSetter === setShowAddBlockedNumberModal) {
          setNewBlockedNumber('');
      }
  }, []); // Sem dependências externas que mudam frequentemente


  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([carregarListas(), carregarNumerosBloqueados()])
        .catch(err => {
            console.error("Erro ao carregar dados iniciais:", err);
            if (!error && !errorBlocked) {
                setError("Falha ao carregar dados do modal.");
            }
        })
        .finally(() => {
            setLoading(false);
        });
    } else {
        // Resetar estados ao fechar o modal principal
        setListas([]);
        setBlockedNumbers([]);
        setError(null);
        setErrorBlocked(null);
        setLoading(true);
        setLoadingBlocked(false);
        // Chama closeSecondaryModal para garantir reset dos estados dos modais filhos
        closeSecondaryModal(setShowAddManual);
        closeSecondaryModal(setShowViewModal);
        closeSecondaryModal(setShowEditModal);
        closeSecondaryModal(setShowMappingModal);
        closeSecondaryModal(setShowBlockedNumbersModal);
        closeSecondaryModal(setShowAddBlockedNumberModal);
        closeSecondaryModal(setShowDuplicateModal); // Adiciona reset do modal de duplicados
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Removido carregarListas e carregarNumerosBloqueados das dependências


  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = null; // Resetar o input file
    setUploadedFile(file); // Armazena o arquivo original

    setLoading(true);
    setError(null);

  try {
    let headers = [];
    let dataRows = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: false, skipEmptyLines: true,
            complete: (results) => {
              if (!results.data || results.data.length < 1) return reject(new Error("CSV vazio ou sem cabeçalhos."));
              headers = results.data[0].map(String);
              dataRows = results.data.slice(1);
              if (dataRows.length === 0) return reject(new Error("CSV sem dados após cabeçalho."));
              resolve(undefined);
            },
            error: (error) => reject(new Error(`Erro ao analisar CSV: ${error.message}`))
          });
        });
      } else if (file.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
        const allRows = await readXlsxFile(file);
        if (allRows.length < 1) throw new Error("Planilha vazia ou sem cabeçalhos.");
        headers = allRows[0].map(String);
        dataRows = allRows.slice(1);
        if (dataRows.length === 0) throw new Error("Planilha sem dados após cabeçalho.");
      } else {
        throw new Error("Formato não suportado. Use .csv, .xlsx ou .xls.");
      }

      setSheetHeaders(headers);
      setSheetRows(dataRows.slice(0, 5));
      setFileData(dataRows);
      setColumnMapping({ nome: '', telefone: '', tags: '' });
      setShowMappingModal(true);

    } catch (err) {
      setError(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}.`);
      setShowMappingModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Função separada para realizar o salvamento (chamada diretamente ou pelo modal de duplicados)
  const performSaveList = async (contatosParaSalvar, outrosDadosLista, isUpload = false) => {
    setLoading(true);
    setError(null);
    try {
      if (isUpload) {
        // Para upload, o backend de upload já fez o processamento e salvou a lista
        // Então, aqui não precisamos mais chamar /api/listas/upload
        // Mas se o backend de upload retornou duplicados, precisamos salvar os contatos finais em /api/listas
        const response = await fetch('/api/listas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            clienteSequencialId,
            nome: outrosDadosLista.nome,
            mensagem: outrosDadosLista.mensagem,
            media: outrosDadosLista.media,
            contatos: contatosParaSalvar,
            ativo: outrosDadosLista.ativo,
            // Não precisamos mais de tagColumn aqui, pois o backend de upload já usou
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro desconhecido ao salvar lista final');
        console.log("Lista salva com sucesso após verificação de duplicados!");
        return true;
      } else {
        // Para adição manual, continua a lógica original
        const response = await fetch('/api/listas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            clienteSequencialId,
            nome: outrosDadosLista.nome,
            mensagem: outrosDadosLista.mensagem,
            media: outrosDadosLista.media,
            contatos: contatosParaSalvar,
            ativo: outrosDadosLista.ativo,
            tags: outrosDadosLista.tags, // Tags do input manual
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro desconhecido ao salvar lista');
        console.log("Lista salva com sucesso!");
        return true;
      }
    } catch (error) {
      throw new Error('Erro ao salvar lista final: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };


  // Função refatorada para iniciar o processo de salvamento (verificação + salvamento real)
  const handleInitiateSave = async () => {
    console.log("handleInitiateSave: Iniciando no frontend...", { fileData, novaLista }); // Log inicial com estado
    setLoading(true);
    setError(null);
    try {
        let contatosProcessados = [];
        // Não processamos mais as tags aqui no frontend, apenas enviamos o nome da coluna
        // const tagsArray = novaLista.tags ? novaLista.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

        // 1. Processar Contatos (Manual ou Planilha)
        console.log("handleInitiateSave: Verificando fonte de dados. fileData:", fileData, "novaLista.contatos:", novaLista.contatos); // Log 2: Fonte de dados
        if (fileData && columnMapping.nome && columnMapping.telefone) {
          console.log("handleInitiateSave: Processando dados da planilha...", { columnMapping }); // Log 3a: Processando planilha
            const nomeHeader = columnMapping.nome;
            const telefoneHeader = columnMapping.telefone;
            const nomeIndex = sheetHeaders.indexOf(nomeHeader);
            const telefoneIndex = sheetHeaders.indexOf(telefoneHeader);
            if (nomeIndex === -1 || telefoneIndex === -1) throw new Error("Mapeamento de coluna inválido.");
            contatosProcessados = fileData.map(row => {
                const nomeCompleto = row[nomeIndex] ? String(row[nomeIndex]).trim() : '';
                let telefone = row[telefoneIndex] ? String(row[telefoneIndex]).trim() : '';
                const tagValue = columnMapping.tags ? (row[sheetHeaders.indexOf(columnMapping.tags)] ? String(row[sheetHeaders.indexOf(columnMapping.tags)]).trim() : '') : ''; // Obtém o valor da tag
                const tagsArray = tagValue ? [tagValue] : []; // Cria array de tags

                telefone = telefone.replace(/\D/g, '');
                if (!nomeCompleto || !telefone) return null;
                const partes = nomeCompleto.split(' ');

                return {
                  nome: partes[0],
                  sobrenome: partes.slice(1).join(' ') || undefined,
                  telefone,
                  tags: tagsArray // Inclui as tags extraídas da linha
                };
            }).filter(Boolean);
        } else if (!fileData && novaLista.contatos) {
            console.log("handleInitiateSave: Processando dados manuais...");
            const contatosManuais = novaLista.contatos;
            console.log("Contatos Manuais:", contatosManuais);
            contatosProcessados = contatosManuais.split('\n').map(linha => {
            const partesLinha = linha.split(',').map(s => s.trim());
            console.log("Linha processada:", partesLinha);
            if (partesLinha.length < 2 || !partesLinha[0] || !partesLinha[1]) return null;
            const nomeCompleto = partesLinha[0].trim();
            let telefone = partesLinha[1].trim().replace(/\D/g, '');
            if (!telefone) return null;
            const partesNome = nomeCompleto.split(' ');
            // Não adicionamos mais tags aqui, o backend fará isso
            return { nome: partesNome[0], sobrenome: partesNome.slice(1).join(' ') || undefined, telefone };
          }).filter(Boolean);
        } else {
          console.log("handleInitiateSave: Nenhuma fonte de dados encontrada (nem planilha, nem manual)."); // Log 3c: Sem dados
        }
        console.log("Contatos processados:", contatosProcessados);

        if (contatosProcessados.length === 0) throw new Error("Nenhum contato válido encontrado para salvar.");
        if (!novaLista.nome.trim()) throw new Error("O nome da lista é obrigatório.");


        // 2. Chamar API de Verificação de Duplicados
        const phoneNumbersToCheck = contatosProcessados.map(c => c.telefone);
        console.log("handleInitiateSave: clientId:", clientId, "phoneNumbersToCheck:", phoneNumbersToCheck); // Log adicional
        console.log("handleInitiateSave: Chamando API /api/check-list-duplicates..."); // Log 5: Chamando API
        const checkResponse = await fetch('/api/check-list-duplicates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: clientId, newPhoneNumbers: phoneNumbersToCheck }),
        });
        const checkData = await checkResponse.json();
        console.log("handleInitiateSave: Resposta da API /api/check-list-duplicates:", checkResponse.status, checkData); // Log 6: Resposta API
        if (!checkResponse.ok) throw new Error(checkData.error || 'Erro ao verificar duplicados');

        // 3. Lógica Condicional
        if (checkData.duplicates && checkData.duplicates.length > 0) {
            console.log(`handleInitiateSave: ${checkData.duplicates.length} duplicados encontrados. Abrindo modal.`); // Log 7a: Duplicados encontrados
            setDuplicateData(checkData.duplicates);
            setContactsToSave(contatosProcessados);
            setOriginalNovaListaData({
                nome: novaLista.nome.trim(),
                mensagem: novaLista.mensagem,
                media: novaLista.media || [],
                ativo: novaLista.ativo !== false,
                // Enviamos o nome da coluna de tags, não as tags processadas
                tagColumn: columnMapping.tags
            });
            setShowDuplicateModal(true);
            setLoading(false);
        } else {
            console.log("handleInitiateSave: Nenhum duplicado encontrado. Salvando diretamente..."); // Log 7b: Sem duplicados
            const outrosDadosLista = {
                nome: novaLista.nome.trim(),
                mensagem: novaLista.mensagem,
                media: novaLista.selectedMediaPath ? [{ arquivo: novaLista.selectedMediaPath, tipo: novaLista.media.find(m => m.arquivo === novaLista.selectedMediaPath)?.tipo }] : [],
                ativo: novaLista.ativo !== false,
                // Enviamos o nome da coluna de tags, não as tags processadas
                tagColumn: columnMapping.tags
              };
            const saveSuccess = await performSaveList(contatosProcessados, outrosDadosLista);
            if (saveSuccess) {
                console.log("handleInitiateSave: Salvamento direto bem-sucedido."); // Log 8: Sucesso no salvamento direto
                closeSecondaryModal(setShowAddManual);
                await carregarListas();
            } else {
                 console.log("handleInitiateSave: performSaveList (direto) indicou falha."); // Log 9: Falha no salvamento direto
            }
        }

    } catch (err) {
        console.error("Erro em handleInitiateSave:", err); // Log 10: Erro capturado
        setError('Erro ao processar/verificar lista: ' + (err instanceof Error ? err.message : String(err)));
        setLoading(false);
    }
  };


  const handleDeleteLista = async (lista) => {
    if (!confirm(`Tem certeza que deseja excluir a lista "${lista.nome}" e toda a sua mídia associada?`)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/listas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, listaId: lista.id }),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Erro desconhecido ao excluir'); }
      await carregarListas();
      await carregarListas();
    } catch (err) {
      setError('Erro ao excluir lista: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateLista = async () => {
    if (!activeList || !listaOriginal.current) return;
    setLoading(true);
    setError(null);
    try {
      const tagsArray = activeList.tags ? activeList.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
      const linhas = contatosEditados.split('\n');
      const novosContatos = linhas.map(linha => {
          if (!linha.trim()) return null;
          const [nomeCompleto, telefoneInput] = linha.split(',').map(s => s ? s.trim() : '');
          if (!nomeCompleto || !telefoneInput) return null;
          const telefoneLimpo = String(telefoneInput).replace(/\D/g, '');
          if (!telefoneLimpo) return null;
          return {
              nome: nomeCompleto.split(' ')[0],
              sobrenome: nomeCompleto.split(' ').slice(1).join(' ') || undefined,
              telefone: telefoneLimpo,
              tags: tagsArray || []
          };
        }).filter(Boolean);
        setActiveList(prev => ({ ...prev, contatos: novosContatos }));

      if (contatosEditados.length === 0 && activeList.contatos.length > 0) {
          if (!confirm("Atenção: Todos os contatos parecem inválidos ou foram removidos. Deseja salvar a lista vazia?")) {
              setLoading(false);
              return;
          }
      }
      if (!activeList.nome.trim()) throw new Error("O nome da lista não pode ficar vazio.");


      const response = await fetch('/api/listas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clientId,
            clienteSequencialId,
            listaId: activeList.id,
            novoNome: activeList.nome.trim(),
            contatos: novosContatos,
            mensagem: activeList.mensagem,
            media: activeList.selectedMediaPath ? [{ arquivo: activeList.selectedMediaPath, tipo: activeList.media.find(m => m.arquivo === activeList.selectedMediaPath)?.tipo }] : [],
            ativo: activeList.ativo !== false,
            tags: activeList.tags ? activeList.tags.split(',').map(tag => tag.trim()).filter(Boolean).join(',') : ''
        }),
      });

      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Erro ao atualizar lista'); }

      closeSecondaryModal(setShowEditModal);
      await carregarListas();
    } catch (err) {
      setError('Erro ao atualizar lista: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
        setLoading(false);
    }
  };

  const handleToggleAtivo = async (listaNome, statusAtual) => {
      const novoStatus = !statusAtual;
      setListas(prevListas => prevListas.map(l =>
          l.nome === listaNome ? { ...l, ativo: novoStatus } : l
      ));
      setError(null);

      try {
          // Encontra a lista completa que está sendo atualizada a partir do estado atual
          const listaSendoAtualizada = listas.find(l => l.nome === listaNome);

          if (!listaSendoAtualizada) {
              console.error(`[ListasModal] handleToggleAtivo: Lista "${listaNome}" não encontrada para atualização.`);
              // Reverte a mudança otimista no estado se a lista não for encontrada
              setListas(prevListas => prevListas.map(l =>
                  l.nome === listaNome ? { ...l, ativo: statusAtual } : l
              ));
              setError(`Erro ao atualizar status: lista "${listaNome}" não encontrada.`);
              return;
          }

          // Monta o payload garantindo que 'ativo' seja novoStatus e usando o ID correto da lista
          // As outras propriedades da lista são preservadas pelo spread ...listaSendoAtualizada
          const payload = {
              ...listaSendoAtualizada, // Espalha as propriedades atuais da lista (incluindo nome, mensagem, contatos, media, etc.)
              clientId: clientId, // Garante que o clientId correto seja enviado (da prop do modal)
              clienteSequencialId: clienteSequencialId, // Garante que o clienteSequencialId correto seja enviado (da prop do modal)
              listaId: listaSendoAtualizada.id, // Usa o ID real da lista encontrada
              ativo: novoStatus // Sobrescreve 'ativo' com o novo status desejado
          };

          const response = await fetch('/api/listas', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || 'Erro ao atualizar status');
          }
      } catch (err) {
          setError(`Erro ao ${novoStatus ? 'ativar' : 'desativar'} lista: ${err instanceof Error ? err.message : String(err)}`);
          setListas(prevListas => prevListas.map(l =>
              l.nome === listaNome ? { ...l, ativo: statusAtual } : l
          ));
      }
  };


  const handleAddBlockedNumber = async () => {
    const numerosInput = newBlockedNumber.trim().split(/[\n,;]+/).map(n => n.trim());
    const numerosValidos = numerosInput
      .map(num => num.replace(/\D/g, ''))
      .filter(num => num.length > 5);

    if (numerosValidos.length === 0) {
      setErrorBlocked("Nenhum número válido encontrado. Insira números válidos.");
      return;
    }

    setLoadingBlocked(true);
    setErrorBlocked(null);
    let successCount = 0;
    let errorMessages = [];

    try {
      for (const numero of numerosValidos) {
        try {
          const response = await fetch('/api/blocked-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, clienteSequencialId, number: numero }), // Adicionar ID sequencial
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `Erro ${response.status} ao adicionar ${numero}`);
          successCount++;
        } catch (err) {
          console.error(`Falha ao adicionar ${numero}:`, err);
          errorMessages.push((err instanceof Error ? err.message : String(err)) || `Falha ao adicionar ${numero}`);
        }
      }

      setNewBlockedNumber('');
      setShowAddBlockedNumberModal(false);
      await carregarNumerosBloqueados();

      if (errorMessages.length > 0) {
         setError(`Adicionados ${successCount} de ${numerosValidos.length} número(s). Erros: ${errorMessages.join('; ')}`);
      }

    } catch (err) {
      setErrorBlocked('Erro inesperado durante a adição em massa: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleDeleteBlockedNumber = async (numero) => {
    if (!confirm(`Tem certeza que deseja desbloquear o número ${numero}?`)) return;

    setLoadingBlocked(true);
    setErrorBlocked(null);
    try {
      const response = await fetch('/api/blocked-numbers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clienteSequencialId, number: numero }), // Adicionar ID sequencial
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Erro ${response.status} ao desbloquear número`);
      }
      await carregarNumerosBloqueados();
    } catch (err) {
      setErrorBlocked('Erro ao excluir número: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
        setLoadingBlocked(false);
    }
  };

  const handleDownloadClientFolder = async (clientId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/download-client-folder?clientId=${encodeURIComponent(clientId)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro desconhecido ao baixar pasta');
      }

      // A resposta deve ser o blob do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Define o nome do arquivo usando o header Content-Disposition se disponível, caso contrário usa um nome padrão
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileNameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `${clientId}-folder.zip`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`Pasta do cliente ${clientId} baixada com sucesso.`);

    } catch (err) {
      setError('Erro ao baixar pasta do cliente: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isSecondaryModalOpen = showMappingModal || showAddManual || showEditModal || showViewModal || showBlockedNumbersModal || showAddBlockedNumberModal || showDuplicateModal;

  return (
    <>
      {/* --- Main List Modal --- */}
      <div className="modal-overlay">
        <div className="modal-content"> {/* Container principal */}
          <div className="modal-header">
            <h2>Gerenciar Listas e Bloqueios ({clientId})</h2>
            <div className="actions">
              <label className="upload-button">
                Adicionar Lista (Planilha)
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }}/>
              </label>
              <button className="add-button" onClick={() => {
                 setNovaLista({ nome: '', tags: '', contatos: '', mensagem: 'Olá {nome}, tudo bem? Espero que a família {sobrenome} goste dos nossos serviços.', media: [], ativo: true });
                 setFileData(null);
                 setShowAddManual(true);
              }}>
                Adicionar Lista (Manual)
              </button>
              <button onClick={onClose} className="close-button">Voltar</button>
            </div>
          </div>

          {error && !isSecondaryModalOpen && (
            <div className="error-message">{error}</div>
          )}

          {loading && !isSecondaryModalOpen ? (
            <p>Carregando dados...</p>
          ) : !isSecondaryModalOpen ? (
            <>
              {/* Painel de Resumo */}
              {listas.length > 0 && (
                <div className="summary-panel">
                  <p>
                    Total de Listas: {listas.length} | Total de Contatos: {listas.reduce((total, lista) => total + (lista.totalContatos || 0), 0)}
                  </p>
                </div>
              )}

              {/* Grid de Listas */}
              <div className="lists-grid">
                {listas.length === 0 ? (
                  <p>Nenhuma lista encontrada</p>
                ) : (
                  listas.map((lista) => {
                    const total = lista.totalContatos || 0;
                    const disparados = lista.contatosDisparados || 0;
                    const leadsGerados = lista.contatosLeadGerado || 0; // Pega contagem de leads
                    const progresso = total > 0 ? Math.round((disparados / total) * 100) : 0;
                    const isAtiva = lista.ativo !== false;

                    return (
                      <div key={lista.nome} className={`list-card ${!isAtiva ? 'inactive' : ''}`}>
                        <div className="card-header">
                          <div className="card-title">
                            <h3>{lista.nome}</h3>
                            <label className="switch">
                              <input type="checkbox" checked={isAtiva} onChange={() => handleToggleAtivo(lista.nome, isAtiva)}/>
                              <span className="slider"></span>
                            </label>
                          </div>
                          <div className="menu-container">
                            <button className="menu-trigger" onClick={() => setMenuOpen(menuOpen === lista.nome ? null : lista.nome)}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                            </button>
                            {menuOpen === lista.nome && (
                              <div className="dropdown-menu">
                                <button onClick={() => { setActiveList(lista); setShowViewModal(true); setMenuOpen(null); }}>Visualizar</button>
                                <button onClick={() => {
                                  console.log('[ListasModal] Edit button clicked. List data:', lista); // Log the list data
                                  const listaParaEditar = JSON.parse(JSON.stringify(lista));
                                  listaParaEditar.tags = listaParaEditar.contatos?.[0]?.tags ? (Array.isArray(listaParaEditar.contatos[0].tags) ? listaParaEditar.contatos[0].tags.join(', ') : listaParaEditar.contatos[0].tags) : '';
                                  listaParaEditar.selectedMediaPath = listaParaEditar.media?.[0]?.arquivo || listaParaEditar.selectedMediaPath || lista.selectedMediaPath || null;
                                  setActiveList(listaParaEditar);
                                  listaOriginal.current = lista;
                                  setContatosEditados(Array.isArray(listaParaEditar.contatos) ? listaParaEditar.contatos.map(c => `${c.nome}${c.sobrenome ? ' ' + c.sobrenome : ''}, ${c.telefone}`).join('\n') : '');
                                  setShowEditModal(true);
                                  setMenuOpen(null);
                                }}>Editar</button>
                                <button onClick={() => { handleDeleteLista(lista); setMenuOpen(null); }} className="delete-option">Excluir</button>
                                <button onClick={() => { handleDownloadClientFolder(clientId); setMenuOpen(null); }}>Baixar Pasta</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p>
                             {total} contatos - <span className={`status ${!isAtiva ? 'inactive' : 'active'}`}>{!isAtiva ? 'Inativa' : 'Ativa'}</span>
                             {/* Mostra contagem de leads */}
                             <span className="lead-count"> | Leads: {leadsGerados}</span>
                          </p>
                          {lista.contatos?.[0]?.tags && (<p className="tags-line">Tags: {Array.isArray(lista.contatos[0].tags) ? lista.contatos[0].tags.join(', ') : lista.contatos[0].tags}</p>)}
                          {/* --- Seção de Progresso --- */}
                          <div className="progress-section">
                            <p>Progresso Disparo: {disparados} / {total} ({progresso}%)</p>
                            <div className="progress-bar-container">
                              <div className="progress-bar-fill" style={{ width: `${progresso}%` }}></div>
                            </div>
                          </div>
                          {/* --- Fim Seção de Progresso --- */}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* --- Seção Números Bloqueados --- */}
              <div className="blocked-numbers-section">
                <h2>Números Bloqueados</h2>
                {loadingBlocked ? (
                  <p>Carregando números bloqueados...</p>
                ) : errorBlocked ? (
                  <div className="error-message">{errorBlocked}</div>
                ) : (
                  <div className="list-card blocked-card">
                    <div className="card-header">
                      <div className="card-title"><h3>Lista de Bloqueio</h3></div>
                    </div>
                    <div>
                      <p>{blockedNumbers.length} número(s) bloqueado(s).</p>
                      <div className="button-group-inline">
                        <button
                          className="view-button"
                          onClick={() => { setErrorBlocked(null); setShowBlockedNumbersModal(true); }}
                          disabled={blockedNumbers.length === 0 && !loadingBlocked}
                        >
                          Visualizar / Editar
                        </button>
                        <button
                          className="add-button"
                          onClick={() => { setNewBlockedNumber(''); setErrorBlocked(null); setShowAddBlockedNumberModal(true); }}
                          disabled={loadingBlocked}
                        >
                          Adicionar Número
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null /* Fim do conteúdo principal condicional */}
        </div> {/* Fim modal-content principal */}
      </div> {/* Fim modal-overlay principal */}

      {/* --- Modais Secundários --- */}

      {/* --- Mapping Modal --- */}
      {showMappingModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* ... (conteúdo omitido para brevidade) ... */}
             <div className="modal-header">
               <h2>Mapear Colunas da Planilha</h2>
               <button onClick={() => closeSecondaryModal(setShowMappingModal)} className="close-button">Cancelar</button>
             </div>
             {error && <div className="error-message">{error}</div>}
             <div className="mapping-content">
               <p>Selecione as colunas da sua planilha que correspondem aos campos Nome e Telefone.</p>
               <div className="mapping-selectors">
                 <div className="form-group">
                   <label htmlFor="map-nome">Coluna para Nome:</label>
                   <select id="map-nome" value={columnMapping.nome} onChange={(e) => setColumnMapping(prev => ({ ...prev, nome: e.target.value }))} className="form-input">
                     <option value="">Selecione a coluna...</option>
                     {sheetHeaders.map((header, index) => (<option key={`nome-${index}`} value={header}>{header}</option>))}
                   </select>
                 </div>
                 <div className="form-group">
                   <label htmlFor="map-telefone">Coluna para Telefone:</label>
                   <select id="map-telefone" value={columnMapping.telefone} onChange={(e) => setColumnMapping(prev => ({ ...prev, telefone: e.target.value }))} className="form-input">
                     <option value="">Selecione a coluna...</option>
                     {sheetHeaders.map((header, index) => (<option key={`tel-${index}`} value={header}>{header}</option>))}
                   </select>
                 </div>
                 <div className="form-group">
                   <label htmlFor="map-tags">Coluna para Tags:</label>
                   <select id="map-tags" value={columnMapping.tags} onChange={(e) => setColumnMapping(prev => ({ ...prev, tags: e.target.value }))} className="form-input">
                     <option value="">Selecione a coluna...</option>
                     {sheetHeaders.map((header, index) => (<option key={`tags-${index}`} value={header}>{header}</option>))}
                   </select>
                 </div>
               </div>
               <div className="preview-table">
                 <h4>Pré-visualização dos Dados (primeiras 5 linhas):</h4>
                 <table>
                   <thead><tr>{sheetHeaders.map((header, index) => (<th key={`header-${index}`}>{header}</th>))}</tr></thead>
                   <tbody>{sheetRows.map((row, rowIndex) => (<tr key={`row-${rowIndex}`}>{row.map((cell, cellIndex) => (<td key={`cell-${rowIndex}-${cellIndex}`}>{String(cell)}</td>))}</tr>))}</tbody>
                 </table>
               </div>
             </div>
             <div className="button-group">
               <button onClick={() => closeSecondaryModal(setShowMappingModal)} className="cancel-button">Cancelar</button>
               <button
                 onClick={() => {
                   if (!columnMapping.nome || !columnMapping.telefone) { setError('Por favor, mapeie as colunas de Nome e Telefone.'); return; }
                   if (columnMapping.nome === columnMapping.telefone) { setError('As colunas de Nome e Telefone não podem ser a mesma.'); return; }
                   setError(null);
                   setShowMappingModal(false);
                   setNovaLista(prev => ({ ...prev, tags: columnMapping.tags, nome: '', contatos: '', mensagem: 'Olá {nome}, tudo bem? Espero que a família {sobrenome} goste dos nossos serviços.', media: [], ativo: true }));
                   setShowAddManual(true); // Abre o modal de adicionar/finalizar
                 }}
                 className="save-button"
                 disabled={!columnMapping.nome || !columnMapping.telefone || loading}
               >
                 {loading ? 'Processando...' : 'Próximo'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* --- Add Manual / Finalize Upload Modal --- */}
      {showAddManual && (
         <div className="modal-overlay">
           <div className="modal-content">
             {/* ... (conteúdo omitido para brevidade) ... */}
              <div className="modal-header">
                <h3>{fileData ? 'Finalizar Criação da Lista (via Planilha)' : 'Adicionar Nova Lista (Manual)'}</h3>
                <button onClick={() => closeSecondaryModal(setShowAddManual)} className="close-button">Cancelar</button>
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="form-group">
                <label>Nome da Lista</label>
                <input type="text" value={novaLista.nome} onChange={(e) => setNovaLista(prev => ({ ...prev, nome: e.target.value }))} placeholder="Digite o nome da lista" className="form-input"/>
              </div>
              <div className="form-group">
                <label>Tags (serão aplicadas a todos os contatos desta lista)</label>
                <input type="text" value={novaLista.tags || ''} onChange={(e) => setNovaLista(prev => ({ ...prev, tags: e.target.value }))} placeholder="Ex: clientes alto padrão, leads frios (separado por vírgula)" className="form-input tags-input"/>
              </div>
              <div className="form-group">
                <label>Mensagem Personalizada</label>
                <div className="message-help">Você pode usar: {'{nome}'} e {'{sobrenome}'} na mensagem</div>
                <textarea value={novaLista.mensagem} onChange={(e) => setNovaLista(prev => ({ ...prev, mensagem: e.target.value }))} placeholder="Olá {nome}, tudo bem? Espero que a família {sobrenome} esteja bem!" rows={4} className="form-input"/>
              </div>
              <div className="form-group">
                <label>Mídia (Opcional)</label>
                <MediaUpload
                  clientId={clientId}
                  listaNome={novaLista.nome}
                  media={novaLista.media || []}
                  selectedMediaPath={novaLista.selectedMediaPath}
                  onUpload={(data) => setNovaLista(prev => ({ ...prev, media: [...(prev.media || []), data] }))}
                  onSelectMedia={(path) => setNovaLista(prev => ({ ...prev, selectedMediaPath: path }))}
                />
              </div>
              {!fileData && ( // Mostra campo de contatos apenas se for adição manual
                <div className="form-group">
                  <label>Contatos (Nome Completo, Telefone - um por linha)</label>
                  <textarea value={novaLista.contatos} onChange={(e) => setNovaLista(prev => ({ ...prev, contatos: e.target.value }))} placeholder="João Silva, 5511999999999&#10;Maria Santos, 5511988888888" rows={5} className="form-input"/>
                </div>
              )}
              {fileData && ( // Mostra resumo se veio da planilha
                 <div className="info-section" style={{background: '#e3f2fd', border: '1px solid #bbdefb'}}>
                     <p><strong>Planilha carregada:</strong> {fileData.length} contatos serão adicionados/atualizados.</p>
                     <p><strong>Mapeamento:</strong> Nome: &apos;{columnMapping.nome}&apos;, Telefone: &apos;{columnMapping.telefone}&apos;</p>
                 </div>
              )}
              <div className="button-group">
                <button onClick={() => closeSecondaryModal(setShowAddManual)} className="cancel-button">Cancelar</button>
                {/* Confirma que o botão chama handleInitiateSave */}
                <button
                  onClick={() => handleInitiateSave()}
                  className="save-button"
                  disabled={loading || !novaLista.nome || (!fileData && !(novaLista.contatos ? novaLista.contatos.trim() : ''))}
                >
                  {loading ? 'Verificando...' : 'Salvar Lista'}
                </button>
             </div>
           </div>
         </div>
      )}

       {/* --- Edit Modal --- */}
      {showEditModal && activeList && (
         <div className="modal-overlay">
           <div className="modal-content">
             {/* ... (conteúdo omitido para brevidade) ... */}
              <div className="modal-header">
                <h2>Editar Lista: {listaOriginal.current?.nome}</h2>
                <button onClick={() => closeSecondaryModal(setShowEditModal)} className="close-button">Fechar</button>
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="edit-content">
                <div className="form-group">
                  <div className="form-header">
                    <label>Nome da Lista</label>
                    <label className="switch">
                      <input type="checkbox" checked={activeList.ativo !== false} onChange={(e) => setActiveList(prev => ({ ...prev, ativo: e.target.checked }))}/>
                      <span className="slider"></span>
                      <span className="switch-label">{activeList.ativo === false ? 'Inativa' : 'Ativa'}</span>
                    </label>
                  </div>
                  <input type="text" value={activeList.nome} onChange={(e) => setActiveList(prev => ({ ...prev, nome: e.target.value }))} className="form-input"/>
                </div>
                <div className="form-group">
                  <label>Tags (aplicadas a todos os contatos)</label>
                  <input type="text" value={activeList.tags || ''} onChange={(e) => setActiveList(prev => ({ ...prev, tags: e.target.value }))} placeholder="Ex: alto padrão, condomínio fechado" className="form-input"/>
                </div>
                <div className="form-group">
                  <label>Mensagem Personalizada</label>
                  <div className="message-help">Você pode usar: {'{nome}'} e {'{sobrenome}'} na mensagem</div>
                  <textarea value={activeList.mensagem || ''} onChange={(e) => setActiveList(prev => ({ ...prev, mensagem: e.target.value }))} placeholder="Olá {nome}, tudo bem? Espero que a família {sobrenome} esteja bem!" rows={4} className="form-input"/>
                </div>
                <div className="form-group">
                  <label>Mídia</label>
                  <MediaUpload
                    clientId={clientId}
                    listaNome={listaOriginal.current?.nome}
                    media={activeList.media || []}
                    selectedMediaPath={activeList.selectedMediaPath}
                    onUpload={(data) => setActiveList(prev => ({ ...prev, media: [...(prev.media || []), data] }))}
                    onSelectMedia={(path) => setActiveList(prev => ({ ...prev, selectedMediaPath: path }))}
                  />
                </div>
                <div className="form-group">
                  <label>Contatos (Nome Completo, Telefone - um por linha)</label>
                  <textarea
                    value={contatosEditados}
                    onChange={(e) => setContatosEditados(e.target.value)}
                    placeholder="João Silva, 5511999999999&#10;Ana Santos, 5511988888888"
                    rows={10}
                    className="form-input"
                  />
                </div>
                <div className="button-group">
                  <button onClick={() => closeSecondaryModal(setShowEditModal)} className="cancel-button">Cancelar</button>
                  <button onClick={() => {
                      const linhas = contatosEditados.split('\n');
                      const novosContatos = linhas.map(linha => {
                        if (!linha.trim()) return null;
                        const [nomeCompleto, telefoneInput] = linha.split(',').map(s => s ? s.trim() : '');
                        if (!nomeCompleto || !telefoneInput) return null;
                        const telefoneLimpo = String(telefoneInput).replace(/\D/g, '');
                        return { nome: nomeCompleto.split(' ')[0], sobrenome: nomeCompleto.split(' ').slice(1).join(' ') || undefined, telefone: telefoneLimpo };
                      }).filter(Boolean);
                      handleUpdateLista(novosContatos);
                    }} className="save-button" disabled={loading || !activeList.nome}>
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
           </div>
         </div>
      )}

      {/* --- View Modal --- */}
      {showViewModal && activeList && (
         <div className="modal-overlay">
           <div className="modal-content">
             <div className="modal-header">
               <h2>Visualizar Lista: {activeList.nome}</h2>
               <button onClick={() => closeSecondaryModal(setShowViewModal)} className="close-button">Fechar</button>
             </div>
             {error && <div className="error-message">{error}</div>}
             <div className="view-content">
               <div className="info-section">
                 <div className="info-item">
                   <div className="info-header">
                     <div><label>Nome da Lista:</label><p>{activeList.nome}</p></div>
                     <div className={`view-status ${activeList.ativo === false ? 'inactive' : 'active'}`}>{activeList.ativo === false ? 'Lista Inativa' : 'Lista Ativa'}</div>
                   </div>
                 </div>
                 {activeList.contatos?.[0]?.tags && (<div className="info-item"><label>Tags:</label><p>{Array.isArray(activeList.contatos[0].tags) ? activeList.contatos[0].tags.join(', ') : activeList.contatos[0].tags}</p></div>)}
                 {activeList.media && activeList.media.length > 0 && (<div className="info-item"><label>Arquivos de Mídia:</label><MediaUpload clientId={clientId} listaNome={activeList.nome} media={activeList.media} disabled={true}/></div>)}
                 {activeList.mensagem && (<div className="info-item"><label>Mensagem Personalizada:</label><p>{activeList.mensagem}</p><div className="message-preview"><label>Exemplo com primeiro contato (se houver):</label><p>{activeList.contatos[0] ? activeList.mensagem.replace('{nome}', activeList.contatos[0]?.nome || '').replace('{sobrenome}', activeList.contatos[0]?.sobrenome || '') : '(sem contatos para pré-visualizar)'}</p></div></div>)}
                 <div className="info-item"><label>Total de Contatos:</label><p>{activeList.totalContatos || (Array.isArray(activeList.contatos) ? activeList.contatos.length : 0)}</p></div>
                 {/* Adiciona contagem de leads na visualização */}
                 <div className="info-item"><label>Leads Gerados:</label><p>{activeList.contatosLeadGerado || 0}</p></div>
               </div>
               <div className="contacts-table">
                 <table>
                   <thead>
                     <tr><th>Nome</th><th>Telefone</th><th style={{ textAlign: 'center' }}>Status Disparo</th><th style={{ textAlign: 'center' }}>Lead Gerado?</th>{/* Nova coluna */}</tr>
                   </thead>
                   <tbody>
                    {Array.isArray(activeList.contatos) && activeList.contatos.length > 0 ?
                        activeList.contatos.map((contato, idx) => (
                            <tr key={idx}>
                                <td>{contato.nome}{contato.sobrenome ? ` ${contato.sobrenome}` : ''}</td>
                                <td>{contato.telefone}</td>
                                <td style={{ textAlign: 'center' }}>
                                   {/* Exibe o status do disparo */}
                                   {contato.disparo === 'sim' ? (
                                       <span className="statusDisparado">✅ Sim</span>
                                   ) : contato.disparo === 'falha_wpp' ? (
                                       <span className="statusFalha">❌ Sem WPP</span>
                                   ) : (
                                       <span className="statusPendente">Não</span>
                                   )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                   {/* Exibe status do lead */}
                                   {contato.leadGerado ? (
                                       <span className="statusLeadGerado">✔️ Sim</span>
                                   ) : (
                                       <span className="statusPendente">Não</span>
                                   )}
                                </td>
                            </tr>
                        ))
                     : (
                        <tr><td colSpan="4" style={{ textAlign: 'center' }}>Nenhum contato nesta lista.</td></tr>
                     )
                   }
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
         </div>
      )}

      {/* --- Blocked Numbers View/Edit Modal --- */}
      {showBlockedNumbersModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* ... (conteúdo omitido para brevidade) ... */}
             <div className="modal-header">
               <h2>Números Bloqueados ({blockedNumbers.length})</h2>
               <button onClick={() => closeSecondaryModal(setShowBlockedNumbersModal)} className="close-button">Fechar</button>
             </div>
             {errorBlocked && <div className="error-message">{errorBlocked}</div>}
             {loadingBlocked && <p>Carregando...</p>}
             {!loadingBlocked && blockedNumbers.length === 0 && <p>Nenhum número bloqueado.</p>}
             {!loadingBlocked && blockedNumbers.length > 0 && (
               <div className="blocked-numbers-list">
                 <table>
                   <thead>
                     <tr>
                       <th>Número</th>
                       <th>Ação</th>
                     </tr>
                   </thead>
                   <tbody>
                     {blockedNumbers.map((numero) => (
                       <tr key={numero}>
                         <td>{numero}</td>
                         <td>
                           <button
                             onClick={() => handleDeleteBlockedNumber(numero)}
                             className="delete-button"
                             disabled={loadingBlocked}
                           >
                             Desbloquear
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
             <div className="button-group">
                  <button
                     className="add-button"
                     onClick={() => {
                         closeSecondaryModal(setShowBlockedNumbersModal); // Fecha este modal
                         setShowAddBlockedNumberModal(true); // Abre o de adicionar
                     }}
                     disabled={loadingBlocked}
                   >
                     Adicionar Novo Número
                   </button>
                 <button onClick={() => closeSecondaryModal(setShowBlockedNumbersModal)} className="cancel-button">Fechar</button>
             </div>
          </div>
        </div>
      )}

      {/* --- Add Blocked Number Modal --- */}
      {showAddBlockedNumberModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            {/* ... (conteúdo omitido para brevidade) ... */}
             <div className="modal-header">
               <h3>Adicionar Número à Lista de Bloqueio</h3>
               <button onClick={() => closeSecondaryModal(setShowAddBlockedNumberModal)} className="close-button">Cancelar</button>
             </div>
             {errorBlocked && <div className="error-message">{errorBlocked}</div>}
             <div className="form-group">
               <label htmlFor="blocked-number-input">Números de Telefone (um por linha)</label>
               <textarea
                 id="blocked-number-input"
                 value={newBlockedNumber}
                 onChange={(e) => setNewBlockedNumber(e.target.value)}
                 placeholder="5511999999999\n552188888888\n..." // Exemplo com nova linha
                 className="form-input"
                 rows={5} // Ajuste a altura conforme necessário
               />
               <div className="message-help" style={{marginTop: '4px'}}>Insira um número por linha, incluindo DDI e DDD.</div>
             </div>
             <div className="button-group">
               <button onClick={() => closeSecondaryModal(setShowAddBlockedNumberModal)} className="cancel-button">Cancelar</button>
               <button
                 onClick={handleAddBlockedNumber}
                 className="save-button"
                 disabled={loadingBlocked || !newBlockedNumber.trim()}
               >
                 {loadingBlocked ? 'Adicionando...' : 'Adicionar e Bloquear'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* --- Duplicate Check Modal --- */}
       {showDuplicateModal && ( // Renderiza o modal se showDuplicateModal for true
            <DuplicateCheckModal
                isOpen={showDuplicateModal}
                onClose={() => closeSecondaryModal(setShowDuplicateModal)} // Usa a função de fechar modal secundário
                duplicateData={duplicateData}
                originalContacts={contactsToSave}
                originalNovaListaData={originalNovaListaData}
                onConfirmSave={async (contactsToFinallySave) => {
                    try {
                        const saveSuccess = await performSaveList(contactsToFinallySave, originalNovaListaData);
                        if (saveSuccess) {
                            closeSecondaryModal(setShowDuplicateModal);
                            closeSecondaryModal(setShowAddManual);
                            await carregarListas();
                        }
                    } catch (err) {
                        setError('Erro ao salvar lista após verificação: ' + (err instanceof Error ? err.message : String(err)));
                        setLoading(false);
                        closeSecondaryModal(setShowDuplicateModal);
                    }
                }}
            />
       )}

      {/* Estilos JSX */}
       <style jsx>{`
         /* Estilos mínimos para garantir funcionalidade e evitar quebras */
         .modal-overlay {
           position: fixed; top: 0; left: 0; right: 0; bottom: 0;
           background-color: rgba(0, 0, 0, 0.6);
           display: flex; justify-content: center; align-items: center;
           z-index: 1000; /* Base z-index */
           padding: 20px;
         }
         .modal-content {
            background: white; padding: 20px; border-radius: 8px;
            max-height: 90vh; overflow-y: auto;
            width: 80%; /* Largura padrão, pode ser ajustada */
            max-width: 900px; /* Largura máxima */
            display: flex; /* Adicionado para controle interno */
            flex-direction: column; /* Adicionado para controle interno */
         }
         /* Z-index maior para modais secundários */
         .modal-overlay:has(.mapping-content),
         .modal-overlay:has(.edit-content),
         .modal-overlay:has(.view-content),
         .modal-overlay:has(.duplicate-check-content), /* Adiciona para modal de duplicados */
         .modal-overlay:has(h3:contains("Adicionar Nova Lista")),
         .modal-overlay:has(h3:contains("Finalizar Criação")),
         .modal-overlay:has(h3:contains("Adicionar Número à Lista")) {
             z-index: 1050;
         }
         /* Z-index ainda maior para modal de visualização de bloqueados */
         .modal-overlay:has(.blocked-numbers-list) {
             z-index: 1100;
         }


         /* Estilos mínimos para elementos internos */
         .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; flex-shrink: 0; } /* Evita encolher */
         .modal-header h2, .modal-header h3 { margin: 0; font-size: 1.25rem; }
         .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
         .button-group { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 0.5rem; flex-shrink: 0; } /* Evita encolher */
         .form-group { margin-bottom: 1rem; }
         .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
         .form-input, select.form-input, textarea.form-input { width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
         textarea.form-input { min-height: 80px; resize: vertical; } /* Habilita resize vertical */
         .error-message { color: #d8000c; background-color: #ffdddd; border: 1px solid #d8000c; padding: 0.75rem; border-radius: 4px; margin: 1rem 0; flex-shrink: 0; } /* Evita encolher */
         .summary-panel { margin-bottom: 20px; padding: 10px 15px; background-color: #f0f0f0; border-radius: 4px; border: 1px solid #ddd; flex-shrink: 0; }
         .summary-panel p { margin: 0; font-weight: 500; }
         .lists-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; padding: 1rem 0; flex-grow: 1; overflow-y: auto; } /* Permite scroll */
         .list-card { border: 1px solid #eee; padding: 1rem; border-radius: 4px; background-color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; }
         .list-card.inactive { background-color: #f8f8f8; opacity: 0.7; }
         .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
         .card-title { display: flex; align-items: center; gap: 0.75rem; flex-grow: 1; }
         .list-card h3 { margin: 0; flex-grow: 1; font-size: 1.1rem; word-break: break-all; } /* Quebra nomes longos */
         .switch { position: relative; display: inline-block; width: 34px; height: 20px; flex-shrink: 0; margin-left: auto; }
         .switch input { opacity: 0; width: 0; height: 0; }
         .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px; }
         .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
         input:checked + .slider { background-color: #4CAF50; }
         input:checked + .slider:before { transform: translateX(14px); }
         .status { font-size: 0.8em; padding: 3px 6px; border-radius: 10px; font-weight: 500; }
         .status.active { background-color: #e8f5e9; color: #388e3c; }
         .status.inactive { background-color: #f5f5f5; color: #757575; }
         .tags-line { font-size: 0.8em; color: gray; margin-top: 0.25rem; word-break: break-word; }
         .lead-count { color: #007bff; font-weight: 500; font-size: 0.9em; } /* Estilo para contagem de leads */
         .menu-container { position: relative; }
         .menu-trigger { background: none; border: none; padding: 0; cursor: pointer; color: #757575; }
         .menu-trigger:hover { color: #333; }
         .dropdown-menu { position: absolute; right: 0; top: 100%; background: white; border: 1px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.15); z-index: 10; min-width: 130px; border-radius: 4px; overflow: hidden; }
         .dropdown-menu button { display: block; width: 100%; text-align: left; padding: 0.6rem 1rem; border: none; background: none; cursor: pointer; font-size: 0.9rem; }
         .dropdown-menu button:hover { background-color: #f5f5f5; }
         .delete-option { color: #d32f2f; }
         .mapping-selectors { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
         .preview-table { margin-top: 1rem; max-height: 250px; overflow: auto; border: 1px solid #ccc; border-radius: 4px; }
         .preview-table table { width: 100%; border-collapse: collapse; }
         .preview-table th, .preview-table td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; font-size: 0.9em; }
         .preview-table th { background-color: #f2f2f2; position: sticky; top: 0; z-index: 1; }
         .info-section { margin-bottom: 1rem; padding: 1rem; background: #f9f9f9; border-radius: 4px; border: 1px solid #eee; }
         .info-item { margin-bottom: 0.75rem; }
         .info-item label { display: block; font-weight: bold; color: #555; font-size: 0.9em; margin-bottom: 0.2rem; }
         .info-item p { margin: 0; word-break: break-word; }
         .info-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
         .view-status { padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.8em; font-weight: 500; }
         .view-status.active { background-color: #e8f5e9; color: #388e3c; }
         .view-status.inactive { background-color: #f5f5f5; color: #757575; }
         .message-help { font-size: 0.8em; color: gray; margin-bottom: 0.25rem; }
         .message-preview { margin-top: 0.5rem; padding: 0.75rem; background: #eee; border-radius: 4px; border: 1px solid #ddd; }
         .message-preview label { font-size: 0.8em; color: gray; font-weight: normal; }
         .message-preview p { margin: 0; font-style: italic; color: #333; }
         .contacts-table { overflow-x: auto; margin-top: 1rem; border: 1px solid #eee; border-radius: 4px; max-height: 40vh; /* Limita altura da tabela */ overflow-y: auto; }
         .contacts-table table { width: 100%; border-collapse: collapse; }
         .contacts-table th, .contacts-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; vertical-align: middle; }
         .contacts-table th { background: #f9f9f9; font-weight: bold; position: sticky; top: 0; z-index: 1; } /* Cabeçalho fixo */
         .contacts-table tr:last-child td { border-bottom: none; }
         .contacts-table td:nth-last-child(1) { text-align: center; } /* Centraliza última coluna (Lead Gerado?) */
         .contacts-table td:nth-last-child(2) { text-align: center; } /* Centraliza penúltima coluna (Status Disparo) */
         /* Estilos para os status de disparo e lead */
         .statusDisparado { color: #28a745; font-weight: bold; white-space: nowrap; } /* Verde */
         .statusFalha { color: #dc3545; font-weight: bold; white-space: nowrap; } /* Vermelho */
         .statusPendente { color: #6c757d; white-space: nowrap; } /* Cinza */
         .statusLeadGerado { color: #007bff; font-weight: bold; white-space: nowrap; } /* Azul para lead */
         .form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
         .switch-label { margin-left: 0.5rem; font-size: 0.9em; color: #555; }
         .progress-section { font-size: 0.85em; margin-top: 10px; }
         .progress-section p { margin-bottom: 4px; color: #555; }
         .progress-bar-container { background-color: #e0e0e0; border-radius: 4px; height: 8px; overflow: hidden; }
         .progress-bar-fill { height: 100%; background-color: #4CAF50; transition: width 0.3s ease-in-out; }

         /* Botões básicos */
         .upload-button, .add-button, .close-button, .save-button, .cancel-button, .delete-button, .view-button {
             padding: 8px 16px; border: 1px solid transparent; cursor: pointer; border-radius: 4px;
             font-size: 14px; font-weight: 500; transition: background-color 0.2s ease, border-color 0.2s ease;
         }
         .upload-button { background-color: #66bb6a; color: white; display: inline-block; text-align: center; border-color: #66bb6a; } /* Verde claro */
         .upload-button:hover { background-color: #4caf50; border-color: #4caf50; }
         .add-button { background-color: #42a5f5; color: white; border-color: #42a5f5; } /* Azul claro */
         .add-button:hover { background-color: #1e88e5; border-color: #1e88e5; }
         .close-button { background-color: #ffa726; color: white; border-color: #ffa726; } /* Laranja */
         .close-button:hover { background-color: #fb8c00; border-color: #fb8c00; }
         .cancel-button { background-color: #bdbdbd; color: #333; border-color: #bdbdbd; } /* Cinza */
         .cancel-button:hover { background-color: #9e9e9e; border-color: #9e9e9e; }
         .save-button { background-color: #26a69a; color: white; border-color: #26a69a; } /* Teal */
         .save-button:hover { background-color: #00897b; border-color: #00897b; }
         .save-button:disabled { background-color: #b2dfdb; border-color: #b2dfdb; color: #757575; cursor: not-allowed; }
         .delete-button { background-color: #ef5350; color: white; border-color: #ef5350; } /* Vermelho claro */
         .delete-button:hover { background-color: #e53935; border-color: #e53935; }
         .delete-button:disabled { background-color: #ffcdd2; border-color: #ffcdd2; color: #757575; cursor: not-allowed; }
         .delete-option { color: #d32f2f; } /* Cor vermelha para opção de deletar no dropdown */
         .view-button { background-color: #78909c; color: white; border-color: #78909c; } /* Blue Grey */
         .view-button:hover { background-color: #546e7a; border-color: #546e7a; }
         .view-button:disabled { background-color: #cfd8dc; border-color: #cfd8dc; color: #757575; cursor: not-allowed; }


         /* Estilos para Seção e Modais de Números Bloqueados */
         .blocked-numbers-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; flex-shrink: 0; } /* Evita encolher */
         .blocked-numbers-section h2 { margin-bottom: 1rem; font-size: 1.15rem; color: #444; }
         .blocked-card { background-color: #fff3e0; border-color: #ffe0b2; } /* Laranja bem claro */
         .button-group-inline { display: flex; gap: 10px; margin-top: 10px; }
         .button-group-inline button { padding: 6px 12px; font-size: 13px; }
         .blocked-numbers-list { max-height: 400px; overflow-y: auto; margin-top: 1rem; border: 1px solid #eee; border-radius: 4px; }
         .blocked-numbers-list table { width: 100%; border-collapse: collapse; }
         .blocked-numbers-list th, .blocked-numbers-list td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
         .blocked-numbers-list th { background: #f5f5f5; font-weight: bold; position: sticky; top: 0; z-index: 1; }
         .blocked-numbers-list td:last-child { text-align: right; }
         .blocked-numbers-list .delete-button { padding: 4px 8px; font-size: 12px; }
         .blocked-numbers-list tr:last-child td { border-bottom: none; }

       `}</style>
    </>
  );
}

/* Definição duplicada da função DuplicateCheckModal removida. O componente agora é importado. */