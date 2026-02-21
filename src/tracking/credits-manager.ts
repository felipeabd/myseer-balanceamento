import { ClickHouseService } from '../clickhouse/client';

export interface CreditsInfo {
  tenantId: string;
  currency: 'BRL';
  contractedBrl: number;
  usedBrl: number;
  availableBrl: number;
  exchangeRate: number;
  markup: number;
  daily: Array<{ date: string; totalTokens: number; costBrl: number }>;
  hourly: Array<{ hour: string; totalTokens: number; costBrl: number }>;
  byUser: Array<{ userEmail: string; totalTokens: number; costBrl: number }>;
}

export interface RechargeRecord {
  id: number;
  amountBrl: number;
  rechargedAt: string; // ISO datetime string
}

const DEFAULT_EXCHANGE_RATE = 5.8;
const DEFAULT_MARKUP = 1.8; // 80% a mais sobre o custo real

export class CreditsManager {
  private clickhouse: ClickHouseService;

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
  }

  /** Create ia_tenant_credits table and add markup column if needed */
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
      // Add markup_multiplier column if not yet present (safe to run multiple times)
      await this.clickhouse.execute(`
        ALTER TABLE ia_tenant_credits
        ADD COLUMN IF NOT EXISTS markup_multiplier Float64 DEFAULT ${DEFAULT_MARKUP}
      `);
      // Recharge history table — append-only, one row per recharge
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_tenant_credits_recharges (
          tenant_id String,
          amount_brl Float64,
          recharged_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (tenant_id, recharged_at)
      `);
      console.log('[CreditsManager] Tables ia_tenant_credits + ia_tenant_credits_recharges ready');
      await this.migrateHistoricalRecharges();
    } catch (error) {
      console.error('[CreditsManager] Failed to ensure table:', error);
    }
  }

  /**
   * One-time migration: reads ia_tenant_credits (all rows, no FINAL), computes
   * per-recharge deltas, and inserts into ia_tenant_credits_recharges any rows
   * not yet present (matched by timestamp). Safe to call multiple times.
   */
  private async migrateHistoricalRecharges(): Promise<void> {
    try {
      const creditsRows = await this.clickhouse.rawQuery(`
        SELECT tenant_id, contracted_brl, toString(updated_at) as ts
        FROM ia_tenant_credits
        ORDER BY tenant_id, updated_at ASC
      `);
      if (creditsRows.length === 0) return;

      const rechargesRows = await this.clickhouse.rawQuery(`
        SELECT toString(recharged_at) as ts FROM ia_tenant_credits_recharges
      `);
      const migratedTs = new Set((rechargesRows as any[]).map(r => String(r.ts)));

      // Group by tenant and compute deltas
      const byTenant = new Map<string, Array<{ contracted_brl: number; ts: string }>>();
      for (const row of creditsRows as any[]) {
        const tid = String(row.tenant_id);
        if (!byTenant.has(tid)) byTenant.set(tid, []);
        byTenant.get(tid)!.push({ contracted_brl: Number(row.contracted_brl), ts: String(row.ts) });
      }

      let migrated = 0;
      for (const [tenantId, rows] of byTenant) {
        for (let i = 0; i < rows.length; i++) {
          const { ts, contracted_brl } = rows[i];
          if (migratedTs.has(ts)) continue; // already in history table
          const prevBrl = i === 0 ? 0 : rows[i - 1].contracted_brl;
          const amountBrl = contracted_brl - prevBrl;
          await this.clickhouse.execute(`
            INSERT INTO ia_tenant_credits_recharges (tenant_id, amount_brl, recharged_at)
            VALUES ('${tenantId}', ${amountBrl}, '${ts}')
          `);
          migrated++;
        }
      }

      if (migrated > 0) {
        console.log(`[CreditsManager] Migrated ${migrated} historical recharge(s) → ia_tenant_credits_recharges`);
      }
    } catch (error) {
      console.error('[CreditsManager] Failed to migrate historical recharges:', error);
    }
  }

  /** Get recharge history for a tenant from ia_tenant_credits_recharges, filtered by month (YYYY-MM). */
  async getRecharges(tenantId: string, month?: string): Promise<RechargeRecord[]> {
    const monthFilter = month
      ? `AND toYYYYMM(recharged_at) = ${month.replace('-', '')}`
      : '';
    const rows = await this.clickhouse.rawQuery(`
      SELECT
        rowNumberInAllBlocks() + 1 as id,
        amount_brl,
        toString(recharged_at) as ts
      FROM ia_tenant_credits_recharges
      WHERE tenant_id = '${tenantId}'
        ${monthFilter}
      ORDER BY recharged_at DESC
    `);
    return (rows as any[]).map(r => ({
      id: Number(r.id),
      amountBrl: Number(r.amount_brl),
      rechargedAt: String(r.ts),
    }));
  }

  /** Get contracted credits config for a tenant */
  private async getConfig(tenantId: string): Promise<{ contractedBrl: number; rate: number; markup: number }> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT contracted_brl, usd_to_brl_rate, markup_multiplier
        FROM ia_tenant_credits FINAL
        WHERE tenant_id = '${tenantId}'
        LIMIT 1
      `);
      if (rows.length > 0) {
        return {
          contractedBrl: Number(rows[0].contracted_brl) || 0,
          rate: Number(rows[0].usd_to_brl_rate) || DEFAULT_EXCHANGE_RATE,
          markup: Number(rows[0].markup_multiplier) || DEFAULT_MARKUP,
        };
      }
    } catch (error) {
      console.error('[CreditsManager] Failed to get credits config:', error);
    }
    return { contractedBrl: 0, rate: DEFAULT_EXCHANGE_RATE, markup: DEFAULT_MARKUP };
  }

  /** Get total used credits in BRL (com markup) */
  private async getUsedBrl(tenantId: string, rate: number, markup: number): Promise<number> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT SUM(cost_usd) as total_cost
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
      `);
      if (rows.length > 0 && rows[0].total_cost != null) {
        return Number(rows[0].total_cost) * rate * markup;
      }
    } catch (error) {
      console.error('[CreditsManager] Failed to get used credits:', error);
    }
    return 0;
  }

  /** Get daily usage for the last N days in BRL (com markup) */
  private async getDailyBrl(tenantId: string, rate: number, markup: number, days = 7): Promise<Array<{ date: string; totalTokens: number; costBrl: number }>> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT
          toString(toDate(timestamp)) as date,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} * ${markup} as costBrl
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

  /** Get hourly usage distribution (all time) in BRL (com markup) */
  private async getHourlyBrl(tenantId: string, rate: number, markup: number): Promise<Array<{ hour: string; totalTokens: number; costBrl: number }>> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT
          toString(toHour(timestamp)) as hour,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} * ${markup} as costBrl
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
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

  /** Get usage by user email in BRL (com markup) */
  private async getUserBrl(tenantId: string, rate: number, markup: number): Promise<Array<{ userEmail: string; totalTokens: number; costBrl: number }>> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT
          user_email as userEmail,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} * ${markup} as costBrl
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

  /**
   * Get filtered hourly + byUser breakdown for drill-down interactions (com markup).
   * - date: filter to a specific day (YYYY-MM-DD).
   * - userEmail: filter hourly to a specific user.
   * - hour: e.g. "10h" — filters byUser to that hour.
   */
  async getCreditsDetail(
    tenantId: string,
    date?: string,
    userEmail?: string,
    hour?: string,
  ): Promise<{
    hourly: Array<{ hour: string; totalTokens: number; costBrl: number }>;
    byUser: Array<{ userEmail: string; totalTokens: number; costBrl: number }>;
  }> {
    const { rate, markup } = await this.getConfig(tenantId);

    const hourlyDateFilter = date ? `AND toDate(timestamp) = '${date}'` : '';
    const userFilter = userEmail ? `AND user_email = '${userEmail}'` : '';
    const byUserDateFilter = date ? `AND toDate(timestamp) = '${date}'` : '';
    const hourNum = hour ? parseInt(hour.replace('h', ''), 10) : null;
    const byUserHourFilter = hourNum !== null ? `AND toHour(timestamp) = ${hourNum}` : '';

    console.log('[CreditsManager] getCreditsDetail filters:', {
      tenantId, date, userEmail, hour,
      hourlyDateFilter, userFilter, byUserDateFilter, byUserHourFilter, hourNum,
    });

    const [hourlyRows, byUserRows] = await Promise.all([
      this.clickhouse.rawQuery(`
        SELECT
          toString(toHour(timestamp)) as hour,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} * ${markup} as costBrl
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
          ${hourlyDateFilter}
          ${userFilter}
        GROUP BY hour
        ORDER BY hour ASC
      `),
      this.clickhouse.rawQuery(`
        SELECT
          user_email as userEmail,
          sum(total_tokens) as totalTokens,
          sum(cost_usd) * ${rate} * ${markup} as costBrl
        FROM ia_usage_tokens
        WHERE tenant_id = '${tenantId}'
          ${byUserDateFilter}
          ${byUserHourFilter}
        GROUP BY user_email
        ORDER BY costBrl DESC
        LIMIT 20
      `),
    ]);

    console.log('[CreditsManager] getCreditsDetail results:', {
      hourlyCount: hourlyRows.length,
      byUserCount: byUserRows.length,
      byUserRows,
    });

    return {
      hourly: hourlyRows.map((r: any) => ({
        hour: String(r.hour).padStart(2, '0') + 'h',
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      })),
      byUser: (byUserRows as any[]).map(r => ({
        userEmail: String(r.userEmail),
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      })),
    };
  }

  /**
   * Add credits to a tenant. Reads current config and inserts new row
   * with contracted_brl += amountBrl, preserving rate and markup.
   */
  async addCredits(tenantId: string, amountBrl: number): Promise<void> {
    const { contractedBrl, rate, markup } = await this.getConfig(tenantId);
    const newTotal = contractedBrl + amountBrl;
    await Promise.all([
      this.clickhouse.execute(`
        INSERT INTO ia_tenant_credits (tenant_id, contracted_brl, usd_to_brl_rate, markup_multiplier)
        VALUES ('${tenantId}', ${newTotal}, ${rate}, ${markup})
      `),
      this.clickhouse.execute(`
        INSERT INTO ia_tenant_credits_recharges (tenant_id, amount_brl)
        VALUES ('${tenantId}', ${amountBrl})
      `),
    ]);
    console.log(`[CreditsManager] Credits added: +R$${amountBrl} → total R$${newTotal} (tenant: ${tenantId})`);
  }

  /** Get full credits info for a tenant */
  async getCreditsInfo(tenantId: string): Promise<CreditsInfo> {
    const { contractedBrl, rate, markup } = await this.getConfig(tenantId);

    const [usedBrl, daily, hourly, byUser] = await Promise.all([
      this.getUsedBrl(tenantId, rate, markup),
      this.getDailyBrl(tenantId, rate, markup, 7),
      this.getHourlyBrl(tenantId, rate, markup),
      this.getUserBrl(tenantId, rate, markup),
    ]);

    return {
      tenantId,
      currency: 'BRL',
      contractedBrl,
      usedBrl: Math.round(usedBrl * 100) / 100,
      availableBrl: Math.round((contractedBrl - usedBrl) * 100) / 100,
      exchangeRate: rate,
      markup,
      daily,
      hourly,
      byUser,
    };
  }
}
