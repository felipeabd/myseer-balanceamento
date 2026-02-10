// ============================================================
// Domain types for IRIS - Inventory Balancing Agent
// ============================================================

/** Tenant context passed on every request */
export interface TenantContext {
  tenantId: string;
  userEmail: string;
}

/** A single row from ia_fato_balanceamento */
export interface BalanceamentoRow {
  tenant: string;
  dtcarga: string;
  cdprod: number;
  cdFilial: number;
  descricao: string;
  curva: string;
  nomefabricante: string;
  qtnecessidade: number;
  qtexcesso: number;
  qtestoque: number;
  cobertura: number;
  mediaf_un: number;
  vlrcusto: number;
  dias_parado: number;
  dias_falta: number;
  filialdeposito: number;
}

/** Rule types that the agent must respect */
export type RuleType = 'BLOQUEIO' | 'LIMITE' | 'PRIORIDADE' | 'EXCEÇÃO';

export interface BalancingRule {
  id: string;
  type: RuleType;
  priority: number;
  description: string;
  field?: string;
  condition?: string;
  value?: string | number;
  active: boolean;
}

/** Chat message in a conversation */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/** A conversation session */
export interface Conversation {
  id: string;
  tenantId: string;
  userEmail: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/** Request body for the chat endpoint */
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

/** Response from the chat endpoint */
export interface ChatResponse {
  conversationId: string;
  message: string;
}

/** Configuration for the IRIS module */
export interface IrisConfig {
  anthropicApiKey: string;
  anthropicModel?: string;
  clickhouse: {
    url: string;
    database?: string;
    username?: string;
    password?: string;
  };
  /** Optional: provide rules externally instead of from DB */
  rules?: BalancingRule[];
  /** Max tool calls per user message (default: 2) */
  maxToolCalls?: number;
}

/** Streaming callback for SSE responses */
export type StreamCallback = (chunk: string, done: boolean) => void;
