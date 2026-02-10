import 'dotenv/config';
import { ClickHouseService } from '../src/clickhouse/client';

async function checkTables() {
  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  try {
    console.log('🔍 Verificando tabelas de regras...\n');

    // Verificar sessões
    console.log('📋 ia_sessoes_regras:');
    const sessions = await clickhouse.query(
      'SELECT * FROM ia_sessoes_regras ORDER BY last_activity DESC LIMIT 5',
      { tenantId: '', userEmail: '' }
    );
    console.log(`Total de registros: ${sessions.length}`);
    if (sessions.length > 0) {
      console.log(JSON.stringify(sessions, null, 2));
    } else {
      console.log('❌ Nenhuma sessão encontrada\n');
    }

    console.log('\n📋 ia_regras_balanceamento:');
    const rules = await clickhouse.query(
      'SELECT * FROM ia_regras_balanceamento ORDER BY criado_em DESC LIMIT 5',
      { tenantId: '', userEmail: '' }
    );
    console.log(`Total de registros: ${rules.length}`);
    if (rules.length > 0) {
      console.log(JSON.stringify(rules, null, 2));
    } else {
      console.log('❌ Nenhuma regra encontrada\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await clickhouse.close();
  }
}

checkTables();
