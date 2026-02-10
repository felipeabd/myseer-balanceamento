import { ClickHouseService } from '../clickhouse/client';

export interface TokenUsage {
  tenantId: string;
  userEmail: string;
  conversationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  endpoint: 'chat' | 'stream';
}

export interface UsageMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export class UsageTracker {
  private clickhouse: ClickHouseService;

  // Token costs per 1M tokens (as of 2025)
  private readonly TOKEN_COSTS = {
    'claude-opus-4': { input: 15.0, output: 75.0 },
    'claude-sonnet-4': { input: 3.0, output: 15.0 },
    'claude-sonnet-3-5': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5': { input: 1.0, output: 5.0 },
    'claude-haiku-3-5': { input: 0.25, output: 1.25 },
  };

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
  }

  /**
   * Track token usage for a conversation
   */
  async trackUsage(usage: TokenUsage): Promise<void> {
    const totalTokens = usage.inputTokens + usage.outputTokens;
    const costUsd = this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens);

    const query = `
      INSERT INTO ia_usage_tokens (
        tenant_id,
        user_email,
        conversation_id,
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        endpoint
      ) VALUES (
        '${usage.tenantId}',
        '${usage.userEmail}',
        '${usage.conversationId}',
        '${usage.model}',
        ${usage.inputTokens},
        ${usage.outputTokens},
        ${totalTokens},
        ${costUsd},
        '${usage.endpoint}'
      )
    `;

    try {
      await this.clickhouse.execute(query);
    } catch (error) {
      console.error('[UsageTracker] Failed to track usage:', error);
      // Don't throw - we don't want to break the app if tracking fails
    }
  }

  /**
   * Calculate cost based on model and token counts
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Find matching model (handle version suffixes)
    const modelKey = Object.keys(this.TOKEN_COSTS).find(key => model.includes(key));

    if (!modelKey) {
      console.warn(`[UsageTracker] Unknown model: ${model}, using Haiku pricing`);
      const costs = this.TOKEN_COSTS['claude-haiku-4-5'];
      return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
    }

    const costs = this.TOKEN_COSTS[modelKey as keyof typeof this.TOKEN_COSTS];
    return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
  }

  /**
   * Get usage metrics for a tenant
   */
  async getTenantMetrics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageMetrics> {
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ?? new Date();

    const query = `
      SELECT
        sum(input_tokens) as inputTokens,
        sum(output_tokens) as outputTokens,
        sum(total_tokens) as totalTokens,
        sum(cost_usd) as estimatedCostUSD,
        count(*) as requestCount
      FROM ia_usage_tokens
      WHERE tenant_id = '${tenantId}'
        AND timestamp >= '${start.toISOString().slice(0, 19).replace('T', ' ')}'
        AND timestamp <= '${end.toISOString().slice(0, 19).replace('T', ' ')}'
    `;

    const rows = await this.clickhouse.query(query, { tenantId, userEmail: '' });

    if (rows.length === 0) {
      return {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        requestCount: 0,
      };
    }

    return rows[0] as UsageMetrics;
  }

  /**
   * Get usage metrics for a specific conversation
   */
  async getConversationMetrics(conversationId: string): Promise<UsageMetrics> {
    const query = `
      SELECT
        sum(input_tokens) as inputTokens,
        sum(output_tokens) as outputTokens,
        sum(total_tokens) as totalTokens,
        sum(cost_usd) as estimatedCostUSD,
        count(*) as requestCount
      FROM ia_usage_tokens
      WHERE conversation_id = '${conversationId}'
    `;

    const rows = await this.clickhouse.query(query, { tenantId: '', userEmail: '' });

    if (rows.length === 0) {
      return {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        requestCount: 0,
      };
    }

    return rows[0] as UsageMetrics;
  }

  /**
   * Get daily usage breakdown for a tenant
   */
  async getDailyUsage(
    tenantId: string,
    days: number = 30
  ): Promise<Array<{ date: string; totalTokens: number; costUsd: number }>> {
    const query = `
      SELECT
        toDate(timestamp) as date,
        sum(total_tokens) as totalTokens,
        sum(cost_usd) as costUsd
      FROM ia_usage_tokens
      WHERE tenant_id = '${tenantId}'
        AND date >= today() - INTERVAL ${days} DAY
      GROUP BY date
      ORDER BY date DESC
    `;

    return await this.clickhouse.query(query, { tenantId, userEmail: '' });
  }
}
