/**
 * Test script: validates OpenAI API connection.
 * Run: npx tsx scripts/test-anthropic.ts
 */
import 'dotenv/config';
import OpenAI from 'openai';

async function main() {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  console.log('Testing OpenAI API...');
  console.log(`   Model: ${model}\n`);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 30_000 });

  try {
    // 1. Simple message
    console.log('1. Sending test message...');
    const response = await client.chat.completions.create({
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: 'Responda apenas: "Conexão OK". Nada mais.' }],
    });

    const text = response.choices[0].message.content ?? '';
    console.log(`   Response: ${text}`);
    console.log(`   Model: ${response.model}`);
    console.log(`   Tokens: ${response.usage?.prompt_tokens} in / ${response.usage?.completion_tokens} out\n`);

    // 2. Tool use test
    console.log('2. Testing tool use (function calling)...');
    const toolResponse = await client.chat.completions.create({
      model,
      max_tokens: 512,
      messages: [{ role: 'user', content: 'Busque a data mais recente dos dados de balanceamento.' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'clickhouse_query',
            description: 'Execute a SQL query against ClickHouse',
            parameters: {
              type: 'object' as const,
              properties: {
                sql: { type: 'string', description: 'SQL SELECT query' },
              },
              required: ['sql'],
            },
          },
        },
      ],
    });

    const msg = toolResponse.choices[0].message;
    if (msg.content) {
      console.log(`   Text: ${msg.content}`);
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        console.log(`   Tool call: ${tc.function.name}`);
        const args = JSON.parse(tc.function.arguments);
        console.log(`   SQL: ${args.sql}`);
      }
    }
    console.log(`   Finish reason: ${toolResponse.choices[0].finish_reason}`);
    console.log(`   Tokens: ${toolResponse.usage?.prompt_tokens} in / ${toolResponse.usage?.completion_tokens} out\n`);

    console.log('OpenAI API test complete!');
  } catch (err) {
    console.error('\nError:', (err as Error).message);
  }
}

main();
