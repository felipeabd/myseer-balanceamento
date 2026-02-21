import { useState, useEffect } from 'react';
import { BuilderApiService, type AgentDefinitionFull, type AgentVersion } from '../../services/builder-api';
import { TestChat } from './TestChat';
import { TableSelector } from './TableSelector';
import { StarterPromptsEditor } from './StarterPromptsEditor';
import { Analytics } from './Analytics';

interface AgentEditorProps {
  agent: AgentDefinitionFull;
  api: BuilderApiService;
  onSave: (id: string, data: Partial<AgentDefinitionFull>) => Promise<AgentDefinitionFull>;
  onPublish: (id: string) => Promise<void>;
  onUnpublish: (id: string) => Promise<void>;
  onRollback: (id: string, versao: number) => Promise<AgentDefinitionFull>;
}

type Tab = 'basico' | 'prompt' | 'tabelas' | 'skills' | 'regras' | 'conhecimento' | 'perguntas' | 'config' | 'historico' | 'teste' | 'analytics';

export function AgentEditor({ agent, api, onSave, onPublish, onUnpublish, onRollback }: AgentEditorProps) {
  const [tab, setTab] = useState<Tab>('basico');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [nome, setNome] = useState(agent.nome);
  const [descricao, setDescricao] = useState(agent.descricao);
  const [icone, setIcone] = useState(agent.icone);
  const [cor, setCor] = useState(agent.cor);
  const [saudacao, setSaudacao] = useState(agent.saudacao);
  const [placeholderInput, setPlaceholderInput] = useState(agent.placeholderInput);

  const [personalidade, setPersonalidade] = useState(agent.prompt.personalidade);
  const [tom, setTom] = useState(agent.prompt.tom);
  const [restricoes, setRestricoes] = useState(agent.prompt.restricoes);
  const [exemplos, setExemplos] = useState(agent.prompt.exemplos);
  const [fluxo, setFluxo] = useState(agent.prompt.fluxo);

  const [skills, setSkills] = useState(agent.skills);
  const [regraAnalise, setRegraAnalise] = useState(agent.regraAnalise);
  const [conhecimento, setConhecimento] = useState(agent.conhecimento);
  const [tabelas, setTabelas] = useState(agent.tabelas);
  const [perguntasRapidas, setPerguntasRapidas] = useState(agent.perguntasRapidas);

  const [modeloPadrao, setModeloPadrao] = useState(agent.modeloPadrao);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxToolCalls, setMaxToolCalls] = useState(agent.maxToolCalls);
  const [contextoConversas, setContextoConversas] = useState(agent.contextoConversas ?? false);
  const [numConversasAnteriores, setNumConversasAnteriores] = useState(agent.numConversasAnteriores ?? 5);
  const [perfilUsuario, setPerfilUsuario] = useState(agent.perfilUsuario ?? false);
  const [tenantId, setTenantId] = useState(agent.tenantId ?? '');

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(agent.id, {
        nome,
        descricao,
        icone,
        cor,
        saudacao,
        placeholderInput,
        prompt: { personalidade, tom, restricoes, exemplos, fluxo },
        skills,
        regraAnalise,
        conhecimento,
        tabelas,
        perguntasRapidas,
        modeloPadrao,
        maxTokens,
        temperature,
        maxToolCalls,
        contextoConversas,
        numConversasAnteriores,
        perfilUsuario,
        tenantId,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert('Erro ao salvar: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basico', label: 'Basico' },
    { key: 'prompt', label: 'Prompt' },
    { key: 'tabelas', label: 'Tabelas' },
    { key: 'skills', label: 'Skills' },
    { key: 'regras', label: 'Regras' },
    { key: 'conhecimento', label: 'Conhecimento' },
    { key: 'perguntas', label: 'Perguntas' },
    { key: 'config', label: 'Config' },
    { key: 'historico', label: 'Historico' },
    { key: 'teste', label: 'Testar' },
    { key: 'analytics', label: 'Analytics' },
  ];

  const statusBadge = agent.status === 'publicado'
    ? 'bg-green-100 text-green-700'
    : agent.status === 'testando'
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-gray-100 text-gray-600';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icone || '🤖'}</span>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#272154' }}>{nome || 'Novo Agente'}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">slug: {agent.slug}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge}`}>
                {agent.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agent.status === 'publicado' ? (
            <button
              onClick={() => onUnpublish(agent.id)}
              className="px-3 py-1.5 text-sm rounded-lg border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              Despublicar
            </button>
          ) : (
            <button
              onClick={() => onPublish(agent.id)}
              className="px-3 py-1.5 text-sm rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
            >
              Publicar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#2A81B8' }}
          >
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6 flex gap-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {tab === 'basico' && (
            <>
              <Field label="Nome" value={nome} onChange={setNome} />
              <Field label="Descricao" value={descricao} onChange={setDescricao} multiline />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Icone (emoji)" value={icone} onChange={setIcone} />
                <Field label="Cor (hex)" value={cor} onChange={setCor} />
              </div>
              <Field label="Saudacao" value={saudacao} onChange={setSaudacao} multiline />
              <Field label="Placeholder do input" value={placeholderInput} onChange={setPlaceholderInput} />
            </>
          )}

          {tab === 'prompt' && (
            <>
              <Field label="Personalidade" value={personalidade} onChange={setPersonalidade} multiline rows={8} />
              <Field label="Tom de comunicacao" value={tom} onChange={setTom} multiline rows={4} />
              <Field label="Restricoes" value={restricoes} onChange={setRestricoes} multiline rows={8} />
              <Field label="Exemplos de resposta" value={exemplos} onChange={setExemplos} multiline rows={6} />
              <Field label="Fluxo de funcionamento" value={fluxo} onChange={setFluxo} multiline rows={10} />
            </>
          )}

          {tab === 'tabelas' && (
            <TableSelector tabelas={tabelas} onChange={setTabelas} api={api} />
          )}

          {tab === 'skills' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-2">Habilidades ativas do agente:</p>
              <Toggle label="Consulta SQL (clickhouse_query)" checked={skills.consulta_sql}
                onChange={(v) => setSkills(s => ({ ...s, consulta_sql: v }))} />
              <Toggle label="Gerar CSV (generate_csv)" checked={skills.gerar_csv}
                onChange={(v) => setSkills(s => ({ ...s, gerar_csv: v }))} />
              <Toggle label="Knowledge Base (consultar/adicionar)" checked={skills.knowledge_base}
                onChange={(v) => setSkills(s => ({ ...s, knowledge_base: v }))} />
              <Toggle label="Otimizador (optimize_batch)" checked={skills.otimizador}
                onChange={(v) => setSkills(s => ({ ...s, otimizador: v }))} />
            </div>
          )}

          {tab === 'regras' && (
            <>
              <p className="text-sm text-gray-500 mb-2">
                Regras de analise escritas pelo especialista de negocio. O agente usara estas regras para guiar suas analises.
              </p>
              <textarea
                value={regraAnalise}
                onChange={(e) => setRegraAnalise(e.target.value)}
                rows={20}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Ex: Ruptura ativa = qtestoque = 0 AND mediaf_un > 0..."
              />
            </>
          )}

          {tab === 'conhecimento' && (
            <>
              <p className="text-sm text-gray-500 mb-2">
                Conhecimento base do agente. Texto livre com informacoes, contexto e dados que o agente deve considerar em suas respostas.
              </p>
              <textarea
                value={conhecimento}
                onChange={(e) => setConhecimento(e.target.value)}
                rows={20}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Ex: O cliente X opera com 45 filiais no estado de SP. A sazonalidade de sorvetes aumenta 3x no verao..."
              />
            </>
          )}

          {tab === 'perguntas' && (
            <StarterPromptsEditor prompts={perguntasRapidas} onChange={setPerguntasRapidas} />
          )}

          {tab === 'config' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo padrao</label>
                <select
                  value={modeloPadrao}
                  onChange={(e) => setModeloPadrao(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="claude-sonnet-4-5-20250929">Sonnet 4.5 (Avancado)</option>
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5 (Economico)</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tool Calls</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxToolCalls}
                    onChange={(e) => setMaxToolCalls(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Cross-conversation context */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Contexto entre conversas</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Quando habilitado, o agente recebe resumos das conversas anteriores do usuario para manter continuidade no atendimento.
                </p>
                <Toggle
                  label="Habilitar contexto de conversas anteriores"
                  checked={contextoConversas}
                  onChange={setContextoConversas}
                />
                {contextoConversas && (
                  <div className="mt-3 ml-13">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numero de conversas anteriores
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={numConversasAnteriores}
                      onChange={(e) => setNumConversasAnteriores(Number(e.target.value))}
                      className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Cada resumo adiciona ~100-150 tokens ao prompt. Recomendado: 3-10.
                    </p>
                  </div>
                )}
              </div>

              {/* Persistent user profile */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Perfil persistente do usuario</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Quando habilitado, o agente aprende o perfil do usuario ao longo das conversas e personaliza as respostas de acordo com seu cargo, preferencias e areas de interesse.
                </p>
                <Toggle
                  label="Habilitar perfil persistente do usuario"
                  checked={perfilUsuario}
                  onChange={setPerfilUsuario}
                />
                {perfilUsuario && (
                  <p className="text-xs text-gray-400 mt-2 ml-13">
                    O perfil e atualizado automaticamente apos cada conversa. Adiciona ~100-200 tokens ao prompt.
                  </p>
                )}
              </div>

              {/* Tenant exclusivity */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Exclusividade por Tenant</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Deixe em branco para que o agente seja global (visivel para todos os tenants). Preencha com um Tenant ID para que o agente seja exclusivo daquele cliente.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tenant ID (vazio = global)</label>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value.trim())}
                    placeholder="Ex: cliente-abc ou cliente-a,cliente-b (vazio = todos)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {tenantId && (
                    <p className="text-xs text-amber-600 mt-1">
                      Este agente so aparecera para: <strong>{tenantId.split(',').map(t => t.trim()).filter(Boolean).join(', ')}</strong>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'historico' && (
            <VersionHistory
              agentId={agent.id}
              currentVersion={agent.versao}
              api={api}
              onRollback={async (versao) => { await onRollback(agent.id, versao); }}
            />
          )}

          {tab === 'teste' && (
            <TestChat agentId={agent.id} agentNome={agent.nome} api={api} />
          )}

          {tab === 'analytics' && (
            <Analytics agentId={agent.id} api={api} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable form components ──────────────────────────────

function Field({ label, value, onChange, multiline, rows }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const className = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows || 3}
          className={className}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function VersionHistory({ agentId, currentVersion, api, onRollback }: {
  agentId: string;
  currentVersion: number;
  api: BuilderApiService;
  onRollback: (versao: number) => Promise<void>;
}) {
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState<number | null>(null);

  useEffect(() => {
    api.getAgentVersions(agentId).then(v => {
      setVersions(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agentId, api]);

  const handleRollback = async (versao: number) => {
    if (!confirm(`Restaurar para a versao ${versao}? A versao atual sera mantida no historico.`)) return;
    setRolling(versao);
    try {
      await onRollback(versao);
    } catch (error) {
      alert('Erro ao restaurar: ' + (error as Error).message);
      setRolling(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'publicado': return 'bg-green-100 text-green-700';
      case 'testando': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Carregando historico...</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Historico de versoes do agente. Versao atual: <strong>v{currentVersion}</strong>
      </p>

      {versions.length === 0 && (
        <p className="text-sm text-gray-400">Nenhuma versao encontrada.</p>
      )}

      {versions.map(v => {
        const isCurrent = v.versao === currentVersion;
        const date = new Date(v.atualizadoEm);
        const formatted = date.toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        return (
          <div
            key={v.versao}
            className={`border rounded-lg p-3 flex items-center justify-between ${
              isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>
                v{v.versao}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(v.status)}`}>
                {v.status}
              </span>
              <span className="text-xs text-gray-400">{formatted}</span>
              {isCurrent && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                  atual
                </span>
              )}
            </div>
            {!isCurrent && (
              <button
                onClick={() => handleRollback(v.versao)}
                disabled={rolling !== null}
                className="px-3 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                {rolling === v.versao ? 'Restaurando...' : 'Restaurar'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
