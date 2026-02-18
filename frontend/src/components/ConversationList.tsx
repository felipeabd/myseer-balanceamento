import type { Conversation } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onOpenCredits: () => void;
}

export function ConversationList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenCredits,
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

        {/* Gestor de Estoque — always active (only agent for now) */}
        <div
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer transition-all hover:shadow-sm hover:brightness-95 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #e8f7fa 0%, #eceaf8 100%)', borderLeft: '3px solid #2A81B8' }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: '#272154' }}>Gestor de Estoque</span>
        </div>
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
          onClick={onOpenCredits}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span className="font-medium">Meus Créditos</span>
        </button>
        <p className="text-xs text-gray-400 text-center">
          Myseer · Seu negócio como você nunca viu
        </p>
      </div>
    </div>
  );
}
