import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ClickHouseService } from '../src/clickhouse/client';

async function setupUsageTracking() {
  console.log('📊 Setting up token usage tracking...');

  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  try {
    // Read SQL file
    const sqlPath = join(__dirname, 'create-usage-table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute each statement (split by semicolon and filter empty)
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

    console.log('✅ Table ia_uso_tokens created successfully!');
    console.log('');
    console.log('You can now track token usage and costs.');
    console.log('Check the SQL file for example queries.');

  } catch (error) {
    console.error('❌ Error setting up usage tracking:', error);
    process.exit(1);
  }

  await clickhouse.close();
}

setupUsageTracking();
