import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030';

const STARTER_PROMPTS = [
  {
    icon: '⚠️',
    title: 'Risco de ruptura',
    prompt: 'Quais produtos estão em risco de ruptura nas filiais hoje?',
  },
  {
    icon: '🔄',
    title: 'Oportunidades de balanceamento',
    prompt: 'Mostre as principais oportunidades de transferência de estoque entre filiais.',
  },
  {
    icon: '📦',
    title: 'Excesso redistributível',
    prompt: 'Quais filiais têm excesso de estoque que pode ser transferido?',
  },
  {
    icon: '💰',
    title: 'Capital imobilizado',
    prompt: 'Qual o capital imobilizado em produtos parados por mais de 90 dias?',
  },
];


interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onStarterPrompt?: (prompt: string) => void;
}

export function MessageList({ messages, isLoading, onStarterPrompt }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-10">
            <div className="flex justify-center mb-6">
              <img src="/myseer-logo-vertical.png" alt="Myseer" className="h-36 w-auto" />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: '#272154' }}>Iris · Gestor de Estoque</p>
            <p className="text-gray-500 mb-6 text-sm">
              Como posso ajudar com seu estoque hoje?
            </p>

            {/* Starter prompts grid */}
            <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.title}
                  onClick={() => onStarterPrompt?.(item.prompt)}
                  className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="text-xl mb-2">{item.icon}</div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'max-w-[80%] text-white'
                  : 'max-w-[95%] bg-white border border-gray-200 text-gray-800'
              }`}
              style={
                msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #2A81B8 0%, #494495 100%)' }
                  : {}
              }
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none overflow-x-auto">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children, ...props }) => {
                        if (href && href.includes('/api/iris/download/csv/')) {
                          const csvUrl = href.startsWith('http') ? href : `${API_BASE_URL}${href}`;
                          return (
                            <a
                              href={csvUrl}
                              className="not-prose inline-flex items-center gap-2 px-5 py-2.5 mt-3 mb-1 rounded-lg transition-colors no-underline font-bold text-base text-white shadow-sm"
                              style={{ backgroundColor: '#1B5E20', color: '#ffffff' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#154a19')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1B5E20')}
                              download
                              {...props}
                            >
                              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Baixar CSV
                            </a>
                          );
                        }
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" {...props}>
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              <p
                className={`mt-1 text-xs ${
                  msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" style={{ backgroundColor: '#28B8CE' }}></div>
                <div className="h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" style={{ backgroundColor: '#2A81B8' }}></div>
                <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: '#494495' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
