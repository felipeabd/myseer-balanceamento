import { useState } from 'react';
import { BuilderApiService, type AgentDefinitionFull } from '../../services/builder-api';
import { TestChat } from './TestChat';

interface AgentEditorProps {
  agent: AgentDefinitionFull;
  api: BuilderApiService;
  onSave: (id: string, data: Partial<AgentDefinitionFull>) => Promise<AgentDefinitionFull>;
  onPublish: (id: string) => Promise<void>;
  onUnpublish: (id: string) => Promise<void>;
}

type Tab = 'basico' | 'prompt' | 'tabelas' | 'skills' | 'regras' | 'conhecimento' | 'perguntas' | 'config' | 'teste';

export function AgentEditor({ agent, api, onSave, onPublish, onUnpublish }: AgentEditorProps) {
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
  const [tabelasJson, setTabelasJson] = useState(JSON.stringify(agent.tabelas, null, 2));
  const [perguntasJson, setPerguntasJson] = useState(JSON.stringify(agent.perguntasRapidas, null, 2));

  const [modeloPadrao, setModeloPadrao] = useState(agent.modeloPadrao);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxToolCalls, setMaxToolCalls] = useState(agent.maxToolCalls);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      let tabelas = agent.tabelas;
      try { tabelas = JSON.parse(tabelasJson); } catch { /* keep current */ }

      let perguntasRapidas = agent.perguntasRapidas;
      try { perguntasRapidas = JSON.parse(perguntasJson); } catch { /* keep current */ }

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
    { key: 'teste', label: 'Testar' },
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
            <>
              <p className="text-sm text-gray-500 mb-2">
                JSON com as tabelas e colunas que o agente pode acessar.
                Cada entrada: tabela, alias, colunas[], filtroObrigatorio.
              </p>
              <textarea
                value={tabelasJson}
                onChange={(e) => setTabelasJson(e.target.value)}
                rows={20}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </>
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
            <>
              <p className="text-sm text-gray-500 mb-2">
                JSON com as perguntas rapidas exibidas ao usuario. Cada entrada: icon, title, prompt.
              </p>
              <textarea
                value={perguntasJson}
                onChange={(e) => setPerguntasJson(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </>
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
            </div>
          )}

          {tab === 'teste' && (
            <TestChat agentId={agent.id} agentNome={agent.nome} api={api} />
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
