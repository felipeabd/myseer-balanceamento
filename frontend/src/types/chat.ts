export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
  messages: Message[];
}

export interface ChatContextType {
  tenantId: string;
  userEmail: string;
}
