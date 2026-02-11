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
  const requiredEnvVars = ['OPENAI_API_KEY', 'CLICKHOUSE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const agent = new IrisAgent({
    openaiApiKey: process.env.OPENAI_API_KEY!,
    openaiModel: process.env.OPENAI_MODEL,
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
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];
  app.use(cors({
    origin: corsOrigins,
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
    console.log(`  POST /api/iris/chat             - Chat (request/response)`);
    console.log(`  POST /api/iris/chat/stream       - Chat (SSE streaming)`);
    console.log(`  GET  /api/iris/conversations     - List conversations`);
    console.log(`  GET  /api/iris/download/csv/:id  - Download CSV`);
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
