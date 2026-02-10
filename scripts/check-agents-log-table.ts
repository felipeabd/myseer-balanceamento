import 'dotenv/config';
import { ClickHouseService } from '../src/clickhouse/client';

async function checkTable() {
  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  try {
    console.log('🔍 Checking for ia_agents_log table...\n');

    const query = `
      SELECT name, engine
      FROM system.tables
      WHERE database = '${process.env.CLICKHOUSE_DATABASE ?? 'default'}'
        AND name = 'ia_agents_log'
    `;

    const result = await clickhouse.query(query, { tenantId: '', userEmail: '' });

    if (result.length === 0) {
      console.log('❌ Table ia_agents_log NOT FOUND');
      console.log('\nCreating table now...\n');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ia_agents_log (
          timestamp DateTime DEFAULT now(),
          agent LowCardinality(String),
          tenant_id String,
          user_email String,
          conversation_id String,
          message_id String,
          user_question String,
          response_summary String,
          response_type LowCardinality(String),
          tools_used Array(String),
          sql_queries Array(String),
          business_entities Map(String, Array(String)),
          keywords Array(String),
          has_error UInt8,
          response_time_ms UInt32,
          user_rating Int8 DEFAULT 0,
          user_feedback String,
          agent_metadata String,
          date Date DEFAULT toDate(timestamp)
        ) ENGINE = MergeTree()
        PARTITION BY (toYYYYMM(date), agent)
        ORDER BY (agent, tenant_id, date, timestamp)
      `;

      await clickhouse.execute(createTableSQL);
      console.log('✅ Table created successfully!');
    } else {
      console.log('✅ Table ia_agents_log EXISTS');
      console.log(JSON.stringify(result[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  await clickhouse.close();
}

checkTable();
