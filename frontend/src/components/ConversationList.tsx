import type { Conversation } from '../types';

function MyseerLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cl-grad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#28B8CE" />
          <stop offset="50%" stopColor="#2A81B8" />
          <stop offset="100%" stopColor="#494495" />
        </linearGradient>
      </defs>
      {/* Outer hexagon */}
      <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="none" stroke="url(#cl-grad)" strokeWidth="2.5" />
      {/* Middle hexagon */}
      <polygon points="50,22 73,35 73,65 50,78 27,65 27,35" fill="none" stroke="url(#cl-grad)" strokeWidth="1.5" />
      {/* Inner hexagon */}
      <polygon points="50,36 63,43 63,57 50,64 37,57 37,43" fill="none" stroke="url(#cl-grad)" strokeWidth="1.2" />
      {/* Center to outer vertices */}
      <line x1="50" y1="50" x2="50" y2="4" stroke="url(#cl-grad)" strokeWidth="1.2" />
      <line x1="50" y1="50" x2="91" y2="27" stroke="url(#cl-grad)" strokeWidth="1.2" />
      <line x1="50" y1="50" x2="91" y2="73" stroke="url(#cl-grad)" strokeWidth="1.2" />
      <line x1="50" y1="50" x2="50" y2="96" stroke="url(#cl-grad)" strokeWidth="1.2" />
      <line x1="50" y1="50" x2="9" y2="73" stroke="url(#cl-grad)" strokeWidth="1.2" />
      <line x1="50" y1="50" x2="9" y2="27" stroke="url(#cl-grad)" strokeWidth="1.2" />
      {/* Center dot */}
      <circle cx="50" cy="50" r="5" fill="url(#cl-grad)" />
    </svg>
  );
}

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
        <div className="flex items-center gap-2 mb-3">
          <MyseerLogo size={32} />
          <div>
            <span className="font-bold text-base" style={{ color: '#272154', letterSpacing: '0.02em' }}>
              Iris
            </span>
            <p className="text-xs" style={{ color: '#2A81B8' }}>Gestor de Estoque</p>
          </div>
        </div>
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
