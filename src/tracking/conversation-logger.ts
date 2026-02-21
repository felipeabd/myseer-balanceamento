import { ClickHouseService } from '../clickhouse/client';
import { v4 as uuidv4 } from 'uuid';

export interface TraceRow {
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
  clientName: string;
  userEmail: string;
  rating: 1 | -1 | 0;
  feedbackText: string;
}

export interface ConversationLog {
  agent: string;
  tenantId: string;
  userEmail: string;
  conversationId: string;
  userQuestion: string;
  responseSummary: string;
  responseType: 'discovery' | 'analysis' | 'plan' | 'error' | 'greeting' | 'other';
  toolsUsed: string[];
  sqlQueries: string[];
  businessEntities?: Record<string, string[]>;
  keywords?: string[];
  hasError: boolean;
  responseTimeMs: number;
  agentMetadata?: Record<string, any>;
}

export interface ConversationQuery {
  agent?: string;
  tenantId?: string;
  conversationId?: string;
  hasError?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class ConversationLogger {
  private clickhouse: ClickHouseService;

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
    this.ensureFeedbackTable().catch(err =>
      console.error('[ConversationLogger] Failed to create feedback table:', err)
    );
  }

  private async ensureFeedbackTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ia_feedback (
        message_id String,
        conversation_id String,
        rating Int8,
        feedback_text String DEFAULT '',
        timestamp DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(timestamp)
      ORDER BY message_id
    `;
    await this.clickhouse.execute(sql);
  }

  /**
   * Submit thumbs up/down feedback for a message
   */
  async submitFeedback(
    messageId: string,
    conversationId: string,
    rating: 1 | -1,
    feedbackText: string = ''
  ): Promise<void> {
    const escape = (str: string) => str.replace(/'/g, "\\'");
    const sql = `
      INSERT INTO ia_feedback (message_id, conversation_id, rating, feedback_text)
      VALUES ('${messageId}', '${conversationId}', ${rating}, '${escape(feedbackText)}')
    `;
    await this.clickhouse.execute(sql);
  }

  /**
   * Log a conversation interaction. Returns the generated messageId.
   */
  async log(data: ConversationLog): Promise<string> {
    const messageId = uuidv4();

    // Truncate response to 500 chars
    const responseSummary = data.responseSummary.length > 500
      ? data.responseSummary.substring(0, 497) + '...'
      : data.responseSummary;

    // Escape single quotes in strings
    const escape = (str: string) => str.replace(/'/g, "\\'");

    // Format business entities as Map
    const businessEntitiesStr = data.businessEntities
      ? `map(${Object.entries(data.businessEntities)
          .map(([key, values]) => `'${key}', [${values.map(v => `'${v}'`).join(', ')}]`)
          .join(', ')})`
      : 'map()';

    // Format keywords array
    const keywordsStr = data.keywords && data.keywords.length > 0
      ? `[${data.keywords.map(k => `'${escape(k)}'`).join(', ')}]`
      : '[]';

    // Format tools used array
    const toolsUsedStr = data.toolsUsed.length > 0
      ? `[${data.toolsUsed.map(t => `'${escape(t)}'`).join(', ')}]`
      : '[]';

    // Format SQL queries array (escape properly)
    const sqlQueriesStr = data.sqlQueries.length > 0
      ? `[${data.sqlQueries.map(q => `'${escape(q)}'`).join(', ')}]`
      : '[]';

    const query = `
      INSERT INTO ia_agents_log (
        agent,
        tenant_id,
        user_email,
        conversation_id,
        message_id,
        user_question,
        response_summary,
        response_type,
        tools_used,
        sql_queries,
        business_entities,
        keywords,
        has_error,
        response_time_ms,
        agent_metadata
      ) VALUES (
        '${data.agent}',
        '${data.tenantId}',
        '${data.userEmail}',
        '${data.conversationId}',
        '${messageId}',
        '${escape(data.userQuestion)}',
        '${escape(responseSummary)}',
        '${data.responseType}',
        ${toolsUsedStr},
        ${sqlQueriesStr},
        ${businessEntitiesStr},
        ${keywordsStr},
        ${data.hasError ? 1 : 0},
        ${data.responseTimeMs},
        '${data.agentMetadata ? escape(JSON.stringify(data.agentMetadata)) : ''}'
      )
    `;

    try {
      await this.clickhouse.execute(query);
    } catch (error) {
      console.error('[ConversationLogger] Failed to log conversation:', error);
      console.error('[ConversationLogger] Query was:', query);
      // Don't throw - we don't want to break the app if logging fails
    }

    return messageId;
  }

  /**
   * Query conversation logs
   */
  async query(params: ConversationQuery): Promise<any[]> {
    const conditions: string[] = ['1=1'];

    if (params.agent) {
      conditions.push(`agent = '${params.agent}'`);
    }

    if (params.tenantId) {
      conditions.push(`tenant_id = '${params.tenantId}'`);
    }

    if (params.conversationId) {
      conditions.push(`conversation_id = '${params.conversationId}'`);
    }

    if (params.hasError !== undefined) {
      conditions.push(`has_error = ${params.hasError ? 1 : 0}`);
    }

    if (params.startDate) {
      conditions.push(`timestamp >= '${params.startDate.toISOString().slice(0, 19).replace('T', ' ')}'`);
    }

    if (params.endDate) {
      conditions.push(`timestamp <= '${params.endDate.toISOString().slice(0, 19).replace('T', ' ')}'`);
    }

    const limit = params.limit ?? 100;

    const sql = `
      SELECT
        timestamp,
        agent,
        tenant_id,
        user_email,
        conversation_id,
        message_id,
        user_question,
        response_summary,
        response_type,
        tools_used,
        sql_queries,
        business_entities,
        keywords,
        has_error,
        response_time_ms,
        user_rating,
        user_feedback
      FROM ia_agents_log
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    return await this.clickhouse.query(sql, { tenantId: '', userEmail: '' });
  }

  /**
   * Get conversation statistics
   */
  async getStats(agent: string, tenantId: string, days: number = 30): Promise<any> {
    const sql = `
      SELECT
        count() as total_messages,
        countDistinct(conversation_id) as total_conversations,
        avg(response_time_ms) as avg_response_time,
        countIf(has_error = 1) as errors,
        avg(user_rating) as avg_rating,
        topK(10)(user_question) as top_questions
      FROM ia_agents_log
      WHERE agent = '${agent}'
        AND tenant_id = '${tenantId}'
        AND date >= today() - INTERVAL ${days} DAY
    `;

    const result = await this.clickhouse.query(sql, { tenantId, userEmail: '' });
    return result[0] || {};
  }

  /**
   * Get aggregated stats for an agent (no tenant filter — builder scope)
   */
  async getAgentStats(agentSlug: string, days: number = 30): Promise<any> {
    const sql = `
      SELECT
        count() as total_messages,
        countDistinct(conversation_id) as total_conversations,
        avg(response_time_ms) as avg_response_time_ms,
        countIf(has_error = 1) as error_count,
        topK(10)(user_question) as top_questions
      FROM ia_agents_log
      WHERE agent = '${agentSlug}'
        AND date >= today() - INTERVAL ${days} DAY
    `;
    const result = await this.clickhouse.query(sql, { tenantId: '', userEmail: '' });
    return result[0] || {};
  }

  /**
   * Get interaction breakdown by tenant (client) for an agent
   */
  async getAgentStatsByTenant(agentSlug: string, days: number = 30): Promise<any[]> {
    const sql = `
      SELECT
        tenant_id,
        count() as total_messages,
        countDistinct(conversation_id) as total_conversations,
        countIf(has_error = 1) as error_count
      FROM ia_agents_log
      WHERE agent = '${agentSlug}'
        AND date >= today() - INTERVAL ${days} DAY
      GROUP BY tenant_id
      ORDER BY total_messages DESC
      LIMIT 50
    `;
    return await this.clickhouse.query(sql, { tenantId: '', userEmail: '' });
  }

  /**
   * Get interaction breakdown by user for an agent
   */
  async getAgentStatsByUser(agentSlug: string, days: number = 30): Promise<any[]> {
    const sql = `
      SELECT
        user_email,
        count() as total_messages,
        countDistinct(conversation_id) as total_conversations,
        countIf(has_error = 1) as error_count
      FROM ia_agents_log
      WHERE agent = '${agentSlug}'
        AND date >= today() - INTERVAL ${days} DAY
      GROUP BY user_email
      ORDER BY total_messages DESC
      LIMIT 50
    `;
    return await this.clickhouse.query(sql, { tenantId: '', userEmail: '' });
  }

  /**
   * Get recent interaction traces for an agent (for Builder Trace Viewer)
   */
  async getAgentTraces(agentSlug: string, days: number = 30, limit: number = 100): Promise<TraceRow[]> {
    const escape = (s: string) => s.replace(/'/g, "\\'");

    const logs = await this.clickhouse.query(`
      SELECT message_id, conversation_id, timestamp, user_question, response_summary,
             response_type, tools_used, sql_queries, has_error, response_time_ms,
             tenant_id, user_email
      FROM ia_agents_log
      WHERE agent = '${escape(agentSlug)}'
        AND date >= today() - INTERVAL ${days} DAY
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `, { tenantId: '', userEmail: '' });

    if (logs.length === 0) return [];

    // Collect unique IDs for batch lookups
    const msgIds = logs.map((r: Record<string, unknown>) => `'${r.message_id}'`).join(',');
    const uniqueTenants = [...new Set(logs.map((r: Record<string, unknown>) => r.tenant_id as string).filter(Boolean))];
    const tenantIds = uniqueTenants.map(t => `'${escape(t)}'`).join(',');

    // Fetch feedback + client names in parallel
    const [feedbacks, clientRows] = await Promise.all([
      this.clickhouse.query(`
        SELECT message_id, rating, feedback_text
        FROM ia_feedback FINAL
        WHERE message_id IN (${msgIds})
      `, { tenantId: '', userEmail: '' }),
      tenantIds
        ? this.clickhouse.query(`
            SELECT DISTINCT tenant, cliente
            FROM dimensao_parametros_dw07
            WHERE tenant IN (${tenantIds})
          `, { tenantId: '', userEmail: '' })
        : Promise.resolve([]),
    ]);

    const feedbackMap = new Map<string, { rating: number; feedback_text: string }>(
      feedbacks.map((f: Record<string, unknown>) => [
        f.message_id as string,
        { rating: Number(f.rating), feedback_text: (f.feedback_text as string) || '' },
      ])
    );

    const clientMap = new Map<string, string>(
      clientRows.map((r: Record<string, unknown>) => [r.tenant as string, (r.cliente as string) || ''])
    );

    return logs.map((r: Record<string, unknown>) => {
      const safeArray = (v: unknown): string[] => {
        if (Array.isArray(v)) return v as string[];
        if (typeof v === 'string' && v.startsWith('[')) {
          try { return JSON.parse(v); } catch { return []; }
        }
        return [];
      };
      const fb = feedbackMap.get(r.message_id as string);
      return {
        messageId: r.message_id as string,
        conversationId: r.conversation_id as string,
        timestamp: String(r.timestamp),
        userQuestion: (r.user_question as string) || '',
        responseSummary: (r.response_summary as string) || '',
        responseType: (r.response_type as string) || 'other',
        toolsUsed: safeArray(r.tools_used),
        sqlQueries: safeArray(r.sql_queries),
        hasError: Number(r.has_error) === 1,
        responseTimeMs: Number(r.response_time_ms) || 0,
        tenantId: (r.tenant_id as string) || '',
        clientName: clientMap.get((r.tenant_id as string) || '') || '',
        userEmail: (r.user_email as string) || '',
        rating: fb ? (fb.rating as 1 | -1 | 0) : 0,
        feedbackText: fb ? fb.feedback_text : '',
      };
    });
  }

  /**
   * Extract keywords from question (simple implementation)
   */
  extractKeywords(question: string): string[] {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
      'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'dos', 'das',
      'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem',
      'que', 'qual', 'quais', 'como', 'quando', 'onde', 'me', 'te',
      'é', 'são', 'foi', 'foram', 'ser', 'estar', 'ter', 'fazer',
      'pode', 'posso', 'quero', 'gostaria', 'preciso'
    ]);

    return question
      .toLowerCase()
      .replace(/[^\w\sáéíóúâêîôûãõçà]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10); // Max 10 keywords
  }

  /**
   * Classify response type based on content
   */
  classifyResponseType(question: string, response: string): ConversationLog['responseType'] {
    const questionLower = question.toLowerCase();
    const responseLower = response.toLowerCase();

    if (responseLower.includes('erro') || responseLower.includes('problema')) {
      return 'error';
    }

    if (questionLower.includes('oi') || questionLower.includes('olá') || questionLower.includes('quem')) {
      return 'greeting';
    }

    if (questionLower.includes('quais') || questionLower.includes('listar') || questionLower.includes('mostrar')) {
      return 'discovery';
    }

    if (questionLower.includes('analise') || questionLower.includes('detalhe') || questionLower.includes('específico')) {
      return 'analysis';
    }

    if (questionLower.includes('plano') || questionLower.includes('montar') || questionLower.includes('como fazer')) {
      return 'plan';
    }

    return 'other';
  }
}
