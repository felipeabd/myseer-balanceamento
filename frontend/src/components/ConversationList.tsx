import type { Conversation } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onOpenCredits: () => void;
  onOpenSettings: () => void;
  onOpenSummary: () => void;
  selectedAgent: 'estoque' | 'vendas' | 'prevencao';
  onSelectAgent: (agent: 'estoque' | 'vendas' | 'prevencao') => void;
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

        {/* Gestor de Estoque */}
        <div
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer transition-all hover:shadow-sm hover:brightness-95 active:scale-[0.98]"
          style={
            selectedAgent === 'estoque'
              ? { background: 'linear-gradient(135deg, #e8f7fa 0%, #eceaf8 100%)', borderLeft: '3px solid #2A81B8' }
              : {}
          }
          onClick={() => onSelectAgent('estoque')}
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

        {/* Gestor de Vendas */}
        <div
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer transition-all hover:shadow-sm hover:brightness-95 active:scale-[0.98]"
          style={
            selectedAgent === 'vendas'
              ? { background: 'linear-gradient(135deg, #e8f7fa 0%, #eceaf8 100%)', borderLeft: '3px solid #2A81B8' }
              : {}
          }
          onClick={() => onSelectAgent('vendas')}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: '#272154' }}>Gestor de Vendas</span>
        </div>

        {/* Gestor de Prevenção */}
        <div
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer transition-all hover:shadow-sm hover:brightness-95 active:scale-[0.98]"
          style={
            selectedAgent === 'prevencao'
              ? { background: 'linear-gradient(135deg, #e8f7fa 0%, #eceaf8 100%)', borderLeft: '3px solid #2A81B8' }
              : {}
          }
          onClick={() => onSelectAgent('prevencao')}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: '#272154' }}>Gestor de Prevenção</span>
        </div>

        {/* Gestor de Mercado — em breve */}
        <div
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 opacity-50 cursor-not-allowed"
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-gray-200">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-gray-500">Gestor de Mercado</span>
            <span className="text-[10px] text-gray-400">Em breve</span>
          </div>
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
