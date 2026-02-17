import { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput, type ImageData } from './MessageInput';
import { ConversationList } from './ConversationList';
import { ApiService } from '../services/api';
import type { Message, Conversation, ChatContextType } from '../types';

interface ChatInterfaceProps {
  context: ChatContextType;
}

export function ChatInterface({ context }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiService] = useState(() => new ApiService(context));

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

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
        images
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
  };

  const handleSelectConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      setCurrentConversation(conv);
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
      <ConversationList
        conversations={conversations}
        currentConversationId={currentConversation?.id}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="flex flex-1 flex-col">
        <MessageList
          messages={currentConversation?.messages || []}
          isLoading={isLoading}
        />
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
