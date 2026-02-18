import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, Cell,
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

function formatDayDisplay(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
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

  // Invoices view state
  const [showInvoices, setShowInvoices] = useState(false);
  const [invoices, setInvoices] = useState<Array<{ id: number; amountBrl: number; rechargedAt: string }>>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesMonth, setInvoicesMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadInvoices = async (month: string) => {
    setInvoicesLoading(true);
    try {
      const data = await apiService.getInvoices(month);
      setInvoices(data);
    } catch (e) {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Add credits state
  const RECHARGE_UNIT = 180;
  const [addingCredits, setAddingCredits] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddCredits = async () => {
    const amount = RECHARGE_UNIT * addQty;
    setAddLoading(true);
    setAddError(null);
    try {
      const updated = await apiService.addCredits(amount);
      setData(updated);
      setAddingCredits(false);
      setAddQty(1);
    } catch (err: any) {
      setAddError(err?.message ?? 'Erro ao adicionar créditos');
    } finally {
      setAddLoading(false);
    }
  };

  // Drill-down state
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [filteredHourly, setFilteredHourly] = useState<CreditsData['hourly'] | null>(null);
  const [filteredByUser, setFilteredByUser] = useState<CreditsData['byUser'] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    apiService.getCredits()
      .then(setData)
      .catch(() => setError('Não foi possível carregar os dados de créditos.'))
      .finally(() => setLoading(false));
  }, [apiService]);

  const handleDayClick = async (entry: any) => {
    const date: string = entry?.date ?? entry?.activeLabel ?? entry;
    if (!date) return;

    if (selectedDay === date) {
      // Deselect — clear all filters
      setSelectedDay(null);
      setSelectedUser(null);
      setFilteredHourly(null);
      setFilteredByUser(null);
      return;
    }

    setSelectedDay(date);
    setSelectedUser(null);
    setSelectedHour(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await apiService.getCreditsDetail(date, undefined, undefined);
      console.log('[CreditsPanel] day detail fetched:', date, detail);
      setFilteredHourly(detail.hourly);
      setFilteredByUser(detail.byUser);
    } catch (err: any) {
      console.error('[CreditsPanel] Failed to fetch day detail:', err);
      setDetailError(err?.message ?? 'Erro ao filtrar por dia');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUserClick = async (entry: any) => {
    const user: string = entry?.userEmail ?? entry;
    if (!user) return;

    if (selectedUser === user) {
      // Deselect user — restore to day filter (or global if no day)
      setSelectedUser(null);
      if (selectedDay) {
        setDetailLoading(true);
        try {
          const detail = await apiService.getCreditsDetail(selectedDay, undefined);
          setFilteredHourly(detail.hourly);
          // byUser stays as is (still filtered by day)
        } catch (err) {
          console.error('[CreditsPanel] Failed to restore day detail:', err);
        } finally {
          setDetailLoading(false);
        }
      } else {
        setFilteredHourly(null);
      }
      return;
    }

    setSelectedUser(user);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await apiService.getCreditsDetail(selectedDay ?? undefined, user);
      console.log('[CreditsPanel] user detail fetched:', user, detail);
      setFilteredHourly(detail.hourly);
      // byUser does NOT change when clicking a user
    } catch (err: any) {
      console.error('[CreditsPanel] Failed to fetch user detail:', err);
      setDetailError(err?.message ?? 'Erro ao filtrar por usuário');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleHourClick = async (hour: string) => {
    if (!hour) return;

    if (selectedHour === hour) {
      // Deselect — revert byUser to day filter (or global)
      setSelectedHour(null);
      setDetailLoading(true);
      try {
        const detail = await apiService.getCreditsDetail(selectedDay ?? undefined, undefined, undefined);
        setFilteredByUser(detail.byUser);
      } catch (err) {
        console.error('[CreditsPanel] Failed to restore byUser on hour deselect:', err);
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    setSelectedHour(hour);
    setSelectedUser(null); // user filter and hour filter are mutually exclusive for byUser
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await apiService.getCreditsDetail(selectedDay ?? undefined, undefined, hour);
      console.log('[CreditsPanel] hour detail fetched:', hour, detail);
      setFilteredByUser(detail.byUser);
      // hourly does NOT change when clicking an hour
    } catch (err: any) {
      console.error('[CreditsPanel] Failed to fetch hour detail:', err);
      setDetailError(err?.message ?? 'Erro ao filtrar por hora');
    } finally {
      setDetailLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSelectedDay(null);
    setSelectedHour(null);
    setSelectedUser(null);
    setFilteredHourly(null);
    setFilteredByUser(null);
    setDetailError(null);
  };

  const hourlyData = filteredHourly ?? data?.hourly ?? [];
  const byUserData = filteredByUser ?? data?.byUser ?? [];

  const hourlyTitle = (() => {
    const parts: string[] = ['Uso por Hora'];
    if (selectedDay) parts.push(formatDayDisplay(selectedDay));
    if (selectedUser) parts.push(selectedUser.split('@')[0]);
    if (!selectedDay && !selectedUser) parts[0] = 'Uso por Hora (geral)';
    return parts.join(' · ');
  })();

  const byUserTitle = (() => {
    const parts: string[] = ['Uso por Usuário'];
    if (selectedDay) parts.push(formatDayDisplay(selectedDay));
    if (selectedHour) parts.push(selectedHour);
    return parts.join(' · ');
  })();

  const hasFilter = selectedDay !== null || selectedHour !== null || selectedUser !== null;

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

            {/* Active filter pills */}
            {hasFilter && (
              <div className="flex items-center gap-1.5 ml-1">
                {selectedDay && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer"
                    style={{ background: '#e8f7fa', color: '#2A81B8' }}
                    onClick={() => {
                      if (selectedUser) {
                        // keep user, clear day
                        setSelectedDay(null);
                        setSelectedUser(null);
                        setFilteredHourly(null);
                        setFilteredByUser(null);
                      } else {
                        clearAllFilters();
                      }
                    }}
                  >
                    {formatDayDisplay(selectedDay)}
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
                {selectedHour && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer"
                    style={{ background: '#fef3c7', color: '#d97706' }}
                    onClick={() => handleHourClick(selectedHour)}
                  >
                    {selectedHour}
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
                {selectedUser && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer"
                    style={{ background: '#eceaf8', color: '#494495' }}
                    onClick={() => handleUserClick(selectedUser)}
                  >
                    {selectedUser.split('@')[0]}
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
                {hasFilter && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-gray-400 hover:text-gray-600 underline ml-0.5"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowInvoices(v => {
                  const next = !v;
                  if (next) loadInvoices(invoicesMonth);
                  return next;
                });
              }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
              style={showInvoices
                ? { borderColor: '#494495', background: '#eceaf8', color: '#494495' }
                : { borderColor: '#d1d5db', color: '#6b7280' }
              }
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Faturas
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* ── Invoices View ── */}
          {showInvoices && (
            <div>
              {/* Month selector */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-700">Histórico de Recargas</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const [y, m] = invoicesMonth.split('-').map(Number);
                      const d = new Date(y, m - 2, 1);
                      const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      setInvoicesMonth(prev);
                      loadInvoices(prev);
                    }}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    ‹
                  </button>
                  <span className="text-sm font-medium" style={{ color: '#272154', minWidth: 90, textAlign: 'center' }}>
                    {(() => {
                      const [y, m] = invoicesMonth.split('-').map(Number);
                      return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    })()}
                  </span>
                  <button
                    onClick={() => {
                      const [y, m] = invoicesMonth.split('-').map(Number);
                      const d = new Date(y, m, 1);
                      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      setInvoicesMonth(next);
                      loadInvoices(next);
                    }}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    ›
                  </button>
                </div>
              </div>

              {invoicesLoading ? (
                <div className="flex justify-center py-12">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#28B8CE', animationDelay: '-0.3s' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#2A81B8', animationDelay: '-0.15s' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#494495' }} />
                  </div>
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm text-gray-400">Nenhuma recarga neste mês</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {invoices.map((inv, idx) => {
                      const dt = new Date(inv.rechargedAt);
                      const dateStr = dt.toLocaleDateString('pt-BR');
                      const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const num = String(invoices.length - idx).padStart(3, '0');
                      return (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-gray-400">#{num}</span>
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#272154' }}>
                                {formatBrl(inv.amountBrl)}
                              </p>
                              <p className="text-[11px] text-gray-400">{dateStr} às {timeStr}</p>
                            </div>
                          </div>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: '#dcfce7', color: '#16a34a' }}
                          >
                            Confirmado
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Total do mês */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border-t-2 border-gray-200 bg-white">
                    <span className="text-sm font-semibold text-gray-600">Total do mês</span>
                    <span className="text-sm font-bold" style={{ color: '#272154' }}>
                      {formatBrl(invoices.reduce((sum, i) => sum + i.amountBrl, 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Main Credits View ── */}
          {!showInvoices && (
            <>
          {detailError && (
            <div className="mb-4 px-4 py-2 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              Erro ao filtrar: {detailError}
            </div>
          )}

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
                <div className="rounded-xl border border-gray-200 p-4 flex flex-col">
                  <p className="text-xs text-gray-500 mb-1">Créditos Contratados</p>
                  <p className="text-2xl font-bold" style={{ color: '#272154' }}>{formatBrl(data.contractedBrl)}</p>
                  <p className="text-xs text-gray-400 mt-1">Taxa: US$1 = R${data.exchangeRate.toFixed(2)}</p>

                  {/* Adicionar créditos */}
                  {!addingCredits ? (
                    <button
                      onClick={() => { setAddingCredits(true); setAddError(null); setAddQty(1); }}
                      className="mt-3 text-xs font-medium px-2 py-1 rounded-lg border transition-colors self-start"
                      style={{ borderColor: '#2A81B8', color: '#2A81B8' }}
                    >
                      + Adicionar
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {/* Contador de parcelas */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAddQty(q => Math.max(1, q - 1))}
                          disabled={addLoading || addQty <= 1}
                          className="w-6 h-6 rounded-full border flex items-center justify-center text-sm font-bold disabled:opacity-40 hover:bg-gray-50 transition-colors"
                          style={{ borderColor: '#2A81B8', color: '#2A81B8' }}
                        >
                          −
                        </button>
                        <div className="flex-1 text-center">
                          <p className="text-sm font-bold" style={{ color: '#272154' }}>
                            {formatBrl(RECHARGE_UNIT * addQty)}
                          </p>
                          <p className="text-[10px] text-gray-400">{addQty}× R${RECHARGE_UNIT}</p>
                        </div>
                        <button
                          onClick={() => setAddQty(q => q + 1)}
                          disabled={addLoading}
                          className="w-6 h-6 rounded-full border flex items-center justify-center text-sm font-bold disabled:opacity-40 hover:bg-gray-50 transition-colors"
                          style={{ borderColor: '#2A81B8', color: '#2A81B8' }}
                        >
                          +
                        </button>
                      </div>
                      {addError && <p className="text-[10px] text-red-500">{addError}</p>}
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddCredits}
                          disabled={addLoading}
                          className="flex-1 text-xs font-medium py-1 rounded-lg text-white disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
                        >
                          {addLoading ? '...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => { setAddingCredits(false); setAddQty(1); }}
                          disabled={addLoading}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600">Uso por Dia (últimos 7 dias)</h3>
                  {!selectedDay && (
                    <p className="text-xs text-gray-400">Clique em um dia para detalhar</p>
                  )}
                </div>
                {data.daily.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados de uso</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={data.daily}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} width={60} />
                      <Tooltip
                        formatter={(v: any) => formatBrl(Number(v))}
                        labelStyle={{ fontSize: 12 }}
                        cursor={{ fill: 'rgba(42, 129, 184, 0.08)' }}
                      />
                      <defs>
                        <linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2A81B8" />
                          <stop offset="100%" stopColor="#494495" />
                        </linearGradient>
                        <linearGradient id="gradBarSelected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#28B8CE" />
                          <stop offset="100%" stopColor="#2A81B8" />
                        </linearGradient>
                      </defs>
                      <Bar
                        dataKey="costBrl"
                        name="Custo (R$)"
                        radius={[4, 4, 0, 0]}
                        onClick={(entry) => handleDayClick(entry)}
                        style={{ cursor: 'pointer' }}
                      >
                        {data.daily.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={selectedDay === entry.date ? 'url(#gradBarSelected)' : 'url(#gradBar)'}
                            opacity={selectedDay && selectedDay !== entry.date ? 0.45 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart: por hora */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600">{hourlyTitle}</h3>
                  {detailLoading && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Carregando...
                    </span>
                  )}
                </div>
                {hourlyData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {detailLoading ? 'Carregando...' : 'Sem dados de uso por hora'}
                  </p>
                ) : (
                  <ResponsiveContainer key={`hourly-${selectedDay ?? 'all'}-${selectedUser ?? 'all'}`} width="100%" height={160}>
                    <LineChart
                      data={hourlyData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      onClick={(chartData) => {
                        const label = chartData?.activeLabel as string | undefined;
                        if (label) handleHourClick(label);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} width={60} />
                      <Tooltip
                        formatter={(v: any) => formatBrl(Number(v))}
                        labelStyle={{ fontSize: 12 }}
                        cursor={{ stroke: '#d97706', strokeWidth: 1, strokeDasharray: '4 2' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="costBrl"
                        name="Custo (R$)"
                        stroke={selectedUser ? '#494495' : '#28B8CE'}
                        strokeWidth={2}
                        dot={(props: any) => {
                          const isSelected = props.payload?.hour === selectedHour;
                          return (
                            <circle
                              key={props.index}
                              cx={props.cx}
                              cy={props.cy}
                              r={isSelected ? 6 : 3}
                              fill={isSelected ? '#d97706' : (selectedUser ? '#494495' : '#28B8CE')}
                              stroke={isSelected ? '#fff' : 'none'}
                              strokeWidth={isSelected ? 2 : 0}
                            />
                          );
                        }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart: por usuário */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600">{byUserTitle}</h3>
                  {!selectedUser && !selectedHour && (
                    <p className="text-xs text-gray-400">Clique em uma hora ou usuário para detalhar</p>
                  )}
                </div>
                {byUserData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {detailLoading ? 'Carregando...' : 'Sem dados para o período selecionado'}
                  </p>
                ) : (
                  <ResponsiveContainer key={`byuser-${selectedDay ?? 'all'}-${selectedHour ?? 'all'}-${selectedUser ?? 'all'}`} width="100%" height={Math.max(120, byUserData.length * 36)}>
                    <BarChart
                      data={byUserData}
                      layout="vertical"
                      margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(2)}`} />
                      <YAxis type="category" dataKey="userEmail" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip
                        formatter={(v: any) => formatBrl(Number(v))}
                        labelStyle={{ fontSize: 12 }}
                        cursor={{ fill: 'rgba(73, 68, 149, 0.08)' }}
                      />
                      <Bar
                        dataKey="costBrl"
                        name="Custo (R$)"
                        radius={[0, 4, 4, 0]}
                        onClick={(entry) => handleUserClick(entry)}
                        style={{ cursor: 'pointer' }}
                      >
                        {byUserData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={selectedUser === entry.userEmail ? '#28B8CE' : '#494495'}
                            opacity={selectedUser && selectedUser !== entry.userEmail ? 0.45 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
