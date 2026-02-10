/**
 * Test script: validates ClickHouse connection and explores the table structure.
 * Run: npx tsx scripts/test-clickhouse.ts
 */
import 'dotenv/config';
import { createClient } from '@clickhouse/client';

async function main() {
  console.log('🔌 Connecting to ClickHouse...');
  console.log(`   URL: ${process.env.CLICKHOUSE_URL}`);
  console.log(`   DB:  ${process.env.CLICKHOUSE_DATABASE ?? 'default'}`);
  console.log(`   User: ${process.env.CLICKHOUSE_USER}\n`);

  const client = createClient({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? '',
    request_timeout: 15_000,
  });

  try {
    // 1. Basic connectivity
    console.log('1️⃣  Testing connectivity...');
    const ping = await client.query({ query: 'SELECT 1 as ok', format: 'JSONEachRow' });
    const pingResult = await ping.json();
    console.log('   ✅ Connected!\n');

    // 2. Check if table exists
    console.log('2️⃣  Checking table ia_fato_balanceamento...');
    const tableCheck = await client.query({
      query: `SELECT count() as total FROM system.tables WHERE database = 'default' AND name = 'ia_fato_balanceamento'`,
      format: 'JSONEachRow',
    });
    const tableResult = await tableCheck.json<{ total: string }[]>();
    const exists = Number(tableResult[0]?.total) > 0;

    if (!exists) {
      console.log('   ⚠️  Table ia_fato_balanceamento NOT FOUND');
      console.log('   Listing available tables...\n');

      const tables = await client.query({
        query: `SELECT name FROM system.tables WHERE database = 'default' ORDER BY name`,
        format: 'JSONEachRow',
      });
      const tableList = await tables.json<{ name: string }[]>();
      tableList.forEach(t => console.log(`   - ${t.name}`));

      await client.close();
      return;
    }
    console.log('   ✅ Table exists!\n');

    // 3. Table structure
    console.log('3️⃣  Table structure:');
    const cols = await client.query({
      query: `DESCRIBE TABLE default.ia_fato_balanceamento`,
      format: 'JSONEachRow',
    });
    const colResult = await cols.json<{ name: string; type: string }[]>();
    colResult.forEach(c => console.log(`   ${c.name.padEnd(20)} ${c.type}`));
    console.log();

    // 4. Row count and tenants
    console.log('4️⃣  Data overview:');
    const stats = await client.query({
      query: `SELECT
        count() as total_rows,
        uniq(tenant) as tenants,
        min(dtcarga) as first_load,
        max(dtcarga) as last_load
      FROM default.ia_fato_balanceamento`,
      format: 'JSONEachRow',
    });
    const statsResult = await stats.json<Record<string, string>[]>();
    const s = statsResult[0];
    console.log(`   Total rows:  ${s.total_rows}`);
    console.log(`   Tenants:     ${s.tenants}`);
    console.log(`   First load:  ${s.first_load}`);
    console.log(`   Last load:   ${s.last_load}\n`);

    // 5. List tenants
    console.log('5️⃣  Available tenants:');
    const tenants = await client.query({
      query: `SELECT tenant, count() as rows FROM default.ia_fato_balanceamento GROUP BY tenant ORDER BY rows DESC LIMIT 10`,
      format: 'JSONEachRow',
    });
    const tenantList = await tenants.json<{ tenant: string; rows: string }[]>();
    tenantList.forEach(t => console.log(`   ${t.tenant}  (${t.rows} rows)`));
    console.log();

    // 6. Sample data for first tenant
    if (tenantList.length > 0) {
      const sampleTenant = tenantList[0].tenant;
      console.log(`6️⃣  Sample data (tenant: ${sampleTenant}):`);
      const sample = await client.query({
        query: `SELECT * FROM default.ia_fato_balanceamento WHERE tenant = '${sampleTenant}' LIMIT 3`,
        format: 'JSONEachRow',
      });
      const sampleResult = await sample.json();
      console.log(JSON.stringify(sampleResult, null, 2));
    }

    console.log('\n🎉 ClickHouse connection test complete!');
  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message);
  } finally {
    await client.close();
  }
}

main();
