import 'dotenv/config';
import { ClickHouseService } from '../src/clickhouse/client';

async function setupRulesSystem() {
  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  try {
    console.log('🔧 Setting up Rules System tables...\n');

    // 1. Tabela de controle de sessões
    console.log('📋 Creating ia_sessoes_regras...');
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS ia_sessoes_regras (
        conversation_id String,
        tenant_id String,
        user_email String,
        agent_mode LowCardinality(String),
        status UInt8,
        started_at DateTime,
        ended_at DateTime,
        last_activity DateTime DEFAULT now(),
        date Date DEFAULT toDate(started_at)
      ) ENGINE = ReplacingMergeTree(last_activity)
      PARTITION BY toYYYYMM(date)
      ORDER BY (conversation_id, tenant_id)
    `;
    await clickhouse.execute(createSessionsTable);
    console.log('✅ ia_sessoes_regras created\n');

    // 2. Tabela de regras de balanceamento
    console.log('📋 Creating ia_regras_balanceamento...');
    const createRulesTable = `
      CREATE TABLE IF NOT EXISTS ia_regras_balanceamento (
        id String DEFAULT generateUUIDv4(),
        tenant String,
        escopo LowCardinality(String) DEFAULT 'balanceamento',
        tipo LowCardinality(String),
        status LowCardinality(String) DEFAULT 'ativo',
        prioridade Int32,
        alvo String,
        condicao String,
        acao String,
        texto String,
        criado_por String,
        criado_em DateTime DEFAULT now(),
        atualizado_em DateTime DEFAULT now(),
        vezes_aplicada UInt32 DEFAULT 0,
        ultima_aplicacao DateTime,
        date Date DEFAULT toDate(criado_em)
      ) ENGINE = MergeTree()
      PARTITION BY (toYYYYMM(date), tenant)
      ORDER BY (tenant, status, prioridade, criado_em)
    `;
    await clickhouse.execute(createRulesTable);
    console.log('✅ ia_regras_balanceamento created\n');

    console.log('🎉 Rules System setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up Rules System:', error);
    throw error;
  } finally {
    await clickhouse.close();
  }
}

setupRulesSystem();
