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
    console.log('🔍 Checking for ia_uso_tokens table...\n');

    // Check if table exists
    const query = `
      SELECT
        name,
        engine,
        create_table_query
      FROM system.tables
      WHERE database = '${process.env.CLICKHOUSE_DATABASE ?? 'default'}'
        AND name = 'ia_uso_tokens'
    `;

    const result = await clickhouse.query(query, { tenantId: '', userEmail: '' });

    if (result.length === 0) {
      console.log('❌ Table ia_uso_tokens NOT FOUND');
      console.log('\nTrying to create it now...\n');

      // Try to create the table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ia_uso_tokens (
          data_hora DateTime DEFAULT now(),
          tenant_id String,
          email_usuario String,
          conversa_id String,
          modelo String,
          tokens_entrada UInt32,
          tokens_saida UInt32,
          tokens_total UInt32,
          custo_usd Float32,
          endpoint String,
          data Date DEFAULT toDate(data_hora)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(data)
        ORDER BY (tenant_id, data, data_hora)
      `;

      await clickhouse.execute(createTableSQL);
      console.log('✅ Table created successfully!');
    } else {
      console.log('✅ Table ia_uso_tokens EXISTS');
      console.log('\nTable info:');
      console.log(JSON.stringify(result[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  await clickhouse.close();
}

checkTable();
