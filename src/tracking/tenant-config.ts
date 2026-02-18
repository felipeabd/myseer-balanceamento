import { ClickHouseService } from '../clickhouse/client';

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export const AVAILABLE_MODELS = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: 'Melhor qualidade de raciocínio. Recomendado para análises complexas.',
    badge: 'Recomendado',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    description: 'Mais rápido e econômico. Ideal para consultas simples e rotineiras.',
    badge: 'Econômico',
  },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export class TenantConfigManager {
  constructor(private clickhouse: ClickHouseService) {}

  async ensureTable(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_tenant_config (
          tenant_id String,
          model_id  String,
          updated_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY tenant_id
      `);
    } catch (err) {
      console.warn('[TenantConfig] Failed to ensure table:', err);
    }
  }

  async getModel(tenantId: string): Promise<string> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT model_id
        FROM ia_tenant_config
        FINAL
        WHERE tenant_id = '${tenantId}'
        LIMIT 1
      `);
      return (rows[0]?.model_id as string) ?? DEFAULT_MODEL;
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
      INSERT INTO ia_tenant_config (tenant_id, model_id, updated_at)
      VALUES ('${tenantId}', '${modelId}', now())
    `);
  }

  async getConfig(tenantId: string): Promise<{ modelId: string; models: typeof AVAILABLE_MODELS }> {
    const modelId = await this.getModel(tenantId);
    return { modelId, models: AVAILABLE_MODELS };
  }
}
