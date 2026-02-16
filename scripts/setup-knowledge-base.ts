#!/usr/bin/env tsx
/**
 * Script para criar e popular a Base de Conhecimento no ClickHouse
 *
 * Uso:
 *   npm run setup:knowledge
 *
 * Ou diretamente:
 *   npx tsx scripts/setup-knowledge-base.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { ClickHouseService } from '../src/clickhouse/client';

async function main() {
  console.log('🚀 Iniciando setup da Base de Conhecimento...\n');

  const clickhouse = new ClickHouseService({
    host: process.env.CLICKHOUSE_HOST!,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });

  try {
    // 1. Criar tabela
    console.log('📋 Passo 1: Criando tabela ia_base_conhecimento...');
    const createTableSQL = readFileSync(
      join(__dirname, '../sql/01_create_knowledge_base.sql'),
      'utf-8'
    );

    // Executar cada statement separadamente (ClickHouse não suporta múltiplos statements)
    const statements = createTableSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('create table')) {
        await clickhouse.rawQuery(statement);
        console.log('   ✅ Tabela criada com sucesso');
      } else if (statement.toLowerCase().includes('create index')) {
        await clickhouse.rawQuery(statement);
        console.log('   ✅ Índice criado');
      }
    }

    // 2. Popular com conhecimento inicial
    console.log('\n📚 Passo 2: Populando base de conhecimento...');
    const populateSQL = readFileSync(
      join(__dirname, '../sql/02_populate_knowledge_base.sql'),
      'utf-8'
    );

    const inserts = populateSQL
      .split('INSERT INTO')
      .filter(s => s.trim().length > 0);

    for (const insert of inserts) {
      const fullInsert = 'INSERT INTO' + insert;
      if (fullInsert.includes('ia_base_conhecimento')) {
        await clickhouse.rawQuery(fullInsert);
      }
    }

    console.log('   ✅ Conhecimento inicial carregado');

    // 3. Verificar resultado
    console.log('\n🔍 Passo 3: Verificando instalação...');
    const count = await clickhouse.query(
      'SELECT COUNT(*) as total FROM ia_base_conhecimento',
      { tenantId: 'global', userEmail: 'system' }
    );

    const total = (count[0] as any).total;
    console.log(`   ✅ Total de ${total} conceitos carregados\n`);

    // 4. Listar conceitos
    console.log('📖 Conceitos disponíveis:');
    const concepts = await clickhouse.query(
      `SELECT termo, categoria,
        substring(definicao, 1, 80) as definicao_resumo
       FROM ia_base_conhecimento
       WHERE ativo = true
       ORDER BY categoria, termo`,
      { tenantId: 'global', userEmail: 'system' }
    );

    const grouped: Record<string, string[]> = {};
    for (const row of concepts) {
      const cat = (row as any).categoria || 'outros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(`   - ${(row as any).termo}`);
    }

    for (const [cat, termos] of Object.entries(grouped)) {
      console.log(`\n ${cat.toUpperCase()}:`);
      termos.forEach(t => console.log(t));
    }

    console.log('\n✅ Setup concluído com sucesso!\n');
    console.log('💡 Agora a Iris pode:');
    console.log('   - Responder "O que é excesso?"');
    console.log('   - Explicar conceitos de negócio');
    console.log('   - Enriquecer respostas com contexto');
    console.log('   - Usar conhecimento no sistema de aprendizado (futuro)\n');

  } catch (error) {
    console.error('❌ Erro ao configurar base de conhecimento:', error);
    process.exit(1);
  } finally {
    await clickhouse.close();
  }
}

main();
