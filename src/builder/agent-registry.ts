import { ClickHouseService } from '../clickhouse/client';
import { AgentDefinition, AgentInfo, AgentTableConfig, AgentSkills, StarterPrompt, AgentPromptSections } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Parses a ClickHouse row into an AgentDefinition */
function rowToAgent(row: Record<string, unknown>): AgentDefinition {
  return {
    id: row.id as string,
    slug: row.slug as string,
    nome: row.nome as string,
    descricao: (row.descricao as string) || '',
    icone: (row.icone as string) || '',
    cor: (row.cor as string) || '#28B8CE',
    saudacao: (row.saudacao as string) || '',
    placeholderInput: (row.placeholder_input as string) || '',

    prompt: {
      personalidade: (row.prompt_personalidade as string) || '',
      tom: (row.prompt_tom as string) || '',
      restricoes: (row.prompt_restricoes as string) || '',
      exemplos: (row.prompt_exemplos as string) || '',
      fluxo: (row.prompt_fluxo as string) || '',
    },

    tabelas: safeJsonParse<AgentTableConfig[]>(row.tabelas as string, []),
    skills: safeJsonParse<AgentSkills>(row.habilidades as string, {
      consulta_sql: true,
      gerar_csv: true,
      knowledge_base: false,
      otimizador: false,
    }),
    regraAnalise: (row.regras_analise as string) || '',
    conhecimento: (row.conhecimento as string) || '',
    perguntasRapidas: safeJsonParse<StarterPrompt[]>(row.perguntas_rapidas as string, []),

    modeloPadrao: (row.modelo_padrao as string) || 'claude-haiku-4-5-20251001',
    maxTokens: Number(row.max_tokens) || 4096,
    temperature: Number(row.temperatura) || 0.2,
    maxToolCalls: Number(row.max_chamadas_ferramentas) || 3,

    status: (row.status as AgentDefinition['status']) || 'rascunho',
    custoMensalBrl: Number(row.custo_mensal_brl) || 0,
    criadoPor: (row.criado_por as string) || '',
    versao: Number(row.versao) || 1,
    ordem: Number(row.ordem) || 999,
  };
}

/** Converts AgentDefinition to the consumer-facing AgentInfo */
function agentToInfo(agent: AgentDefinition, habilitado: boolean): AgentInfo {
  return {
    id: agent.id,
    slug: agent.slug,
    nome: agent.nome,
    descricao: agent.descricao,
    icone: agent.icone,
    cor: agent.cor,
    saudacao: agent.saudacao,
    placeholderInput: agent.placeholderInput,
    perguntasRapidas: agent.perguntasRapidas,
    habilitado,
  };
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class AgentRegistry {
  constructor(private clickhouse: ClickHouseService) {}

  // ── Read Operations ──────────────────────────────────────

  /** List all published agents */
  async getPublishedAgents(): Promise<AgentDefinition[]> {
    const rows = await this.clickhouse.rawQuery(
      `SELECT * FROM ia_agentes FINAL WHERE status = 'publicado' ORDER BY ordem ASC`
    );
    return rows.map(rowToAgent);
  }

  /** List all agents (any status) — for Builder */
  async getAllAgents(): Promise<AgentDefinition[]> {
    const rows = await this.clickhouse.rawQuery(
      `SELECT * FROM ia_agentes FINAL ORDER BY ordem ASC`
    );
    return rows.map(rowToAgent);
  }

  /** Get a single agent by slug */
  async getAgentBySlug(slug: string): Promise<AgentDefinition | null> {
    const rows = await this.clickhouse.rawQuery(
      `SELECT * FROM ia_agentes FINAL WHERE slug = '${escapeStr(slug)}' LIMIT 1`
    );
    return rows.length > 0 ? rowToAgent(rows[0]) : null;
  }

  /** Get a single agent by ID */
  async getAgentById(id: string): Promise<AgentDefinition | null> {
    const rows = await this.clickhouse.rawQuery(
      `SELECT * FROM ia_agentes FINAL WHERE id = '${escapeStr(id)}' LIMIT 1`
    );
    return rows.length > 0 ? rowToAgent(rows[0]) : null;
  }

  /** Get agents available for a tenant (published + testando for "Em breve") */
  async getTenantAgents(tenantId: string): Promise<AgentInfo[]> {
    const rows = await this.clickhouse.rawQuery(
      `SELECT * FROM ia_agentes FINAL WHERE status IN ('publicado', 'testando') ORDER BY ordem ASC`
    );
    const agents = rows.map(rowToAgent);

    // Get tenant-specific enablements
    const enabledRows = await this.clickhouse.rawQuery(
      `SELECT agent_id, habilitado
       FROM ia_tenant_agentes FINAL
       WHERE tenant_id = '${escapeStr(tenantId)}'`
    );
    const enabledMap = new Map<string, boolean>();
    for (const row of enabledRows) {
      enabledMap.set(row.agent_id as string, Number(row.habilitado) === 1);
    }

    return agents.map(agent => {
      if (agent.status === 'testando') {
        return agentToInfo(agent, false);
      }
      const habilitado = enabledMap.has(agent.id)
        ? enabledMap.get(agent.id)!
        : true;
      return agentToInfo(agent, habilitado);
    });
  }

  // ── Write Operations (Builder) ───────────────────────────

  /** Create a new agent */
  async createAgent(data: Partial<AgentDefinition> & { slug: string; nome: string; criadoPor: string }): Promise<AgentDefinition> {
    const id = uuidv4();

    const prompt: AgentPromptSections = data.prompt ?? { personalidade: '', tom: '', restricoes: '', exemplos: '', fluxo: '' };
    const skills: AgentSkills = data.skills ?? { consulta_sql: true, gerar_csv: true, knowledge_base: false, otimizador: false };
    const tabelas = data.tabelas ?? [];
    const perguntasRapidas = data.perguntasRapidas ?? [];

    await this.clickhouse.execute(`
      INSERT INTO ia_agentes (
        id, slug, nome, descricao, icone, cor, saudacao, placeholder_input,
        prompt_personalidade, prompt_tom, prompt_restricoes, prompt_exemplos, prompt_fluxo,
        tabelas, habilidades, regras_analise, conhecimento, perguntas_rapidas,
        modelo_padrao, max_tokens, temperatura, max_chamadas_ferramentas,
        status, custo_mensal_brl, criado_por, versao, ordem
      ) VALUES (
        '${id}',
        '${escapeStr(data.slug)}',
        '${escapeStr(data.nome)}',
        '${escapeStr(data.descricao ?? '')}',
        '${escapeStr(data.icone ?? '')}',
        '${escapeStr(data.cor ?? '#28B8CE')}',
        '${escapeStr(data.saudacao ?? '')}',
        '${escapeStr(data.placeholderInput ?? '')}',
        '${escapeStr(prompt.personalidade)}',
        '${escapeStr(prompt.tom)}',
        '${escapeStr(prompt.restricoes)}',
        '${escapeStr(prompt.exemplos)}',
        '${escapeStr(prompt.fluxo)}',
        '${escapeStr(JSON.stringify(tabelas))}',
        '${escapeStr(JSON.stringify(skills))}',
        '${escapeStr(data.regraAnalise ?? '')}',
        '${escapeStr(data.conhecimento ?? '')}',
        '${escapeStr(JSON.stringify(perguntasRapidas))}',
        '${escapeStr(data.modeloPadrao ?? 'claude-haiku-4-5-20251001')}',
        ${data.maxTokens ?? 4096},
        ${data.temperature ?? 0.2},
        ${data.maxToolCalls ?? 3},
        '${escapeStr(data.status ?? 'rascunho')}',
        ${data.custoMensalBrl ?? 0},
        '${escapeStr(data.criadoPor)}',
        1,
        ${data.ordem ?? 999}
      )
    `);

    return (await this.getAgentById(id))!;
  }

  /** Update an existing agent (ReplacingMergeTree: insert new row with same id) */
  async updateAgent(id: string, data: Partial<AgentDefinition>): Promise<AgentDefinition | null> {
    const existing = await this.getAgentById(id);
    if (!existing) return null;

    const merged = { ...existing, ...data };
    const prompt = data.prompt ? { ...existing.prompt, ...data.prompt } : existing.prompt;

    await this.clickhouse.execute(`
      INSERT INTO ia_agentes (
        id, slug, nome, descricao, icone, cor, saudacao, placeholder_input,
        prompt_personalidade, prompt_tom, prompt_restricoes, prompt_exemplos, prompt_fluxo,
        tabelas, habilidades, regras_analise, conhecimento, perguntas_rapidas,
        modelo_padrao, max_tokens, temperatura, max_chamadas_ferramentas,
        status, custo_mensal_brl, criado_por, versao, ordem, atualizado_em
      ) VALUES (
        '${id}',
        '${escapeStr(merged.slug)}',
        '${escapeStr(merged.nome)}',
        '${escapeStr(merged.descricao)}',
        '${escapeStr(merged.icone)}',
        '${escapeStr(merged.cor)}',
        '${escapeStr(merged.saudacao)}',
        '${escapeStr(merged.placeholderInput)}',
        '${escapeStr(prompt.personalidade)}',
        '${escapeStr(prompt.tom)}',
        '${escapeStr(prompt.restricoes)}',
        '${escapeStr(prompt.exemplos)}',
        '${escapeStr(prompt.fluxo)}',
        '${escapeStr(JSON.stringify(merged.tabelas))}',
        '${escapeStr(JSON.stringify(merged.skills))}',
        '${escapeStr(merged.regraAnalise)}',
        '${escapeStr(merged.conhecimento)}',
        '${escapeStr(JSON.stringify(merged.perguntasRapidas))}',
        '${escapeStr(merged.modeloPadrao)}',
        ${merged.maxTokens},
        ${merged.temperature},
        ${merged.maxToolCalls},
        '${escapeStr(merged.status)}',
        ${merged.custoMensalBrl},
        '${escapeStr(merged.criadoPor)}',
        ${merged.versao + 1},
        ${merged.ordem},
        now()
      )
    `);

    return this.getAgentById(id);
  }

  /** Change agent status to 'publicado' */
  async publishAgent(id: string): Promise<AgentDefinition | null> {
    return this.updateAgent(id, { status: 'publicado' });
  }

  /** Change agent status back to 'testando' */
  async unpublishAgent(id: string): Promise<AgentDefinition | null> {
    return this.updateAgent(id, { status: 'testando' });
  }

  /** Enable/disable an agent for a tenant */
  async setTenantAgent(tenantId: string, agentId: string, habilitado: boolean): Promise<void> {
    await this.clickhouse.execute(`
      INSERT INTO ia_tenant_agentes (tenant_id, agent_id, habilitado)
      VALUES ('${escapeStr(tenantId)}', '${escapeStr(agentId)}', ${habilitado ? 1 : 0})
    `);
  }

  // ── Schema Introspection (Builder) ───────────────────────

  /** List available ClickHouse tables (ia_* tables) */
  async listTables(): Promise<Array<{ name: string; engine: string; totalRows: string }>> {
    const rows = await this.clickhouse.rawQuery(
      `SELECT name, engine, total_rows
       FROM system.tables
       WHERE database = currentDatabase()
         AND name LIKE 'ia_%'
       ORDER BY name ASC`
    );
    return rows.map(r => ({
      name: r.name as string,
      engine: r.engine as string,
      totalRows: String(r.total_rows ?? '0'),
    }));
  }

  /** Describe columns of a table */
  async describeTable(tableName: string): Promise<Array<{ name: string; type: string; comment: string }>> {
    // Safety: only allow ia_ prefixed tables
    if (!tableName.startsWith('ia_')) {
      throw new Error('Only ia_ tables can be described');
    }

    const rows = await this.clickhouse.rawQuery(
      `SELECT name, type, comment
       FROM system.columns
       WHERE database = currentDatabase()
         AND table = '${escapeStr(tableName)}'
       ORDER BY position ASC`
    );
    return rows.map(r => ({
      name: r.name as string,
      type: r.type as string,
      comment: (r.comment as string) || '',
    }));
  }

  // ── Table Setup ──────────────────────────────────────────

  /** Create the ia_agentes and ia_tenant_agentes tables if they don't exist */
  async ensureTables(): Promise<void> {
    await this.clickhouse.execute(`
      CREATE TABLE IF NOT EXISTS ia_agentes (
        id UUID DEFAULT generateUUIDv4(),
        slug String,
        nome String,
        descricao String DEFAULT '',
        icone String DEFAULT '',
        cor String DEFAULT '#28B8CE',
        saudacao String DEFAULT '',
        placeholder_input String DEFAULT '',
        prompt_personalidade String DEFAULT '',
        prompt_tom String DEFAULT '',
        prompt_restricoes String DEFAULT '',
        prompt_exemplos String DEFAULT '',
        prompt_fluxo String DEFAULT '',
        tabelas String DEFAULT '[]',
        habilidades String DEFAULT '{"consulta_sql":true,"gerar_csv":true,"knowledge_base":false,"otimizador":false}',
        regras_analise String DEFAULT '',
        conhecimento String DEFAULT '',
        perguntas_rapidas String DEFAULT '[]',
        modelo_padrao String DEFAULT 'claude-haiku-4-5-20251001',
        max_tokens UInt32 DEFAULT 4096,
        temperatura Float32 DEFAULT 0.2,
        max_chamadas_ferramentas UInt8 DEFAULT 3,
        status LowCardinality(String) DEFAULT 'rascunho',
        custo_mensal_brl Float64 DEFAULT 0,
        criado_por String DEFAULT '',
        versao UInt32 DEFAULT 1,
        ordem UInt32 DEFAULT 999,
        criado_em DateTime DEFAULT now(),
        atualizado_em DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(atualizado_em)
      ORDER BY (id)
    `);

    // Migrations: add columns if table was created before these fields existed
    await this.clickhouse.execute(`ALTER TABLE ia_agentes ADD COLUMN IF NOT EXISTS ordem UInt32 DEFAULT 999`);
    await this.clickhouse.execute(`ALTER TABLE ia_agentes ADD COLUMN IF NOT EXISTS conhecimento String DEFAULT ''`);

    await this.clickhouse.execute(`
      CREATE TABLE IF NOT EXISTS ia_tenant_agentes (
        tenant_id String,
        agent_id UUID,
        habilitado UInt8 DEFAULT 1,
        habilitado_em DateTime DEFAULT now(),
        atualizado_em DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(atualizado_em)
      ORDER BY (tenant_id, agent_id)
    `);
  }
}
