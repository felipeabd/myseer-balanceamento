import { ClickHouseService } from '../clickhouse/client';
import { v4 as uuidv4 } from 'uuid';

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
  }

  /**
   * Log a conversation interaction
   */
  async log(data: ConversationLog): Promise<void> {
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
