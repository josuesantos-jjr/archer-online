import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Table, Alert, Space, DatePicker } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
const { RangePicker } = DatePicker;
import locale from 'antd/es/date-picker/locale/pt_BR';

const RelatoriosModal = ({ visible, onClose, clientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  const carregarRelatorios = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/relatorios?clientId=${clientId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar relatórios');
      }

      setRelatorios(data.relatorios || []);
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
      setError('Não foi possível carregar os relatórios');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (visible && clientId) {
      carregarRelatorios();
    }
  }, [visible, clientId, carregarRelatorios]);

  const handleGerarRelatorio = async () => {
    if (!periodo[0] || !periodo[1]) {
      setError('Selecione um período válido');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dataInicio = periodo[0].format('YYYY-MM-DD');
      const dataFim = periodo[1].format('YYYY-MM-DD');

      const response = await fetch('/api/relatorios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          dataInicio,
          dataFim,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar relatório');
      }

      await carregarRelatorios();
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      setError('Não foi possível gerar o relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (relatorioId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/relatorios/download?clientId=${clientId}&relatorioId=${relatorioId}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao baixar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_${relatorioId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao baixar relatório:', err);
      setError('Não foi possível baixar o relatório');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      render: (text) => dayjs(text).format('DD/MM/YYYY'),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: 'Ações',
      key: 'acoes',
      render: (_, record) => (
        <Button
          icon={<DownloadOutlined />}
          onClick={() => handleDownload(record.id)}
          disabled={loading}
        >
          Baixar
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="Relatórios"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      {error && <Alert type="error" message={error} showIcon />}
      {/* <Space direction="vertical" style={{ width: '100%' }} size="middle">

        <div style={{ marginBottom: 16 }}>
          <Space>
            <RangePicker
              locale={locale}
              value={periodo}
              onChange={(dates) => setPeriodo(dates)}
              disabled={loading}
            />
            <Button
              type="primary"
              onClick={handleGerarRelatorio}
              loading={loading}
            >
              Gerar Relatório
            </Button>
          </Space>
        </div>

        <Table
        columns={columns}
        dataSource={relatorios}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      </Space> */}
    </Modal>
  );
};

export default RelatoriosModal;
