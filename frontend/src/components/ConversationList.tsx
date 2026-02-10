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
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Iris Balanceamento
        </h2>
        <button
          onClick={onNewConversation}
          className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
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
                    ? 'bg-blue-100 border border-blue-300'
                    : 'bg-white border border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <h3 className="text-sm font-medium text-gray-800 truncate">
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
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-3">
        <p className="text-xs text-gray-500 text-center">
          Análise de balanceamento de estoque
        </p>
      </div>
    </div>
  );
}
