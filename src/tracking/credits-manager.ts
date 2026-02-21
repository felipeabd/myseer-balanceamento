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

  /** Create ia_creditos_tenant table and add markup column if needed */
  async ensureTable(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_creditos_tenant (
          tenant_id String,
          contratado_brl Float64,
          taxa_usd_brl Float64,
          atualizado_em DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(atualizado_em)
        ORDER BY tenant_id
      `);
      // Add multiplicador_markup column if not yet present (safe to run multiple times)
      await this.clickhouse.execute(`
        ALTER TABLE ia_creditos_tenant
        ADD COLUMN IF NOT EXISTS multiplicador_markup Float64 DEFAULT ${DEFAULT_MARKUP}
      `);
      // Recharge history table — append-only, one row per recharge
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_recargas_creditos (
          tenant_id String,
          valor_brl Float64,
          recarregado_em DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (tenant_id, recarregado_em)
      `);
      console.log('[CreditsManager] Tables ia_creditos_tenant + ia_recargas_creditos ready');
      await this.migrateHistoricalRecharges();
    } catch (error) {
      console.error('[CreditsManager] Failed to ensure table:', error);
    }
  }

  /**
   * One-time migration: reads ia_creditos_tenant (all rows, no FINAL), computes
   * per-recharge deltas, and inserts into ia_recargas_creditos any rows
   * not yet present (matched by timestamp). Safe to call multiple times.
   */
  private async migrateHistoricalRecharges(): Promise<void> {
    try {
      const creditsRows = await this.clickhouse.rawQuery(`
        SELECT tenant_id, contratado_brl, toString(atualizado_em) as ts
        FROM ia_creditos_tenant
        ORDER BY tenant_id, atualizado_em ASC
      `);
      if (creditsRows.length === 0) return;

      const rechargesRows = await this.clickhouse.rawQuery(`
        SELECT toString(recarregado_em) as ts FROM ia_recargas_creditos
      `);
      const migratedTs = new Set((rechargesRows as any[]).map(r => String(r.ts)));

      // Group by tenant and compute deltas
      const byTenant = new Map<string, Array<{ contratado_brl: number; ts: string }>>();
      for (const row of creditsRows as any[]) {
        const tid = String(row.tenant_id);
        if (!byTenant.has(tid)) byTenant.set(tid, []);
        byTenant.get(tid)!.push({ contratado_brl: Number(row.contratado_brl), ts: String(row.ts) });
      }

      let migrated = 0;
      for (const [tenantId, rows] of byTenant) {
        for (let i = 0; i < rows.length; i++) {
          const { ts, contratado_brl } = rows[i];
          if (migratedTs.has(ts)) continue; // already in history table
          const prevBrl = i === 0 ? 0 : rows[i - 1].contratado_brl;
          const valorBrl = contratado_brl - prevBrl;
          await this.clickhouse.execute(`
            INSERT INTO ia_recargas_creditos (tenant_id, valor_brl, recarregado_em)
            VALUES ('${tenantId}', ${valorBrl}, '${ts}')
          `);
          migrated++;
        }
      }

      if (migrated > 0) {
        console.log(`[CreditsManager] Migrated ${migrated} historical recharge(s) → ia_recargas_creditos`);
      }
    } catch (error) {
      console.error('[CreditsManager] Failed to migrate historical recharges:', error);
    }
  }

  /** Get recharge history for a tenant from ia_recargas_creditos, filtered by month (YYYY-MM). */
  async getRecharges(tenantId: string, month?: string): Promise<RechargeRecord[]> {
    const monthFilter = month
      ? `AND toYYYYMM(recarregado_em) = ${month.replace('-', '')}`
      : '';
    const rows = await this.clickhouse.rawQuery(`
      SELECT
        rowNumberInAllBlocks() + 1 as id,
        valor_brl,
        toString(recarregado_em) as ts
      FROM ia_recargas_creditos
      WHERE tenant_id = '${tenantId}'
        ${monthFilter}
      ORDER BY recarregado_em DESC
    `);
    return (rows as any[]).map(r => ({
      id: Number(r.id),
      amountBrl: Number(r.valor_brl),
      rechargedAt: String(r.ts),
    }));
  }

  /** Get contracted credits config for a tenant */
  private async getConfig(tenantId: string): Promise<{ contractedBrl: number; rate: number; markup: number }> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT contratado_brl, taxa_usd_brl, multiplicador_markup
        FROM ia_creditos_tenant FINAL
        WHERE tenant_id = '${tenantId}'
        LIMIT 1
      `);
      if (rows.length > 0) {
        return {
          contractedBrl: Number(rows[0].contratado_brl) || 0,
          rate: Number(rows[0].taxa_usd_brl) || DEFAULT_EXCHANGE_RATE,
          markup: Number(rows[0].multiplicador_markup) || DEFAULT_MARKUP,
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
        SELECT SUM(custo_usd) as custo_total
        FROM ia_uso_tokens
        WHERE tenant_id = '${tenantId}'
      `);
      if (rows.length > 0 && rows[0].custo_total != null) {
        return Number(rows[0].custo_total) * rate * markup;
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
          toString(toDate(data_hora)) as data,
          sum(tokens_total) as totalTokens,
          sum(custo_usd) * ${rate} * ${markup} as costBrl
        FROM ia_uso_tokens
        WHERE tenant_id = '${tenantId}'
          AND toDate(data_hora) >= today() - INTERVAL ${days} DAY
        GROUP BY data
        ORDER BY data ASC
      `);
      return rows.map(r => ({
        date: String(r.data),
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
          toString(toHour(data_hora)) as hora,
          sum(tokens_total) as totalTokens,
          sum(custo_usd) * ${rate} * ${markup} as costBrl
        FROM ia_uso_tokens
        WHERE tenant_id = '${tenantId}'
        GROUP BY hora
        ORDER BY hora ASC
      `);
      return rows.map(r => ({
        hour: String(r.hora).padStart(2, '0') + 'h',
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
          email_usuario as emailUsuario,
          sum(tokens_total) as totalTokens,
          sum(custo_usd) * ${rate} * ${markup} as costBrl
        FROM ia_uso_tokens
        WHERE tenant_id = '${tenantId}'
        GROUP BY email_usuario
        ORDER BY costBrl DESC
        LIMIT 20
      `);
      return rows.map(r => ({
        userEmail: String(r.emailUsuario),
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

    const hourlyDateFilter = date ? `AND toDate(data_hora) = '${date}'` : '';
    const userFilter = userEmail ? `AND email_usuario = '${userEmail}'` : '';
    const byUserDateFilter = date ? `AND toDate(data_hora) = '${date}'` : '';
    const hourNum = hour ? parseInt(hour.replace('h', ''), 10) : null;
    const byUserHourFilter = hourNum !== null ? `AND toHour(data_hora) = ${hourNum}` : '';

    console.log('[CreditsManager] getCreditsDetail filters:', {
      tenantId, date, userEmail, hour,
      hourlyDateFilter, userFilter, byUserDateFilter, byUserHourFilter, hourNum,
    });

    const [hourlyRows, byUserRows] = await Promise.all([
      this.clickhouse.rawQuery(`
        SELECT
          toString(toHour(data_hora)) as hora,
          sum(tokens_total) as totalTokens,
          sum(custo_usd) * ${rate} * ${markup} as costBrl
        FROM ia_uso_tokens
        WHERE tenant_id = '${tenantId}'
          ${hourlyDateFilter}
          ${userFilter}
        GROUP BY hora
        ORDER BY hora ASC
      `),
      this.clickhouse.rawQuery(`
        SELECT
          email_usuario as emailUsuario,
          sum(tokens_total) as totalTokens,
          sum(custo_usd) * ${rate} * ${markup} as costBrl
        FROM ia_uso_tokens
        WHERE tenant_id = '${tenantId}'
          ${byUserDateFilter}
          ${byUserHourFilter}
        GROUP BY email_usuario
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
        hour: String(r.hora).padStart(2, '0') + 'h',
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      })),
      byUser: (byUserRows as any[]).map(r => ({
        userEmail: String(r.emailUsuario),
        totalTokens: Number(r.totalTokens),
        costBrl: Number(r.costBrl),
      })),
    };
  }

  /**
   * Add credits to a tenant. Reads current config and inserts new row
   * with contratado_brl += amountBrl, preserving rate and markup.
   */
  async addCredits(tenantId: string, amountBrl: number): Promise<void> {
    const { contractedBrl, rate, markup } = await this.getConfig(tenantId);
    const newTotal = contractedBrl + amountBrl;
    await Promise.all([
      this.clickhouse.execute(`
        INSERT INTO ia_creditos_tenant (tenant_id, contratado_brl, taxa_usd_brl, multiplicador_markup)
        VALUES ('${tenantId}', ${newTotal}, ${rate}, ${markup})
      `),
      this.clickhouse.execute(`
        INSERT INTO ia_recargas_creditos (tenant_id, valor_brl)
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
