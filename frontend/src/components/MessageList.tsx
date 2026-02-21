import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, AgentConfig } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onStarterPrompt?: (prompt: string) => void;
  selectedAgent?: AgentConfig | null;
  onFeedback?: (messageId: string, rating: 1 | -1, feedbackText?: string) => void;
}

export function MessageList({ messages, isLoading, onStarterPrompt, selectedAgent, onFeedback }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track per-message feedback state: messageId → rating submitted
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | -1>>({});
  // Track which message is showing the dislike text input
  const [dislikeOpen, setDislikeOpen] = useState<string | null>(null);
  const [dislikeText, setDislikeText] = useState('');
  const starterPrompts = selectedAgent?.perguntasRapidas || [];
  const agentLabel = selectedAgent ? `Iris · ${selectedAgent.nome}` : 'Iris';
  const agentSubtitle = selectedAgent?.saudacao || 'Como posso ajudar hoje?';

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
            <p className="text-sm font-medium mb-1" style={{ color: '#272154' }}>{agentLabel}</p>
            <p className="text-gray-500 mb-6 text-sm">
              {agentSubtitle}
            </p>

            {/* Starter prompts grid */}
            <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto overflow-visible">
              {starterPrompts.map((item) => (
                <button
                  key={item.title}
                  onClick={() => onStarterPrompt?.(item.prompt)}
                  className="relative text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="text-xl mb-2">{item.icon}</div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {item.prompt}
                  </p>
                  {/* Tooltip com texto completo */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    {item.prompt}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </div>
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

              {/* Feedback buttons — only for assistant messages with a messageId */}
              {msg.role === 'assistant' && msg.messageId && onFeedback && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  {feedbackSent[msg.messageId] ? (
                    <p className="text-xs text-gray-400">
                      {feedbackSent[msg.messageId] === 1 ? '👍 Obrigado!' : '👎 Feedback enviado'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onFeedback(msg.messageId!, 1);
                            setFeedbackSent(prev => ({ ...prev, [msg.messageId!]: 1 }));
                            setDislikeOpen(null);
                          }}
                          className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                          title="Boa resposta"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setDislikeOpen(dislikeOpen === msg.messageId ? null : msg.messageId!);
                            setDislikeText('');
                          }}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Resposta ruim"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                          </svg>
                        </button>
                      </div>
                      {dislikeOpen === msg.messageId && (
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={dislikeText}
                            onChange={(e) => setDislikeText(e.target.value)}
                            placeholder="O que estava errado? (opcional)"
                            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-300"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onFeedback(msg.messageId!, -1, dislikeText);
                                setFeedbackSent(prev => ({ ...prev, [msg.messageId!]: -1 }));
                                setDislikeOpen(null);
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              onFeedback(msg.messageId!, -1, dislikeText);
                              setFeedbackSent(prev => ({ ...prev, [msg.messageId!]: -1 }));
                              setDislikeOpen(null);
                            }}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Enviar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
