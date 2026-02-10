import { Router, Request, Response } from 'express';
import { IrisAgent } from '../agent/iris';
import { tenantMiddleware } from './middleware';
import { ChatRequest } from '../types';

/**
 * Creates an Express Router with IRIS agent endpoints.
 * Mount this in your existing app: app.use('/api/iris', createIrisRouter(agent))
 */
export function createIrisRouter(agent: IrisAgent): Router {
  const router = Router();

  // All routes require tenant context
  router.use(tenantMiddleware);

  /**
   * POST /chat
   * Standard request/response chat.
   *
   * Body: { message: string, conversationId?: string }
   * Returns: { conversationId: string, message: string }
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body as ChatRequest;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const result = await agent.chat(req.tenant!, message, conversationId);

      res.json({
        conversationId: result.conversationId,
        message: result.response,
      });
    } catch (err) {
      console.error('[IRIS] Chat error:', err);
      res.status(500).json({
        error: 'Problemas técnicos impediram a geração desta análise no momento.',
      });
    }
  });

  /**
   * POST /chat/stream
   * Server-Sent Events (SSE) streaming chat.
   *
   * Body: { message: string, conversationId?: string }
   * Returns: SSE stream with chunks
   */
  router.post('/chat/stream', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body as ChatRequest;

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
        }
      );

      // Send conversation ID as final event before closing
      res.write(`data: ${JSON.stringify({ conversationId: result.conversationId })}\n\n`);
      res.end();
    } catch (err) {
      console.error('[IRIS] Stream error:', err);
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
   * List conversations for the current user.
   */
  router.get('/conversations', (req: Request, res: Response) => {
    // This is a simple placeholder — in production you'd query a DB
    res.json({ conversations: [] });
  });

  /**
   * DELETE /conversations/:id
   * Delete a conversation.
   */
  router.delete('/conversations/:id', (req: Request, res: Response) => {
    res.json({ deleted: true });
  });

  return router;
}
