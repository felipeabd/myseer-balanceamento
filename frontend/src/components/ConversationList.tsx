import type { Conversation, AgentConfig } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onOpenCredits: () => void;
  onOpenSettings: () => void;
  onOpenSummary: () => void;
  agents: AgentConfig[];
  selectedAgent: AgentConfig | null;
  onSelectAgent: (agent: AgentConfig) => void;
}

export function ConversationList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenCredits,
  onOpenSettings,
  onOpenSummary,
  agents,
  selectedAgent,
  onSelectAgent,
}: ConversationListProps) {
  return (
    <div className="w-64 border-r border-gray-200 flex flex-col" style={{ backgroundColor: '#f8f9fc' }}>

      {/* Brand header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <img src="/myseer-logo.png" alt="Myseer" className="h-8 w-auto" />
      </div>

      {/* Agentes Myseer section */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
          Agentes Myseer
        </p>

        {agents.map((agent) => {
          const isSelected = selectedAgent?.slug === agent.slug;
          const isDisabled = !agent.habilitado;

          if (isDisabled) {
            return (
              <div
                key={agent.slug}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 opacity-50 cursor-not-allowed"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-gray-200">
                  <span className="text-sm">{agent.icone}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-gray-500">{agent.nome}</span>
                  <span className="text-[10px] text-gray-400">Em breve</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={agent.slug}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer transition-all hover:shadow-sm hover:brightness-95 active:scale-[0.98]"
              style={
                isSelected
                  ? { background: 'linear-gradient(135deg, #e8f7fa 0%, #eceaf8 100%)', borderLeft: '3px solid #2A81B8' }
                  : {}
              }
              onClick={() => onSelectAgent(agent)}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${agent.cor} 0%, #494495 100%)` }}
              >
                <span className="text-sm">{agent.icone}</span>
              </div>
              <span className="text-sm font-medium" style={{ color: '#272154' }}>{agent.nome}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 mx-3" />

      {/* Conversations section */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewConversation}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #2A81B8 50%, #494495 100%)' }}
        >
          + Nova Conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="p-4 text-center text-xs text-gray-400">
            Nenhuma conversa ainda
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative rounded-lg p-3 cursor-pointer transition-colors ${
                  currentConversationId === conv.id
                    ? 'border'
                    : 'bg-white border border-gray-200 hover:bg-gray-100'
                }`}
                style={
                  currentConversationId === conv.id
                    ? { background: 'linear-gradient(135deg, #e8f7fa 0%, #e8f0f8 100%)', borderColor: '#2A81B8' }
                    : {}
                }
                onClick={() => onSelectConversation(conv.id)}
              >
                <h3 className="text-sm font-medium truncate pr-5" style={{ color: '#272154' }}>
                  {conv.title}
                </h3>
                {conv.lastMessage && (
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {conv.lastMessage}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-gray-400">
                  {new Date(conv.updatedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded p-1 text-red-500 hover:bg-red-100 transition-opacity"
                  title="Deletar conversa"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white px-3 py-2.5 space-y-2">
        <button
          onClick={onOpenSummary}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="font-medium">Guia de Uso</span>
        </button>
        <div className="flex gap-1">
          <button
            onClick={onOpenCredits}
            className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="font-medium">Meus Créditos</span>
          </button>
          <button
            onClick={onOpenSettings}
            title="Configurações"
            className="flex items-center justify-center rounded-lg px-2.5 py-2 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Myseer · Seu negócio como você nunca viu
        </p>
      </div>
    </div>
  );
}
