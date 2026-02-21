import { useState, useEffect } from 'react';
import { BuilderApiService, type TraceRecord } from '../../services/builder-api';

interface TracesProps {
  agentId: string;
  api: BuilderApiService;
}

type Period = 7 | 30 | 90;

const RESPONSE_TYPE_COLORS: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-700',
  analysis: 'bg-purple-100 text-purple-700',
  plan: 'bg-indigo-100 text-indigo-700',
  error: 'bg-red-100 text-red-700',
  greeting: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

function formatTime(ms: number) {
  if (!ms || isNaN(ms)) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function Traces({ agentId, api }: TracesProps) {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Period>(30);
  const [selected, setSelected] = useState<TraceRecord | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelected(null);
    api.getAgentTraces(agentId, days, 200)
      .then(data => { setTraces(data); setLoading(false); })
      .catch((err: Error) => { setError(err.message); setLoading(false); });
  }, [agentId, days, api]);

  const filtered = traces.filter(t =>
    !search ||
    t.userQuestion.toLowerCase().includes(search.toLowerCase()) ||
    t.tenantId.toLowerCase().includes(search.toLowerCase()) ||
    t.userEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* ── Left panel: trace list ── */}
      <div className="w-[420px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
        {/* Controls */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            {([7, 30, 90] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  days === p
                    ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {p}d
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-1">
              {loading ? 'Carregando...' : `${filtered.length} interações`}
            </span>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por pergunta, tenant ou usuário..."
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 text-xs text-red-500">Erro: {error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-400">
              Nenhuma interação encontrada.
            </div>
          )}
          {filtered.map(trace => (
            <button
              key={trace.messageId}
              onClick={() => setSelected(trace)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                selected?.messageId === trace.messageId
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  trace.hasError ? 'bg-red-400' :
                  trace.rating === -1 ? 'bg-orange-400' :
                  trace.rating === 1 ? 'bg-green-400' :
                  'bg-gray-300'
                }`} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  RESPONSE_TYPE_COLORS[trace.responseType] ?? RESPONSE_TYPE_COLORS.other
                }`}>
                  {trace.responseType}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                  {formatTime(trace.responseTimeMs)}
                </span>
              </div>
              <p className="text-xs text-gray-700 font-medium line-clamp-2 mb-1">
                {trace.userQuestion || '(sem pergunta)'}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>{formatDate(trace.timestamp)}</span>
                {trace.tenantId && <span className="truncate max-w-[80px]">{trace.tenantId}</span>}
                {trace.toolsUsed.length > 0 && (
                  <span className="text-blue-400">{trace.toolsUsed.length} tools</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: trace detail ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-sm">Selecione uma interação para ver o trace completo</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    RESPONSE_TYPE_COLORS[selected.responseType] ?? RESPONSE_TYPE_COLORS.other
                  }`}>
                    {selected.responseType}
                  </span>
                  {selected.hasError && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      erro
                    </span>
                  )}
                  {selected.rating === 1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      👍 positivo
                    </span>
                  )}
                  {selected.rating === -1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                      👎 negativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {formatDate(selected.timestamp)} · {selected.userEmail} · {selected.tenantId || 'sem tenant'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold" style={{ color: '#272154' }}>
                  {formatTime(selected.responseTimeMs)}
                </p>
                <p className="text-[10px] text-gray-400">tempo resposta</p>
              </div>
            </div>

            {/* User question */}
            <Section title="Pergunta do usuário">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.userQuestion}</p>
            </Section>

            {/* Response summary */}
            <Section title="Resumo da resposta">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.responseSummary || '(sem resumo)'}</p>
            </Section>

            {/* Tools used */}
            {selected.toolsUsed.length > 0 && (
              <Section title={`Tools usadas (${selected.toolsUsed.length})`}>
                <div className="flex flex-wrap gap-2">
                  {selected.toolsUsed.map((tool, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* SQL queries */}
            {selected.sqlQueries.length > 0 && (
              <Section title={`Queries SQL (${selected.sqlQueries.length})`}>
                <div className="space-y-2">
                  {selected.sqlQueries.map((sql, i) => (
                    <pre key={i} className="text-xs bg-gray-900 text-green-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                      {sql}
                    </pre>
                  ))}
                </div>
              </Section>
            )}

            {/* Feedback */}
            {selected.rating !== 0 && (
              <Section title="Feedback do usuário">
                <div className={`rounded-lg p-3 ${selected.rating === 1 ? 'bg-green-50 border border-green-100' : 'bg-orange-50 border border-orange-100'}`}>
                  <p className="text-sm font-medium">
                    {selected.rating === 1 ? '👍 Resposta boa' : '👎 Resposta ruim'}
                  </p>
                  {selected.feedbackText && (
                    <p className="text-xs text-gray-600 mt-1">{selected.feedbackText}</p>
                  )}
                </div>
              </Section>
            )}

            {/* IDs */}
            <Section title="Identificadores">
              <div className="space-y-1 font-mono text-[11px] text-gray-500">
                <div><span className="text-gray-400">message_id: </span>{selected.messageId}</div>
                <div><span className="text-gray-400">conversation_id: </span>{selected.conversationId}</div>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}
