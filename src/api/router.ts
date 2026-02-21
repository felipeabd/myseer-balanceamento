import { Router, Request, Response } from 'express';
import { IrisAgent } from '../agent/iris';
import { tenantMiddleware } from './middleware';
import { ChatRequest, MessageContent } from '../types';

/** Extract plain text from a message content (handles multimodal ContentBlock[]) */
function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  const textBlock = content.find(b => b.type === 'text');
  return textBlock ? (textBlock as { type: 'text'; text: string }).text : '';
}

/**
 * Creates an Express Router with IRIS agent endpoints.
 * Mount this in your existing app: app.use('/api/iris', createIrisRouter(agent))
 */
export function createIrisRouter(agent: IrisAgent): Router {
  const router = Router();

  // CSV download endpoint (before tenant middleware — UUID acts as auth token)
  router.get('/download/csv/:id', (req: Request, res: Response) => {
    const csvStore = agent.getCsvStore();
    const entry = csvStore.get(req.params.id as string);

    if (!entry) {
      res.status(404).json({ error: 'CSV não encontrado ou expirado' });
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${entry.filename}"`);
    res.send(entry.content);
  });

  // All routes below require tenant context
  router.use(tenantMiddleware);

  /**
   * GET /agents
   * List published agents available for this tenant.
   * Returns: { agents: AgentInfo[] }
   */
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const agents = await registry.getTenantAgents(req.tenant!.tenantId);
      res.json({ agents });
    } catch (error) {
      console.error('[Iris] Agents list error:', error);
      res.status(500).json({ error: 'Failed to retrieve agents' });
    }
  });

  /**
   * POST /chat
   * Standard request/response chat.
   *
   * Body: { message: string, conversationId?: string, agentSlug?: string }
   * Returns: { conversationId: string, message: string }
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, images, conversationId, agentSlug } = req.body as ChatRequest;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const result = await agent.chat(req.tenant!, message, conversationId, images, agentSlug);

      res.json({
        conversationId: result.conversationId,
        message: result.response,
        messageId: result.messageId,
      });
    } catch (err) {
      console.error('[Iris] Chat error:', err);
      res.status(500).json({
        error: 'Problemas técnicos impediram a geração desta análise no momento.',
      });
    }
  });

  /**
   * POST /chat/stream
   * Server-Sent Events (SSE) streaming chat.
   *
   * Body: { message: string, conversationId?: string, agentSlug?: string }
   * Returns: SSE stream with chunks
   */
  router.post('/chat/stream', async (req: Request, res: Response) => {
    try {
      const { message, images, conversationId, agentSlug } = req.body as ChatRequest;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const result = await agent.chatStream(
        req.tenant!,
        message,
        conversationId,
        (chunk: string, done: boolean) => {
          if (done) {
            res.write(`data: [DONE]\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
        },
        images,
        agentSlug
      );

      // Send conversation ID + message ID as final event before closing
      console.log('[Iris] Stream final event:', { conversationId: result.conversationId, messageId: result.messageId });
      res.write(`data: ${JSON.stringify({ conversationId: result.conversationId, messageId: result.messageId })}\n\n`);
      res.end();
    } catch (err) {
      console.error('[Iris] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Problemas técnicos impediram a geração desta análise no momento.',
        });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Erro interno' })}\n\n`);
        res.end();
      }
    }
  });

  /**
   * GET /conversations
   * List conversations for the current tenant/user.
   * Returns summaries (title, lastMessage) from ClickHouse.
   */
  router.get('/conversations', async (req: Request, res: Response) => {
    try {
      const manager = agent.getConversationManager();
      const conversations = await manager.listByUser(req.tenant!.tenantId, req.tenant!.userEmail);
      res.json({ conversations });
    } catch (err) {
      console.error('[Iris] Conversations list error:', err);
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  });

  /**
   * GET /conversations/:id
   * Get a single conversation with full message history.
   */
  router.get('/conversations/:id', async (req: Request, res: Response) => {
    try {
      const manager = agent.getConversationManager();
      const conv = await manager.get(req.params['id'] as string);

      if (!conv || conv.tenantId !== req.tenant!.tenantId) {
        res.status(404).json({ error: 'Conversa não encontrada' });
        return;
      }

      const firstUserMsg = conv.messages.find(m => m.role === 'user');
      const lastAssistantMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');
      const title = extractText(firstUserMsg?.content ?? '').substring(0, 60) || 'Nova conversa';
      const lastMessage = extractText(lastAssistantMsg?.content ?? '').substring(0, 100);

      const messages = conv.messages.map((m, i) => ({
        id: `${conv.id}-${i}`,
        role: m.role,
        content: extractText(m.content),
        timestamp: m.timestamp,
      }));

      res.json({ id: conv.id, title, lastMessage, updatedAt: conv.updatedAt, messages });
    } catch (err) {
      console.error('[Iris] Conversation detail error:', err);
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  });

  /**
   * DELETE /conversations/:id
   * Delete a conversation (soft-delete in ClickHouse).
   */
  router.delete('/conversations/:id', async (req: Request, res: Response) => {
    try {
      const manager = agent.getConversationManager();
      const deleted = await manager.delete(req.params['id'] as string);
      res.json({ deleted });
    } catch (err) {
      console.error('[Iris] Conversation delete error:', err);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  });

  /**
   * GET /config
   * Get tenant configuration (current model + available models).
   */
  router.get('/config', async (req: Request, res: Response) => {
    try {
      const config = await agent.getTenantConfigManager().getConfig(req.tenant!.tenantId);
      res.json(config);
    } catch (error) {
      console.error('[Iris] Config GET error:', error);
      res.status(500).json({ error: 'Failed to retrieve config' });
    }
  });

  /**
   * PUT /config
   * Update tenant configuration (e.g. change model).
   */
  router.put('/config', async (req: Request, res: Response) => {
    try {
      const { modelId } = req.body as { modelId: string };
      if (!modelId) {
        res.status(400).json({ error: 'modelId é obrigatório' });
        return;
      }
      await agent.getTenantConfigManager().setModel(req.tenant!.tenantId, modelId);
      res.json({ modelId });
    } catch (error: any) {
      console.error('[Iris] Config PUT error:', error);
      res.status(400).json({ error: error.message ?? 'Failed to update config' });
    }
  });

  /**
   * GET /credits/detail
   * Drill-down: filtered hourly + byUser breakdown.
   * Query params: date (YYYY-MM-DD), user (email)
   */
  router.get('/credits/detail', async (req: Request, res: Response) => {
    try {
      const creditsManager = agent.getCreditsManager();
      const date = req.query.date as string | undefined;
      const user = req.query.user as string | undefined;
      const hour = req.query.hour as string | undefined;
      const detail = await creditsManager.getCreditsDetail(req.tenant!.tenantId, date, user, hour);
      res.json(detail);
    } catch (error) {
      console.error('[Iris] Credits detail error:', error);
      res.status(500).json({ error: 'Failed to retrieve credits detail' });
    }
  });

  /**
   * GET /metrics
   * Get token usage metrics for current tenant.
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const tracker = agent.getUsageTracker();
      const days = parseInt(req.query.days as string) || 30;

      const [metrics, daily] = await Promise.all([
        tracker.getTenantMetrics(req.tenant!.tenantId),
        tracker.getDailyUsage(req.tenant!.tenantId, days),
      ]);

      res.json({
        tenant: req.tenant!.tenantId,
        period: `${days} days`,
        summary: metrics,
        daily,
      });
    } catch (error) {
      console.error('[Iris] Metrics error:', error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  /**
   * POST /credits/add
   * Add credits to a tenant (accumulated into contratado_brl).
   * Body: { amountBrl: number }
   */
  router.post('/credits/add', async (req: Request, res: Response) => {
    try {
      const { amountBrl } = req.body as { amountBrl: number };
      if (!amountBrl || typeof amountBrl !== 'number' || amountBrl <= 0) {
        res.status(400).json({ error: 'amountBrl deve ser um número positivo' });
        return;
      }
      const creditsManager = agent.getCreditsManager();
      await creditsManager.addCredits(req.tenant!.tenantId, amountBrl);
      const info = await creditsManager.getCreditsInfo(req.tenant!.tenantId);
      res.json(info);
    } catch (error) {
      console.error('[Iris] Credits add error:', error);
      res.status(500).json({ error: 'Failed to add credits' });
    }
  });

  /**
   * GET /credits/invoices
   * Get recharge history for the tenant, optionally filtered by month (YYYY-MM).
   */
  router.get('/credits/invoices', async (req: Request, res: Response) => {
    try {
      const creditsManager = agent.getCreditsManager();
      const month = req.query.month as string | undefined;
      const recharges = await creditsManager.getRecharges(req.tenant!.tenantId, month);
      res.json(recharges);
    } catch (error) {
      console.error('[Iris] Credits invoices error:', error);
      res.status(500).json({ error: 'Failed to retrieve invoices' });
    }
  });

  /**
   * GET /credits
   * Get credits info (contracted, used, available) + usage breakdown in BRL.
   */
  router.get('/credits', async (req: Request, res: Response) => {
    try {
      const creditsManager = agent.getCreditsManager();
      const info = await creditsManager.getCreditsInfo(req.tenant!.tenantId);
      res.json(info);
    } catch (error) {
      console.error('[Iris] Credits error:', error);
      res.status(500).json({ error: 'Failed to retrieve credits info' });
    }
  });

  /**
   * GET /metrics/conversation/:id
   * Get token usage for a specific conversation.
   */
  router.get('/metrics/conversation/:id', async (req: Request, res: Response) => {
    try {
      const tracker = agent.getUsageTracker();
      const conversationId = req.params.id as string;

      const metrics = await tracker.getConversationMetrics(conversationId);

      res.json({
        conversationId,
        metrics,
      });
    } catch (error) {
      console.error('[Iris] Conversation metrics error:', error);
      res.status(500).json({ error: 'Failed to retrieve conversation metrics' });
    }
  });

  /**
   * POST /feedback
   * Submit thumbs up/down feedback for a message.
   * Body: { messageId: string, conversationId: string, rating: 1 | -1, feedbackText?: string }
   */
  router.post('/feedback', async (req: Request, res: Response) => {
    try {
      const { messageId, conversationId, rating, feedbackText } = req.body as {
        messageId: string;
        conversationId: string;
        rating: 1 | -1;
        feedbackText?: string;
      };

      if (!messageId || !conversationId || (rating !== 1 && rating !== -1)) {
        res.status(400).json({ error: 'messageId, conversationId e rating (1 ou -1) são obrigatórios' });
        return;
      }

      const logger = agent.getConversationLogger();
      await logger.submitFeedback(messageId, conversationId, rating, feedbackText ?? '');

      res.json({ ok: true });
    } catch (error) {
      console.error('[Iris] Feedback error:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  });

  return router;
}
