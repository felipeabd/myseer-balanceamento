import { ClickHouseService } from '../clickhouse/client';

export interface Rule {
  id: string;
  tipo: string;
  prioridade: number;
  alvo: string;
  condicao: string;
  acao: string;
  texto: string;
}

export class LoadRulesSkill {
  constructor(private clickhouse: ClickHouseService) {}

  /**
   * Carrega regras ativas do tenant + regras globais
   * e retorna formatado para injeção no prompt
   */
  async execute(tenantId: string): Promise<string> {
    const query = `
      SELECT
        id,
        tipo,
        prioridade,
        alvo,
        condicao,
        acao,
        texto
      FROM ia_regras_balanceamento
      WHERE status = 'ativo'
        AND (tenant = '${tenantId}' OR tenant = 'null')
      ORDER BY prioridade ASC, criado_em ASC
      LIMIT 100
    `;

    const rows = await this.clickhouse.query(query, {
      tenantId,
      userEmail: '',
    });

    if (rows.length === 0) {
      return '';
    }

    const rules = rows as Rule[];

    const regrasFormatadas = rules
      .map((r, idx) => {
        return `
${idx + 1}. [${r.tipo.toUpperCase()}] ${r.texto}
   Prioridade: ${r.prioridade}
   Alvo: ${r.alvo}
   Condição: ${r.condicao}
   Ação: ${r.acao}`;
      })
      .join('\n');

    return `

## 📜 REGRAS DE BALANCEAMENTO ATIVAS (${rules.length})

Você DEVE respeitar RIGOROSAMENTE estas regras ao sugerir transferências:

${regrasFormatadas}

IMPORTANTE:
- Regras com prioridade MENOR são MAIS IMPORTANTES
- Se houver conflito entre regras, prevaleça a de menor prioridade
- Se uma sugestão violar uma regra, você DEVE:
  1. NÃO fazer a sugestão
  2. Explicar qual regra impediu a sugestão
  3. Propor alternativa que respeite as regras
- Ao aplicar uma regra, cite sempre o número da regra na sua resposta
`;
  }

  /**
   * Retorna as regras como array de objetos (para uso programático)
   */
  async getRules(tenantId: string): Promise<Rule[]> {
    const query = `
      SELECT
        id,
        tipo,
        prioridade,
        alvo,
        condicao,
        acao,
        texto
      FROM ia_regras_balanceamento
      WHERE status = 'ativo'
        AND (tenant = '${tenantId}' OR tenant = 'null')
      ORDER BY prioridade ASC, criado_em ASC
      LIMIT 100
    `;

    const rows = await this.clickhouse.query(query, {
      tenantId,
      userEmail: '',
    });

    return rows as Rule[];
  }
}
