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
    console.log('🔍 Checking for ia_usage_tokens table...\n');

    // Check if table exists
    const query = `
      SELECT
        name,
        engine,
        create_table_query
      FROM system.tables
      WHERE database = '${process.env.CLICKHOUSE_DATABASE ?? 'default'}'
        AND name = 'ia_usage_tokens'
    `;

    const result = await clickhouse.query(query, { tenantId: '', userEmail: '' });

    if (result.length === 0) {
      console.log('❌ Table ia_usage_tokens NOT FOUND');
      console.log('\nTrying to create it now...\n');

      // Try to create the table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ia_usage_tokens (
          timestamp DateTime DEFAULT now(),
          tenant_id String,
          user_email String,
          conversation_id String,
          model String,
          input_tokens UInt32,
          output_tokens UInt32,
          total_tokens UInt32,
          cost_usd Float32,
          endpoint String,
          date Date DEFAULT toDate(timestamp)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (tenant_id, date, timestamp)
      `;

      await clickhouse.execute(createTableSQL);
      console.log('✅ Table created successfully!');
    } else {
      console.log('✅ Table ia_usage_tokens EXISTS');
      console.log('\nTable info:');
      console.log(JSON.stringify(result[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  await clickhouse.close();
}

checkTable();
