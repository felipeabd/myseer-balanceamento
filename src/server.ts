/**
 * Standalone server for development/testing.
 * In production, use the exported router in your existing app.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { IrisAgent } from './agent/iris';
import { createIrisRouter } from './api/router';

const PORT = process.env.PORT ?? 3030;

async function main() {
  // Validate required env vars
  const requiredEnvVars = ['ANTHROPIC_API_KEY', 'CLICKHOUSE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const agent = new IrisAgent({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    clickhouse: {
      url: process.env.CLICKHOUSE_URL!,
      database: process.env.CLICKHOUSE_DATABASE ?? 'default',
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
    },
    maxToolCalls: parseInt(process.env.MAX_TOOL_CALLS ?? '2', 10),
  });

  const app = express();

  // Enable CORS for frontend
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true,
  }));

  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'iris-balanceamento' });
  });

  // Mount IRIS routes
  app.use('/api/iris', createIrisRouter(agent));

  app.listen(PORT, () => {
    console.log(`[Iris Balanceamento] Server running on port ${PORT}`);
    console.log(`[Iris Balanceamento] Endpoints:`);
    console.log(`  POST /api/iris/chat         - Chat (request/response)`);
    console.log(`  POST /api/iris/chat/stream   - Chat (SSE streaming)`);
    console.log(`  GET  /api/iris/conversations  - List conversations`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Iris Balanceamento] Shutting down...');
    await agent.destroy();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('[Iris Balanceamento] Fatal error:', err);
  process.exit(1);
});
