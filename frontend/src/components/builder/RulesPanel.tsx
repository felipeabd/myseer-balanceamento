import { useState, useEffect, useCallback } from 'react';
import { BuilderApiService, type RuleRecord } from '../../services/builder-api';

interface RulesPanelProps {
  api: BuilderApiService;
}

const TIPO_COLORS: Record<string, string> = {
  bloqueio: 'bg-red-100 text-red-700',
  limite: 'bg-yellow-100 text-yellow-700',
  prioridade: 'bg-blue-100 text-blue-700',
  excecao: 'bg-purple-100 text-purple-700',
};

const TIPO_LABELS: Record<string, string> = {
  bloqueio: 'BLOQUEIO',
  limite: 'LIMITE',
  prioridade: 'PRIORIDADE',
  excecao: 'EXCEÇÃO',
};

const PRIORIDADE_HINTS: Record<string, string> = {
  bloqueio: '1–9 (crítico)',
  limite: '10–19 (operacional)',
  prioridade: '20–29 (negócio)',
  excecao: '30–39 (heurística)',
};

const DEFAULT_PRIORIDADE: Record<string, number> = {
  bloqueio: 5,
  limite: 15,
  prioridade: 25,
  excecao: 35,
};

interface NewRuleForm {
  tenant: string;
  tipo: string;
  prioridade: number;
  texto: string;
  alvo: string;
  condicao: string;
  acao: string;
}

const EMPTY_FORM: NewRuleForm = {
  tenant: '',
  tipo: 'bloqueio',
  prioridade: 5,
  texto: '',
  alvo: '',
  condicao: '',
  acao: '',
};

export function RulesPanel({ api }: RulesPanelProps) {
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [tenants, setTenants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTenant, setFilterTenant] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewRuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRules({
        tenant: filterTenant || undefined,
        tipo: filterTipo || undefined,
        status: filterStatus || undefined,
      });
      setRules(data.rules);
      setTenants(data.tenants);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  }, [api, filterTenant, filterTipo, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule: RuleRecord) => {
    const newStatus = rule.status === 'ativo' ? 'inativo' : 'ativo';
    setToggling(rule.id);
    try {
      await api.toggleRuleStatus(rule.id, newStatus);
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: newStatus } : r));
    } catch (err) {
      alert('Erro ao alterar status: ' + (err as Error).message);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (rule: RuleRecord) => {
    if (!confirm(`Deletar regra permanentemente?\n\n"${rule.texto}"\n\nEsta ação não pode ser desfeita.`)) return;
    setDeleting(rule.id);
    try {
      await api.deleteRule(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
    } catch (err) {
      alert('Erro ao deletar regra: ' + (err as Error).message);
      setDeleting(null);
    }
  };

  const handleCreate = async () => {
    if (!form.tenant.trim()) { alert('Informe o tenant (ou "null" para regra global)'); return; }
    if (!form.texto.trim()) { alert('Informe a descrição da regra'); return; }
    setSaving(true);
    try {
      await api.createRule({
        tenant: form.tenant.trim(),
        tipo: form.tipo,
        prioridade: form.prioridade,
        texto: form.texto.trim(),
        alvo: form.alvo.trim() || undefined,
        condicao: form.condicao.trim() || undefined,
        acao: form.acao.trim() || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      alert('Erro ao criar regra: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = rules.filter(r => r.status === 'ativo').length;
  const inactiveCount = rules.filter(r => r.status === 'inativo').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#272154' }}>Gestão de Regras</h2>
          <p className="text-xs text-gray-400">
            {activeCount} ativas · {inactiveCount} inativas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Atualizar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm rounded-lg text-white font-medium"
            style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
          >
            + Nova Regra
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-3 flex-wrap">
        <select
          value={filterTenant}
          onChange={e => setFilterTenant(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos os tenants</option>
          {tenants.map(t => (
            <option key={t} value={t}>{t === 'null' ? '🌐 Global' : t}</option>
          ))}
        </select>

        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos os tipos</option>
          <option value="bloqueio">Bloqueio</option>
          <option value="limite">Limite</option>
          <option value="prioridade">Prioridade</option>
          <option value="excecao">Exceção</option>
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>

        {(filterTenant || filterTipo || filterStatus) && (
          <button
            onClick={() => { setFilterTenant(''); setFilterTipo(''); setFilterStatus(''); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Limpar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">{rules.length} regra{rules.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-12">Carregando regras...</p>
        ) : rules.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-1">Nenhuma regra encontrada</p>
            <p className="text-sm">Crie uma regra pelo botão acima ou via chat com o comando /regras</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`border rounded-lg bg-white overflow-hidden transition-all ${
                  rule.status === 'inativo' ? 'opacity-60' : ''
                }`}
              >
                {/* Rule header */}
                <div className="px-4 py-3 flex items-start gap-3">
                  {/* Priority badge */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {rule.prioridade}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TIPO_COLORS[rule.tipo] || 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_LABELS[rule.tipo] || rule.tipo.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {rule.tenant === 'null' ? '🌐 Global' : rule.tenant}
                      </span>
                      {rule.vezesAplicada > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {rule.vezesAplicada}x aplicada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 font-medium">{rule.texto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Criada por {rule.criadoPor || 'sistema'} · {formatDate(rule.criadoEm)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                      title="Ver detalhes"
                    >
                      {expandedId === rule.id ? '▲' : '▼'}
                    </button>

                    {/* Toggle status */}
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={toggling === rule.id}
                      className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                        rule.status === 'ativo'
                          ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {toggling === rule.id ? '...' : rule.status === 'ativo' ? 'Desativar' : 'Ativar'}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(rule)}
                      disabled={deleting === rule.id}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deleting === rule.id ? '...' : 'Deletar'}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === rule.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                    <DetailRow label="Alvo" value={rule.alvo} />
                    <DetailRow label="Condição" value={rule.condicao} />
                    <DetailRow label="Ação" value={rule.acao} />
                    <p className="text-[10px] text-gray-300 mt-1">ID: {rule.id}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create rule modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: '#272154' }}>Nova Regra</h3>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Tenant */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tenant <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.tenant}
                  onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))}
                  placeholder='ID do tenant (ex: myseer) ou "null" para regra global'
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-xs text-gray-400 mt-0.5">Use "null" para criar uma regra global (vale para todos os tenants)</p>
              </div>

              {/* Tipo + Prioridade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tipo <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value, prioridade: DEFAULT_PRIORIDADE[e.target.value] ?? f.prioridade }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="bloqueio">Bloqueio</option>
                    <option value="limite">Limite</option>
                    <option value="prioridade">Prioridade</option>
                    <option value="excecao">Exceção</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prioridade <span className="text-red-400">*</span>
                    <span className="ml-1 text-gray-400 font-normal">{PRIORIDADE_HINTS[form.tipo]}</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="39"
                    value={form.prioridade}
                    onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Texto */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Descrição <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.texto}
                  onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
                  rows={3}
                  placeholder="Ex: Não balancear produtos da linha Controlados para a filial 99 (depósito central)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Alvo / Condição / Ação */}
              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  Campos avançados (alvo, condição, ação) — opcionais
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Alvo</label>
                    <input
                      type="text"
                      value={form.alvo}
                      onChange={e => setForm(f => ({ ...f, alvo: e.target.value }))}
                      placeholder='Ex: {"linha": "Controlados"} ou texto livre'
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Condição</label>
                    <input
                      type="text"
                      value={form.condicao}
                      onChange={e => setForm(f => ({ ...f, condicao: e.target.value }))}
                      placeholder='Ex: {"cdFilial": 99}'
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ação</label>
                    <input
                      type="text"
                      value={form.acao}
                      onChange={e => setForm(f => ({ ...f, acao: e.target.value }))}
                      placeholder='Ex: {"bloquear": true}'
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>
              </details>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
              >
                {saving ? 'Criando...' : 'Criar Regra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'null' || value === '{}') return null;
  return (
    <div>
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <p className="text-xs text-gray-600 font-mono bg-white border border-gray-200 rounded px-2 py-1 mt-0.5 break-all">
        {value}
      </p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
