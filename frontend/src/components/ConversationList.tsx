import type { Conversation } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationListProps) {
  return (
    <div className="w-64 border-r border-gray-200 flex flex-col" style={{ backgroundColor: '#f8f9fc' }}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white p-4">
        <div className="mb-1">
          <img src="/myseer-logo.png" alt="Myseer" className="h-9 w-auto" />
        </div>
        <p className="text-xs mb-3" style={{ color: '#2A81B8' }}>Iris · Gestor de Estoque</p>
        <div>
        <button
          onClick={onNewConversation}
          className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #2A81B8 50%, #494495 100%)' }}
        >
          + Nova Conversa
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">
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
                <h3 className="text-sm font-medium truncate" style={{ color: '#272154' }}>
                  {conv.title}
                </h3>
                {conv.lastMessage && (
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {conv.lastMessage}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(conv.updatedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded p-1 text-red-600 hover:bg-red-100 transition-opacity"
                  title="Deletar conversa"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-3">
        <p className="text-xs text-gray-400 text-center">
          Myseer · Seu negócio como você nunca viu
        </p>
      </div>
    </div>
  );
}
