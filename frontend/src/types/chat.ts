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

// ── Agent Framework Types ─────────────────────────────────

export interface StarterPrompt {
  icon: string;
  title: string;
  prompt: string;
}

export interface AgentConfig {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  saudacao: string;
  placeholderInput: string;
  perguntasRapidas: StarterPrompt[];
  habilitado: boolean;
}
