import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ClickHouseService } from '../src/clickhouse/client';

async function setupAgentsTable() {
  console.log('🤖 Configurando tabelas de agentes (ia_agentes + ia_tenant_agentes)...\n');

  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  try {
    // Read SQL file
    const sqlPath = join(__dirname, '..', 'sql', '03_create_agents_table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute each statement (split by semicolon, filter empty/comments)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        console.log('Executando statement...');
        await clickhouse.execute(statement);
      }
    }

    console.log('\n✅ Tabelas criadas com sucesso!');
    console.log('   - ia_agentes (definição de agentes)');
    console.log('   - ia_tenant_agentes (habilitação por tenant)');
    console.log('');

    // Verify tables exist
    const tables = await clickhouse.rawQuery(`
      SELECT name, engine
      FROM system.tables
      WHERE database = currentDatabase()
        AND name IN ('ia_agentes', 'ia_tenant_agentes')
      ORDER BY name
    `);

    console.log('📋 Tabelas verificadas:');
    for (const t of tables) {
      console.log(`   ✓ ${t.name} (${t.engine})`);
    }

  } catch (error) {
    console.error('❌ Erro ao configurar tabelas de agentes:', error);
    process.exit(1);
  }

  await clickhouse.close();
}

setupAgentsTable();
