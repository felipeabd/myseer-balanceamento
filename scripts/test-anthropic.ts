/**
 * Test script: validates Anthropic API connection.
 * Run: npx tsx scripts/test-anthropic.ts
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  console.log('🤖 Testing Anthropic API...');
  console.log(`   Model: ${model}\n`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  try {
    // 1. Simple message
    console.log('1️⃣  Sending test message...');
    const response = await client.messages.create({
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: 'Responda apenas: "Conexão OK". Nada mais.' }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('');

    console.log(`   ✅ Response: ${text}`);
    console.log(`   Model: ${response.model}`);
    console.log(`   Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out\n`);

    // 2. Tool use test
    console.log('2️⃣  Testing tool use (function calling)...');
    const toolResponse = await client.messages.create({
      model,
      max_tokens: 512,
      messages: [{ role: 'user', content: 'Busque a data mais recente dos dados de balanceamento.' }],
      tools: [
        {
          name: 'clickhouse_query',
          description: 'Execute a SQL query against ClickHouse',
          input_schema: {
            type: 'object' as const,
            properties: {
              sql: { type: 'string', description: 'SQL SELECT query' },
            },
            required: ['sql'],
          },
        },
      ],
    });

    for (const block of toolResponse.content) {
      if (block.type === 'text') {
        console.log(`   Text: ${block.text}`);
      } else if (block.type === 'tool_use') {
        console.log(`   ✅ Tool call: ${block.name}`);
        console.log(`   SQL: ${(block.input as { sql: string }).sql}`);
      }
    }
    console.log(`   Stop reason: ${toolResponse.stop_reason}`);
    console.log(`   Tokens: ${toolResponse.usage.input_tokens} in / ${toolResponse.usage.output_tokens} out\n`);

    console.log('🎉 Anthropic API test complete!');
  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message);
  }
}

main();
