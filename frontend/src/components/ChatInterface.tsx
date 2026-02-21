import { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput, type ImageData } from './MessageInput';
import { ConversationList } from './ConversationList';
import { CreditsPanel } from './CreditsPanel';
import { SettingsPanel } from './SettingsPanel';
import { SummaryPanel } from './SummaryPanel';
import { ApiService } from '../services/api';
import type { Message, Conversation, ChatContextType, AgentConfig } from '../types';

interface ChatInterfaceProps {
  context: ChatContextType;
}

export function ChatInterface({ context }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [apiService] = useState(() => new ApiService(context));

  // Load conversations and agents on mount
  useEffect(() => {
    loadConversations();
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await apiService.getAgents();
      setAgents(data);
      // Auto-select first enabled agent
      const firstEnabled = data.find(a => a.habilitado);
      if (firstEnabled && !selectedAgent) {
        setSelectedAgent(firstEnabled);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await apiService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleSendMessage = async (messageText: string, images?: ImageData[]) => {
    if (!messageText.trim() && (!images || images.length === 0)) return;

    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    // Add user message to current conversation
    const updatedMessages = [...(currentConversation?.messages || []), userMessage];

    if (currentConversation) {
      setCurrentConversation({
        ...currentConversation,
        messages: updatedMessages,
      });
    } else {
      // Create new conversation
      const newConv: Conversation = {
        id: 'temp',
        title: messageText.substring(0, 50),
        messages: updatedMessages,
        updatedAt: new Date(),
      };
      setCurrentConversation(newConv);
    }

    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    let fullResponse = '';

    try {
      await apiService.sendMessageStream(
        messageText,
        currentConversation?.id !== 'temp' ? currentConversation?.id : undefined,
        // onChunk
        (text: string) => {
          fullResponse += text;
          assistantMessage.content = fullResponse;

          setCurrentConversation((prev) => {
            if (!prev) return prev;

            const messages = [...prev.messages];
            const lastMsg = messages[messages.length - 1];

            if (lastMsg?.role === 'assistant') {
              messages[messages.length - 1] = { ...assistantMessage };
            } else {
              messages.push({ ...assistantMessage });
            }

            return { ...prev, messages };
          });
        },
        // onComplete
        (conversationId: string) => {
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            return { ...prev, id: conversationId };
          });
          setIsLoading(false);
          // Refresh sidebar list so new/updated conversation appears
          loadConversations();
        },
        // onError
        (error: Error) => {
          console.error('Stream error:', error);
          setIsLoading(false);

          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
            timestamp: new Date(),
          };

          setCurrentConversation((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: [...prev.messages, errorMessage],
            };
          });
        },
        images,
        selectedAgent?.slug,
        // onMessageId — attach the log ID to the assistant message for feedback
        (messageId: string) => {
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const messages = [...prev.messages];
            const lastIdx = messages.map(m => m.role).lastIndexOf('assistant');
            if (lastIdx !== -1) {
              messages[lastIdx] = { ...messages[lastIdx], messageId };
            }
            return { ...prev, messages };
          });
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      const conv = await apiService.getConversation(conversationId);
      // Normalize timestamps from strings to Date objects
      conv.updatedAt = new Date(conv.updatedAt);
      if (conv.messages) {
        conv.messages = conv.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleFeedback = async (messageId: string, rating: 1 | -1, feedbackText?: string) => {
    const conversationId = currentConversation?.id;
    if (!conversationId || conversationId === 'temp') return;
    try {
      await apiService.submitFeedback(messageId, conversationId, rating, feedbackText);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await apiService.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {creditsOpen && (
        <CreditsPanel
          apiService={apiService}
          onClose={() => setCreditsOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          apiService={apiService}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {summaryOpen && (
        <SummaryPanel onClose={() => setSummaryOpen(false)} />
      )}

      <ConversationList
        conversations={conversations}
        currentConversationId={currentConversation?.id}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenCredits={() => setCreditsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSummary={() => setSummaryOpen(true)}
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
      />

      <div className="flex flex-1 flex-col">
        <MessageList
          messages={currentConversation?.messages || []}
          isLoading={isLoading}
          onStarterPrompt={handleSendMessage}
          selectedAgent={selectedAgent}
          onFeedback={handleFeedback}
        />
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          selectedAgent={selectedAgent}
        />
      </div>
    </div>
  );
}
