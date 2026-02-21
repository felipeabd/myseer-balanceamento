import { useState, useEffect } from 'react';
import { BuilderApiService, type AgentDefinitionFull } from '../../services/builder-api';
import { AgentEditor } from './AgentEditor';

interface BuilderLayoutProps {
  userEmail: string;
  onExit: () => void;
}

export function BuilderLayout({ userEmail, onExit }: BuilderLayoutProps) {
  const [api] = useState(() => new BuilderApiService(userEmail));
  const [agents, setAgents] = useState<AgentDefinitionFull[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAgents = async () => {
    try {
      const data = await api.listAgents();
      setAgents(data);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleNewAgent = async () => {
    const slug = prompt('Slug do agente (ex: vendas, prevencao):');
    if (!slug) return;
    const nome = prompt('Nome do agente (ex: Gestor de Vendas):');
    if (!nome) return;

    try {
      const created = await api.createAgent({ slug, nome });
      setAgents(prev => [...prev, created]);
      setSelectedAgentId(created.id);
    } catch (error: any) {
      alert(error.message || 'Erro ao criar agente');
    }
  };

  const handleSave = async (id: string, data: Partial<AgentDefinitionFull>) => {
    const updated = await api.updateAgent(id, data);
    setAgents(prev => prev.map(a => a.id === id ? updated : a));
    return updated;
  };

  const handlePublish = async (id: string) => {
    const published = await api.publishAgent(id);
    setAgents(prev => prev.map(a => a.id === id ? published : a));
  };

  const handleUnpublish = async (id: string) => {
    const unpublished = await api.unpublishAgent(id);
    setAgents(prev => prev.map(a => a.id === id ? unpublished : a));
  };

  const handleRollback = async (id: string, versao: number) => {
    const restored = await api.rollbackAgent(id, versao);
    setAgents(prev => prev.map(a => a.id === id ? restored : a));
    return restored;
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;

  const statusColor = (status: string) => {
    switch (status) {
      case 'publicado': return 'bg-green-100 text-green-700';
      case 'testando': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Agent list */}
      <div className="w-72 border-r border-gray-200 flex flex-col" style={{ backgroundColor: '#f8f9fc' }}>
        {/* Header */}
        <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <img src="/myseer-logo.png" alt="Myseer" className="h-7 w-auto" />
            <p className="text-[10px] font-semibold mt-1 tracking-wider" style={{ color: '#494495' }}>BUILDER</p>
          </div>
          <button
            onClick={onExit}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Voltar
          </button>
        </div>

        {/* New agent button */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={handleNewAgent}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
            style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #2A81B8 50%, #494495 100%)' }}
          >
            + Novo Agente
          </button>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <p className="p-4 text-center text-xs text-gray-400">Carregando...</p>
          ) : agents.length === 0 ? (
            <p className="p-4 text-center text-xs text-gray-400">Nenhum agente criado</p>
          ) : (
            <div className="space-y-1">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedAgentId === agent.id
                      ? 'border'
                      : 'bg-white border border-gray-200 hover:bg-gray-100'
                  }`}
                  style={
                    selectedAgentId === agent.id
                      ? { background: 'linear-gradient(135deg, #e8f7fa 0%, #e8f0f8 100%)', borderColor: '#2A81B8' }
                      : {}
                  }
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{agent.icone || '🤖'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: '#272154' }}>{agent.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                        <span className="text-[10px] text-gray-400">v{agent.versao}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content - Agent editor */}
      <div className="flex-1 overflow-hidden">
        {selectedAgent ? (
          <AgentEditor
            key={`${selectedAgent.id}-${selectedAgent.versao}`}
            agent={selectedAgent}
            api={api}
            onSave={handleSave}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onRollback={handleRollback}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">Selecione um agente ou crie um novo</p>
              <p className="text-sm">Use o painel lateral para gerenciar seus agentes de IA</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
