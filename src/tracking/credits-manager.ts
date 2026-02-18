import { ClickHouseService } from '../clickhouse/client';

export interface CreditsInfo {
  tenantId: string;
  currency: 'BRL';
  contractedBrl: number;
  usedBrl: number;
  availableBrl: number;
  exchangeRate: number;
  daily: Array<{ date: string; totalTokens: number; costBrl: number }>;
  hourly: Array<{ hour: string; totalTokens: number; costBrl: number }>;
  byUser: Array<{ userEmail: string; totalTokens: number; costBrl: number }>;
}

const DEFAULT_EXCHANGE_RATE = 5.8;

export class CreditsManager {
  private clickhouse: ClickHouseService;

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
  }

  /** Create ia_tenant_credits table if it doesn't exist */
  async ensureTable(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_tenant_credits (
          tenant_id String,
          contracted_brl Float64,
          usd_to_brl_rate Float64,
          updated_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY tenant_id
      `);
      console.log('[CreditsManager] Table ia_tenant_credits ready');
    } catch (error) {
      console.error('[CreditsManager] Failed to ensure table:', error);
    }
  }

  /** Get contracted credits config for a tenant */
  private async getConfig(tenantId: string): Promise<{ contractedBrl: number; rate: number }> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT contracted_brl, usd_to_brl_rate
        FROM ia_tenant_credits FINAL
        WHERE tenant_id = '${tenantId}'
        LIMIT 1
      `);
      if (rows.length > 0) {
        return {
          contractedBrl: Number(rows[0].contracted_brl) || 0,
          rate: Number(rows[0].usd_to_brl_rate) || DEFAULT_EXCHANGE_RATE,
        };
      }
    } catch (error) {
      console.error('[CreditsManager] Failed to get credits config:', error);
    }
    return { contractedBrl: 0, rate: DEFAULT_EXCHANGE_RATE };
  }

  /** Get total used credits in BRL */
  private async getUsedBrl(tenantId: string, rate: number): Promise<number> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT SUM(cost_usd) as total_cost
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
      `);
      if (rows.length > 0 && rows[0].total_cost != null) {
        return Number(rows[0].total_cost) * rate;
      }
    } catch (error) {
      console.error('[CreditsManager] Failed to get used credits:', error);
    }
    return 0;
  }

  /** Get daily usage for the last N days in BRL */
  private async getDailyBrl(tenantId: string, rate: number, days = 7): Promise<Array<{ date: string; totalTokens: number; costBrl: number }>> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT
          toString(toDate(timestamp)) as date,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} as costBrl
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
          AND toDate(timestamp) >= today() - INTERVAL ${days} DAY
        GROUP BY date
        ORDER BY date ASC
      `);
      return rows.map(r => ({
        date: String(r.date),
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      }));
    } catch (error) {
      console.error('[CreditsManager] Failed to get daily usage:', error);
    }
    return [];
  }

  /** Get hourly usage for the last 24 hours in BRL */
  private async getHourlyBrl(tenantId: string, rate: number): Promise<Array<{ hour: string; totalTokens: number; costBrl: number }>> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT
          toString(toHour(timestamp)) as hour,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} as costBrl
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
          AND timestamp >= now() - INTERVAL 24 HOUR
        GROUP BY hour
        ORDER BY hour ASC
      `);
      return rows.map(r => ({
        hour: String(r.hour).padStart(2, '0') + 'h',
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      }));
    } catch (error) {
      console.error('[CreditsManager] Failed to get hourly usage:', error);
    }
    return [];
  }

  /** Get usage by user email in BRL */
  private async getUserBrl(tenantId: string, rate: number): Promise<Array<{ userEmail: string; totalTokens: number; costBrl: number }>> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT
          user_email as userEmail,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} as costBrl
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
        GROUP BY user_email
        ORDER BY costBrl DESC
        LIMIT 20
      `);
      return rows.map(r => ({
        userEmail: String(r.userEmail),
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      }));
    } catch (error) {
      console.error('[CreditsManager] Failed to get user usage:', error);
    }
    return [];
  }

  /** Get full credits info for a tenant */
  async getCreditsInfo(tenantId: string): Promise<CreditsInfo> {
    const { contractedBrl, rate } = await this.getConfig(tenantId);

    const [usedBrl, daily, hourly, byUser] = await Promise.all([
      this.getUsedBrl(tenantId, rate),
      this.getDailyBrl(tenantId, rate, 7),
      this.getHourlyBrl(tenantId, rate),
      this.getUserBrl(tenantId, rate),
    ]);

    return {
      tenantId,
      currency: 'BRL',
      contractedBrl,
      usedBrl: Math.round(usedBrl * 100) / 100,
      availableBrl: Math.round((contractedBrl - usedBrl) * 100) / 100,
      exchangeRate: rate,
      daily,
      hourly,
      byUser,
    };
  }
}
