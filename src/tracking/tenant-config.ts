import { ClickHouseService } from '../clickhouse/client';

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export const AVAILABLE_MODELS = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Avançado',
    provider: 'Anthropic',
    description: 'Maior poder de análise e geração de insights. Ideal para análises complexas.',
    badge: 'Recomendado',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Básico',
    provider: 'Anthropic',
    description: 'Recomendado para ações simples, sem análises avançadas. Menor custo.',
    badge: 'Econômico',
  },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export class TenantConfigManager {
  constructor(private clickhouse: ClickHouseService) {}

  async ensureTable(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_config_tenant (
          tenant_id String,
          modelo_id String,
          atualizado_em DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(atualizado_em)
        ORDER BY tenant_id
      `);
    } catch (err) {
      console.warn('[TenantConfig] Failed to ensure table:', err);
    }
  }

  async getModel(tenantId: string): Promise<string> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT modelo_id
        FROM ia_config_tenant
        FINAL
        WHERE tenant_id = '${tenantId}'
        LIMIT 1
      `);
      return (rows[0]?.modelo_id as string) ?? DEFAULT_MODEL;
    } catch {
      return DEFAULT_MODEL;
    }
  }

  async setModel(tenantId: string, modelId: string): Promise<void> {
    // Validate model is in allowed list
    const allowed = AVAILABLE_MODELS.map(m => m.id);
    if (!allowed.includes(modelId as ModelId)) {
      throw new Error(`Modelo não permitido: ${modelId}`);
    }
    await this.clickhouse.execute(`
      INSERT INTO ia_config_tenant (tenant_id, modelo_id, atualizado_em)
      VALUES ('${tenantId}', '${modelId}', now())
    `);
  }

  async getConfig(tenantId: string): Promise<{ modelId: string; models: typeof AVAILABLE_MODELS }> {
    const modelId = await this.getModel(tenantId);
    return { modelId, models: AVAILABLE_MODELS };
  }
}
