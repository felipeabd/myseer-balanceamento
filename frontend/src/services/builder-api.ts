const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030';

export interface AgentDefinitionFull {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  saudacao: string;
  placeholderInput: string;
  prompt: {
    personalidade: string;
    tom: string;
    restricoes: string;
    exemplos: string;
    fluxo: string;
  };
  tabelas: Array<{
    tabela: string;
    alias: string;
    colunas: string[];
    filtroObrigatorio: string;
  }>;
  skills: {
    consulta_sql: boolean;
    gerar_csv: boolean;
    knowledge_base: boolean;
    otimizador: boolean;
  };
  regraAnalise: string;
  conhecimento: string;
  perguntasRapidas: Array<{ icon: string; title: string; prompt: string }>;
  modeloPadrao: string;
  maxTokens: number;
  temperature: number;
  maxToolCalls: number;
  contextoConversas: boolean;
  numConversasAnteriores: number;
  perfilUsuario: boolean;
  tenantId: string;
  status: 'rascunho' | 'testando' | 'publicado';
  custoMensalBrl: number;
  criadoPor: string;
  versao: number;
}

export interface AgentVersion {
  versao: number;
  atualizadoEm: string;
  nome: string;
  status: string;
}

export interface TableInfo {
  name: string;
  engine: string;
  totalRows: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  comment: string;
}

export interface AgentAnalytics {
  period: number;
  stats: {
    total_messages: number;
    total_conversations: number;
    avg_response_time_ms: number;
    error_count: number;
    top_questions: string[];
  };
  daily: Array<{
    date: string;
    total_tokens: number;
    cost_usd: number;
    request_count: number;
  }>;
  by_tenant: Array<{
    tenant_id: string;
    total_messages: number;
    total_conversations: number;
    error_count: number;
  }>;
  by_user: Array<{
    user_email: string;
    total_messages: number;
    total_conversations: number;
    error_count: number;
  }>;
}

export interface RuleRecord {
  id: string;
  tenant: string;
  tipo: string;
  status: string;
  prioridade: number;
  alvo: string;
  condicao: string;
  acao: string;
  texto: string;
  criadoPor: string;
  criadoEm: string;
  vezesAplicada: number;
}

export interface TraceRecord {
  messageId: string;
  conversationId: string;
  timestamp: string;
  userQuestion: string;
  responseSummary: string;
  responseType: string;
  toolsUsed: string[];
  sqlQueries: string[];
  hasError: boolean;
  responseTimeMs: number;
  tenantId: string;
  userEmail: string;
  rating: 1 | -1 | 0;
  feedbackText: string;
}

export class BuilderApiService {
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-user-email': this.userEmail,
    };
  }

  // ── Agents CRUD ──────────────────────────────────────────

  async listAgents(): Promise<AgentDefinitionFull[]> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.agents;
  }

  async getAgent(id: string): Promise<AgentDefinitionFull> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async createAgent(data: Partial<AgentDefinitionFull> & { slug: string; nome: string }): Promise<AgentDefinitionFull> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async updateAgent(id: string, data: Partial<AgentDefinitionFull>): Promise<AgentDefinitionFull> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async publishAgent(id: string): Promise<AgentDefinitionFull> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}/publish`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async unpublishAgent(id: string): Promise<AgentDefinitionFull> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}/unpublish`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Versioning ─────────────────────────────────────────

  async getAgentVersions(id: string): Promise<AgentVersion[]> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}/versions`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.versions;
  }

  async rollbackAgent(id: string, versao: number): Promise<AgentDefinitionFull> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}/rollback`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ versao }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Schema Introspection ────────────────────────────────

  async listTables(): Promise<TableInfo[]> {
    const res = await fetch(`${API_BASE_URL}/api/builder/tables`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.tables;
  }

  async describeTable(name: string): Promise<ColumnInfo[]> {
    const res = await fetch(`${API_BASE_URL}/api/builder/tables/${name}/columns`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.columns;
  }

  // ── Analytics ───────────────────────────────────────────

  // ── Rules Management ────────────────────────────────────

  async listRules(params: { tenant?: string; tipo?: string; status?: string } = {}): Promise<{ rules: RuleRecord[]; tenants: string[] }> {
    const qs = new URLSearchParams();
    if (params.tenant) qs.set('tenant', params.tenant);
    if (params.tipo) qs.set('tipo', params.tipo);
    if (params.status) qs.set('status', params.status);
    const res = await fetch(`${API_BASE_URL}/api/builder/rules?${qs}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async createRule(data: {
    tenant: string;
    tipo: string;
    prioridade: number;
    texto: string;
    alvo?: string;
    condicao?: string;
    acao?: string;
  }): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/builder/rules`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
    }
  }

  async toggleRuleStatus(id: string, status: 'ativo' | 'inativo'): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/builder/rules/${id}/toggle`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  async deleteRule(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/builder/rules/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  // ── Analytics ───────────────────────────────────────────

  async getAgentTraces(id: string, days: number = 30, limit: number = 100): Promise<TraceRecord[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/builder/agents/${id}/traces?days=${days}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.traces;
  }

  async getAgentAnalytics(id: string, days: number = 30): Promise<AgentAnalytics> {
    const res = await fetch(`${API_BASE_URL}/api/builder/agents/${id}/analytics?days=${days}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Test Chat ───────────────────────────────────────────

  async testChatStream(
    agentId: string,
    message: string,
    conversationId: string | undefined,
    onChunk: (text: string) => void,
    onComplete: (conversationId: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/builder/agents/${agentId}/test-chat/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ message, conversationId }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Response body is null');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) onChunk(parsed.text);
              if (parsed.conversationId) onComplete(parsed.conversationId);
              if (parsed.error) onError(new Error(parsed.error));
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (error) {
      onError(error as Error);
    }
  }
}
