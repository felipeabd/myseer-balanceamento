import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ClickHouseService } from '../src/clickhouse/client';

async function setupAgentsLog() {
  console.log('📝 Setting up agents conversation logging...');

  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  try {
    // Read SQL file
    const sqlPath = join(__dirname, 'create-agents-log-table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        console.log('Executing statement...');
        await clickhouse.execute(statement);
      }
    }

    console.log('✅ Table ia_agents_log created successfully!');
    console.log('');
    console.log('You can now track conversations from all AI agents.');
    console.log('Check the SQL file for example queries.');

  } catch (error) {
    console.error('❌ Error setting up agents log:', error);
    process.exit(1);
  }

  await clickhouse.close();
}

setupAgentsLog();
