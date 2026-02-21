import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BuilderApiService } from '../../services/builder-api';

interface TestChatProps {
  agentId: string;
  agentNome: string;
  api: BuilderApiService;
}

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function TestChat({ agentId, agentNome, api }: TestChatProps) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: TestMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const assistantMsg: TestMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    let fullText = '';

    try {
      await api.testChatStream(
        agentId,
        userMsg.content,
        conversationId,
        (text) => {
          fullText += text;
          setMessages(prev => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, content: fullText };
            } else {
              msgs.push({ ...assistantMsg, content: fullText });
            }
            return msgs;
          });
        },
        (convId) => {
          setConversationId(convId);
          setLoading(false);
        },
        (error) => {
          console.error('Test chat error:', error);
          setMessages(prev => [...prev, {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: 'Erro ao testar o agente: ' + error.message,
          }]);
          setLoading(false);
        }
      );
    } catch {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  return (
    <div className="flex flex-col h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-2.5 flex items-center justify-between bg-gray-50">
        <p className="text-sm font-medium" style={{ color: '#272154' }}>
          Teste: {agentNome}
        </p>
        <button
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
        >
          Limpar
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Envie uma mensagem para testar o agente
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                msg.role === 'user'
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
              style={
                msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #2A81B8 0%, #494495 100%)' }
                  : {}
              }
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" style={{ backgroundColor: '#28B8CE' }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" style={{ backgroundColor: '#2A81B8' }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: '#494495' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Teste o agente..."
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #2A81B8 0%, #494495 100%)' }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
