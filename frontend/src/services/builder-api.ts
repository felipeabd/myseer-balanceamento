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
  status: 'rascunho' | 'testando' | 'publicado';
  custoMensalBrl: number;
  criadoPor: string;
  versao: number;
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
