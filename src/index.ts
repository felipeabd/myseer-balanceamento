/**
 * @myseer/balanceamento
 *
 * IRIS - Agente de IA para balanceamento de estoque entre lojas.
 *
 * Usage in your existing Express app:
 *
 *   import { IrisAgent, createIrisRouter } from '@myseer/balanceamento';
 *
 *   const agent = new IrisAgent({
 *     anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
 *     clickhouse: {
 *       url: process.env.CLICKHOUSE_URL!,
 *       database: 'default',
 *       username: process.env.CLICKHOUSE_USER,
 *       password: process.env.CLICKHOUSE_PASSWORD,
 *     },
 *   });
 *
 *   app.use('/api/iris', createIrisRouter(agent));
 */

export { IrisAgent } from './agent/iris';
export { createIrisRouter } from './api/router';
export { tenantMiddleware } from './api/middleware';
export { buildSystemPrompt } from './agent/prompt';
export { ClickHouseService } from './clickhouse/client';
export { ConversationManager } from './conversation/manager';

export type {
  IrisConfig,
  TenantContext,
  BalancingRule,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Conversation,
  StreamCallback,
} from './types';
