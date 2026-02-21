import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { BuilderApiService, type AgentAnalytics } from '../../services/builder-api';

interface AnalyticsProps {
  agentId: string;
  api: BuilderApiService;
}

type Period = 7 | 30 | 90;

export function Analytics({ agentId, api }: AnalyticsProps) {
  const [data, setData] = useState<AgentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Period>(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getAgentAnalytics(agentId, days)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId, days, api]);

  const formatMs = (ms: number) => {
    if (!ms || isNaN(ms)) return '—';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (usd: number) => {
    if (!usd || isNaN(usd)) return '$0.00';
    return `$${usd.toFixed(4)}`;
  };

  const totalCost = data?.daily.reduce((acc, d) => acc + (d.cost_usd || 0), 0) ?? 0;

  const chartData = data?.daily.map(d => ({
    date: d.date?.slice(5) ?? '', // MM-DD
    mensagens: d.request_count ?? 0,
    tokens: d.total_tokens ?? 0,
  })) ?? [];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {([7, 30, 90] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setDays(p)}
            className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
              days === p
                ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {p}d
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-1">ultimos {days} dias</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          Carregando analytics...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          Erro ao carregar analytics: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard
              label="Conversas"
              value={String(data.stats.total_conversations ?? 0)}
              sub="unicas"
            />
            <KpiCard
              label="Mensagens"
              value={String(data.stats.total_messages ?? 0)}
              sub="interacoes"
            />
            <KpiCard
              label="Tempo Medio"
              value={formatMs(data.stats.avg_response_time_ms)}
              sub="por resposta"
            />
            <KpiCard
              label="Custo Total"
              value={formatCost(totalCost)}
              sub={`${data.stats.error_count ?? 0} erros`}
              highlight={totalCost > 0}
            />
          </div>

          {/* Daily bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Mensagens por Dia</h3>
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum dado no periodo.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Bar dataKey="mensagens" fill="#272154" radius={[4, 4, 0, 0]} name="Mensagens" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom row: top questions + usage detail */}
          <div className="grid grid-cols-2 gap-3">
            {/* Top questions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 10 Perguntas</h3>
              {!data.stats.top_questions || data.stats.top_questions.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma pergunta registrada.</p>
              ) : (
                <ol className="space-y-1.5">
                  {data.stats.top_questions.slice(0, 10).map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-xs font-medium text-gray-400 mt-0.5 w-4 shrink-0">{i + 1}.</span>
                      <span className="text-gray-600 line-clamp-2">{q}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Usage detail */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Uso por Dia</h3>
              {data.daily.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum dado no periodo.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {[...data.daily].reverse().map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500">{d.date}</span>
                      <div className="flex items-center gap-3 text-gray-600">
                        <span>{d.request_count ?? 0} req</span>
                        <span>{(d.total_tokens ?? 0).toLocaleString()} tok</span>
                        <span className="font-medium">{formatCost(d.cost_usd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* By tenant + by user */}
          <div className="grid grid-cols-2 gap-3">
            {/* By tenant */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Interacoes por Cliente</h3>
              {!data.by_tenant || data.by_tenant.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum dado no periodo.</p>
              ) : (
                <div className="space-y-0 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-gray-400 uppercase pb-1 border-b border-gray-100">
                    <span className="col-span-2">Cliente</span>
                    <span className="text-right">Msgs</span>
                    <span className="text-right">Conversas</span>
                  </div>
                  {data.by_tenant.map((t, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0 items-center">
                      <span className="col-span-2 text-gray-700 truncate font-medium" title={t.tenant_id}>
                        {t.tenant_id || '—'}
                      </span>
                      <span className="text-right text-gray-600">{t.total_messages}</span>
                      <span className="text-right text-gray-600">{t.total_conversations}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By user */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Interacoes por Usuario</h3>
              {!data.by_user || data.by_user.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum dado no periodo.</p>
              ) : (
                <div className="space-y-0 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-gray-400 uppercase pb-1 border-b border-gray-100">
                    <span className="col-span-2">Usuario</span>
                    <span className="text-right">Msgs</span>
                    <span className="text-right">Conversas</span>
                  </div>
                  {data.by_user.map((u, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0 items-center">
                      <span className="col-span-2 text-gray-700 truncate font-medium" title={u.user_email}>
                        {u.user_email || '—'}
                      </span>
                      <span className="text-right text-gray-600">{u.total_messages}</span>
                      <span className="text-right text-gray-600">{u.total_conversations}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !error && !data && (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          Nenhum dado disponivel.
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-600' : 'text-gray-800'}`} style={!highlight ? { color: '#272154' } : {}}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
