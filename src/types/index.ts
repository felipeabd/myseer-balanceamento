// ============================================================
// Domain types for IRIS - Agent Framework
// ============================================================

// ── Agent Definition (Framework) ──────────────────────────

/** Table/column configuration for an agent */
export interface AgentTableConfig {
  tabela: string;
  alias: string;
  colunas: string[];
  filtroObrigatorio: string;
}

/** Skills that can be toggled per agent */
export interface AgentSkills {
  consulta_sql: boolean;
  gerar_csv: boolean;
  knowledge_base: boolean;
  otimizador: boolean;
}

/** Prompt sections configured by the specialist */
export interface AgentPromptSections {
  personalidade: string;
  tom: string;
  restricoes: string;
  exemplos: string;
  fluxo: string;
}

/** A starter/quick question shown to the user */
export interface StarterPrompt {
  icon: string;
  title: string;
  prompt: string;
}

/** Full agent definition as stored in ia_agentes */
export interface AgentDefinition {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  saudacao: string;
  placeholderInput: string;

  prompt: AgentPromptSections;
  tabelas: AgentTableConfig[];
  skills: AgentSkills;
  regraAnalise: string;
  conhecimento: string;
  perguntasRapidas: StarterPrompt[];

  modeloPadrao: string;
  maxTokens: number;
  temperature: number;
  maxToolCalls: number;

  status: 'rascunho' | 'testando' | 'publicado';
  custoMensalBrl: number;
  criadoPor: string;
  versao: number;
  ordem: number;
}

/** Agent info returned to the consumer frontend (subset of AgentDefinition) */
export interface AgentInfo {
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

// ── Legacy Domain Types ───────────────────────────────────

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

/** Content block types for multimodal messages */
export type MessageContent = string | ContentBlock[];

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    data: string;
  };
}

export type ContentBlock = TextContent | ImageContent;

/** Chat message in a conversation */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
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
  images?: ImageContent[];
  conversationId?: string;
  /** Agent to use (defaults to 'estoque' for backwards compatibility) */
  agentSlug?: string;
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
  /** Max tool calls per user message (default: 3) */
  maxToolCalls?: number;
  /** Base URL for download links (default: http://localhost:3030) */
  baseUrl?: string;
}

/** Streaming callback for SSE responses */
export type StreamCallback = (chunk: string, done: boolean) => void;
