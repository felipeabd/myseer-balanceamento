import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ApiService } from '../services/api';

interface CreditsData {
  contractedBrl: number;
  usedBrl: number;
  availableBrl: number;
  exchangeRate: number;
  daily: Array<{ date: string; totalTokens: number; costBrl: number }>;
  hourly: Array<{ hour: string; totalTokens: number; costBrl: number }>;
  byUser: Array<{ userEmail: string; totalTokens: number; costBrl: number }>;
}

interface CreditsPanelProps {
  apiService: ApiService;
  onClose: () => void;
}

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AvailableColor(available: number, contracted: number): string {
  if (contracted === 0) return '#6b7280';
  const pct = available / contracted;
  if (pct > 0.2) return '#16a34a';
  if (pct > 0.05) return '#d97706';
  return '#dc2626';
}

export function CreditsPanel({ apiService, onClose }: CreditsPanelProps) {
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService.getCredits()
      .then(setData)
      .catch(() => setError('Não foi possível carregar os dados de créditos.'))
      .finally(() => setLoading(false));
  }, [apiService]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2A81B8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <h2 className="text-lg font-semibold" style={{ color: '#272154' }}>Meus Créditos</h2>
            <span className="text-sm text-gray-400">· Gestor de Estoque</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {loading && (
            <div className="flex justify-center items-center py-16">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#28B8CE', animationDelay: '-0.3s' }} />
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#2A81B8', animationDelay: '-0.15s' }} />
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#494495' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-16 text-red-500">{error}</div>
          )}

          {data && !loading && (
            <>
              {/* Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Créditos Contratados</p>
                  <p className="text-2xl font-bold" style={{ color: '#272154' }}>{formatBrl(data.contractedBrl)}</p>
                  <p className="text-xs text-gray-400 mt-1">Taxa: US$1 = R${data.exchangeRate.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Créditos Utilizados</p>
                  <p className="text-2xl font-bold" style={{ color: '#494495' }}>{formatBrl(data.usedBrl)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {data.contractedBrl > 0
                      ? `${((data.usedBrl / data.contractedBrl) * 100).toFixed(1)}% do total`
                      : 'Sem contrato cadastrado'}
                  </p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: AvailableColor(data.availableBrl, data.contractedBrl) + '40' }}>
                  <p className="text-xs text-gray-500 mb-1">Créditos Disponíveis</p>
                  <p className="text-2xl font-bold" style={{ color: AvailableColor(data.availableBrl, data.contractedBrl) }}>
                    {formatBrl(data.availableBrl)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {data.contractedBrl > 0
                      ? `${((data.availableBrl / data.contractedBrl) * 100).toFixed(1)}% restante`
                      : 'Configure um contrato'}
                  </p>
                </div>
              </div>

              {/* Chart: por dia */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Uso por Dia (últimos 7 dias)</h3>
                {data.daily.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados de uso</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} width={60} />
                      <Tooltip formatter={(v: number) => formatBrl(v)} labelStyle={{ fontSize: 12 }} />
                      <Bar dataKey="costBrl" name="Custo (R$)" radius={[4, 4, 0, 0]}
                        fill="url(#gradBar)" />
                      <defs>
                        <linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2A81B8" />
                          <stop offset="100%" stopColor="#494495" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart: por hora */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Uso por Hora (últimas 24h)</h3>
                {data.hourly.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados de uso nas últimas 24h</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.hourly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} width={60} />
                      <Tooltip formatter={(v: number) => formatBrl(v)} labelStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="costBrl" name="Custo (R$)"
                        stroke="#28B8CE" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart: por usuário */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Uso por Usuário</h3>
                {data.byUser.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados de uso por usuário</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(120, data.byUser.length * 36)}>
                    <BarChart
                      data={data.byUser}
                      layout="vertical"
                      margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} />
                      <YAxis type="category" dataKey="userEmail" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip formatter={(v: number) => formatBrl(v)} labelStyle={{ fontSize: 12 }} />
                      <Bar dataKey="costBrl" name="Custo (R$)" radius={[0, 4, 4, 0]} fill="#494495" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
