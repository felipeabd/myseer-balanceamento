import { createClient, ClickHouseClient } from '@clickhouse/client';
import { IrisConfig, TenantContext } from '../types';

export class ClickHouseService {
  private client: ClickHouseClient;
  private database: string;

  constructor(config: IrisConfig['clickhouse']) {
    this.database = config.database ?? 'default';
    this.client = createClient({
      url: config.url,
      database: this.database,
      username: config.username ?? 'default',
      password: config.password ?? '',
      request_timeout: 30_000,
    });
  }

  /**
   * Execute a raw DDL/DML command (CREATE, INSERT, etc).
   * This method does NOT require tenant filtering.
   */
  async execute(sql: string): Promise<void> {
    await this.client.exec({ query: sql });
  }

  /**
   * Execute a raw SELECT query scoped to the tenant.
   * The query MUST already include the tenant filter — this method
   * is a safety net that validates the query contains the tenant clause.
   */
  async query(sql: string, tenant: TenantContext): Promise<Record<string, unknown>[]> {
    // Safety: reject anything that isn't a SELECT
    const normalized = sql.trim().toUpperCase();
    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Safety: ensure tenant filter is present
    if (!sql.includes(tenant.tenantId)) {
      throw new Error('Query must include tenant filter');
    }

    const result = await this.client.query({ query: sql, format: 'JSONEachRow' });
    const rows = await result.json<Record<string, unknown>>();
    return rows as Record<string, unknown>[];
  }

  /** Get the most recent data load date for this tenant */
  async getLastLoadDate(tenant: TenantContext): Promise<string | null> {
    const rows = await this.query(
      `SELECT MAX(dtcarga) as ultima_carga
       FROM ${this.database}.ia_fato_balanceamento
       WHERE tenant = '${tenant.tenantId}'
         AND filialdeposito <> 1`,
      tenant
    );
    if (rows.length === 0) return null;
    return rows[0].ultima_carga as string;
  }

  /** Discover products with balancing opportunities (top N) */
  async discoverOpportunities(
    tenant: TenantContext,
    dtcarga: string,
    limit: number = 10
  ): Promise<Record<string, unknown>[]> {
    return this.query(
      `SELECT
         cdprod,
         any(descricao) as descricao,
         any(nomefabricante) as fabricante,
         any(curva) as curva,
         SUM(qtexcesso) as total_excesso,
         SUM(qtnecessidade) as total_necessidade,
         COUNT(DISTINCT CASE WHEN qtexcesso > 0 THEN cdFilial END) as lojas_doadoras,
         COUNT(DISTINCT CASE WHEN qtnecessidade > 0 THEN cdFilial END) as lojas_receptoras,
         AVG(cobertura) as cobertura_media,
         SUM(qtexcesso * vlrcusto) as capital_imobilizado_excesso
       FROM ${this.database}.ia_fato_balanceamento
       WHERE tenant = '${tenant.tenantId}'
         AND dtcarga = '${dtcarga}'
         AND filialdeposito <> 1
         AND (qtexcesso > 0 OR qtnecessidade > 0)
       GROUP BY cdprod
       HAVING total_excesso > 0 AND total_necessidade > 0
       ORDER BY capital_imobilizado_excesso DESC
       LIMIT ${limit}`,
      tenant
    );
  }

  /** Get detail per store for a specific product */
  async getProductDetail(
    tenant: TenantContext,
    dtcarga: string,
    cdprod: number
  ): Promise<Record<string, unknown>[]> {
    return this.query(
      `SELECT
         cdprod,
         cdFilial,
         descricao,
         curva,
         nomefabricante,
         qtnecessidade,
         qtexcesso,
         qtestoque,
         cobertura,
         mediaf_un,
         vlrcusto,
         dias_parado,
         dias_falta
       FROM ${this.database}.ia_fato_balanceamento
       WHERE tenant = '${tenant.tenantId}'
         AND dtcarga = '${dtcarga}'
         AND cdprod = ${cdprod}
         AND filialdeposito <> 1
       ORDER BY cobertura ASC`,
      tenant
    );
  }

  /**
   * Execute a raw SELECT query without tenant filtering.
   * Use only for internal/admin queries (e.g. listing rules).
   */
  async rawQuery(sql: string): Promise<Record<string, unknown>[]> {
    const result = await this.client.query({ query: sql, format: 'JSONEachRow' });
    return await result.json<Record<string, unknown>>() as Record<string, unknown>[];
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
