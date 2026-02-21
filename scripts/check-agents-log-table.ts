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
    console.log('🔍 Checking for ia_log_agentes table...\n');

    const query = `
      SELECT name, engine
      FROM system.tables
      WHERE database = '${process.env.CLICKHOUSE_DATABASE ?? 'default'}'
        AND name = 'ia_log_agentes'
    `;

    const result = await clickhouse.query(query, { tenantId: '', userEmail: '' });

    if (result.length === 0) {
      console.log('❌ Table ia_log_agentes NOT FOUND');
      console.log('\nCreating table now...\n');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ia_log_agentes (
          data_hora DateTime DEFAULT now(),
          agente LowCardinality(String),
          tenant_id String,
          email_usuario String,
          conversa_id String,
          mensagem_id String,
          pergunta_usuario String,
          resumo_resposta String,
          tipo_resposta LowCardinality(String),
          ferramentas_usadas Array(String),
          consultas_sql Array(String),
          entidades_negocio Map(String, Array(String)),
          palavras_chave Array(String),
          tem_erro UInt8,
          tempo_resposta_ms UInt32,
          avaliacao_usuario Int8 DEFAULT 0,
          feedback_usuario String,
          metadados_agente String,
          data Date DEFAULT toDate(data_hora)
        ) ENGINE = MergeTree()
        PARTITION BY (toYYYYMM(data), agente)
        ORDER BY (agente, tenant_id, data, data_hora)
      `;

      await clickhouse.execute(createTableSQL);
      console.log('✅ Table created successfully!');
    } else {
      console.log('✅ Table ia_log_agentes EXISTS');
      console.log(JSON.stringify(result[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  await clickhouse.close();
}

checkTable();
