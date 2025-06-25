'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function RelatorioDashboard({ clientId }) {
  const [relatorios, setRelatorios] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [filtro, setFiltro] = useState('semana');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    carregarDados();
  }, [clientId, filtro, dataInicio, dataFim]);

  const carregarDados = async () => {
    try {
      let url = `/api/relatorio?clientId=${encodeURIComponent(clientId)}`;

      if (dataInicio) url += `&dataInicio=${dataInicio}`;
      if (dataFim) url += `&dataFim=${dataFim}`;

      const response = await fetch(url);
      const data = await response.json();

      setRelatorios(data.relatorios);
      setEstatisticas(data.estatisticas);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    }
  };

  const handleFiltroChange = (novoFiltro) => {
    const hoje = new Date();
    let inicio = new Date();

    switch (novoFiltro) {
      case 'dia':
        inicio = hoje;
        break;
      case 'semana':
        inicio.setDate(hoje.getDate() - 7);
        break;
      case 'mes':
        inicio.setMonth(hoje.getMonth() - 1);
        break;
      case 'ano':
        inicio.setFullYear(hoje.getFullYear() - 1);
        break;
      default:
        inicio = null;
    }

    setFiltro(novoFiltro);
    if (inicio) {
      setDataInicio(inicio.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    }
  };

  const chartData = {
    labels: relatorios
      .map((r) => new Date(r.data).toLocaleDateString('pt-BR'))
      .filter((date, i, arr) => arr.indexOf(date) === i),
    datasets: [
      {
        label: 'Disparos por Dia',
        data: relatorios.reduce((acc, r) => {
          const data = new Date(r.data).toLocaleDateString('pt-BR');
          acc[data] = (acc[data] || 0) + 1;
          return acc;
        }, {}),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Evolução de Disparos',
      },
    },
  };

  return (
    <div className="bg-white" style={{ minHeight: '500px' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded bg-white border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">
            Total de Disparos
          </h3>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {estatisticas?.totalDisparos || 0}
          </p>
        </div>
        <div className="p-4 rounded bg-white border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">
            Disparos com Sucesso
          </h3>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {estatisticas?.disparosSucesso || 0}
          </p>
        </div>
        <div className="p-4 rounded bg-white border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">
            Disparos com Falha
          </h3>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {estatisticas?.disparosFalha || 0}
          </p>
        </div>
        <div className="p-4 rounded bg-white border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">
            Etapa do Aquecimento
          </h3>
          <p className="text-2xl font-bold text-purple-600 mt-2">
            {estatisticas?.etapaAquecimentoAtual || 0}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mt-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-md shadow-sm" role="group">
            <button
              onClick={() => handleFiltroChange('dia')}
              className={`px-4 py-2 text-sm font-medium border ${
                filtro === 'dia'
                  ? 'bg-blue-50 border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              } first:rounded-l-lg last:rounded-r-lg`}
            >
              Dia
            </button>
            <button
              onClick={() => handleFiltroChange('semana')}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                filtro === 'semana'
                  ? 'bg-blue-50 border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => handleFiltroChange('mes')}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                filtro === 'mes'
                  ? 'bg-blue-50 border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => handleFiltroChange('ano')}
              className={`px-4 py-2 text-sm font-medium border ${
                filtro === 'ano'
                  ? 'bg-blue-50 border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              } first:rounded-l-lg last:rounded-r-lg`}
            >
              Ano
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div
          className="bg-white p-4 rounded-lg border border-gray-200"
          style={{ height: '400px' }}
        >
          <Line data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
}
