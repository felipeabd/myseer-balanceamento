import { ClickHouseService } from '../clickhouse/client';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export interface RuleRecord {
  id: string;
  tenant: string;
  tipo: string;
  status: string;
  prioridade: number;
  alvo: string;
  condicao: string;
  acao: string;
  texto: string;
  criadoPor: string;
  criadoEm: string;
  vezesAplicada: number;
}

export interface RulesFilter {
  tenant?: string;
  tipo?: string;
  status?: string;
}

/**
 * Manages business rules in ia_regras_balanceamento for the Builder UI.
 * Provides list, toggle-status, and delete operations.
 */
export class RulesManager {
  constructor(private clickhouse: ClickHouseService) {}

  /**
   * List rules with optional filters.
   * If no tenant filter is given, returns all tenants.
   */
  async listRules(filter: RulesFilter = {}): Promise<RuleRecord[]> {
    const conditions: string[] = [];

    if (filter.tenant) {
      conditions.push(`tenant = '${esc(filter.tenant)}'`);
    }
    if (filter.tipo) {
      conditions.push(`tipo = '${esc(filter.tipo)}'`);
    }
    if (filter.status) {
      conditions.push(`status = '${esc(filter.status)}'`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.clickhouse.rawQuery(`
      SELECT
        id, tenant, tipo, status, prioridade,
        alvo, condicao, acao, texto,
        criado_por, criado_em, vezes_aplicada
      FROM ia_regras_balanceamento
      ${where}
      ORDER BY tenant ASC, prioridade ASC, criado_em ASC
      LIMIT 500
    `);

    return rows.map(r => ({
      id: r.id as string,
      tenant: r.tenant as string,
      tipo: r.tipo as string,
      status: r.status as string,
      prioridade: Number(r.prioridade),
      alvo: r.alvo as string,
      condicao: r.condicao as string,
      acao: r.acao as string,
      texto: r.texto as string,
      criadoPor: (r.criado_por as string) || '',
      criadoEm: String(r.criado_em),
      vezesAplicada: Number(r.vezes_aplicada) || 0,
    }));
  }

  /**
   * List unique tenants that have rules.
   */
  async listTenantsWithRules(): Promise<string[]> {
    const rows = await this.clickhouse.rawQuery(`
      SELECT DISTINCT tenant
      FROM ia_regras_balanceamento
      ORDER BY tenant ASC
    `);
    return rows.map(r => r.tenant as string);
  }

  /**
   * Toggle a rule's status between 'ativo' and 'inativo'.
   * Uses ClickHouse mutation (async on server, but fine for admin UI).
   */
  async toggleStatus(id: string, newStatus: 'ativo' | 'inativo'): Promise<void> {
    await this.clickhouse.execute(
      `ALTER TABLE ia_regras_balanceamento UPDATE status = '${newStatus}', atualizado_em = now() WHERE id = '${esc(id)}'`
    );
  }

  /**
   * Permanently delete a rule.
   */
  async deleteRule(id: string): Promise<void> {
    await this.clickhouse.execute(
      `ALTER TABLE ia_regras_balanceamento DELETE WHERE id = '${esc(id)}'`
    );
  }
}
