import { Router, Request, Response } from 'express';
import { IrisAgent } from '../agent/iris';
import { builderMiddleware } from './builder-middleware';

/**
 * Creates an Express Router with Builder mode endpoints.
 * These endpoints allow creating, editing, testing, and publishing agents.
 * Mount: app.use('/api/builder', createBuilderRouter(agent))
 */
export function createBuilderRouter(agent: IrisAgent): Router {
  const router = Router();

  // All builder routes require builder authentication
  router.use(builderMiddleware);

  // ── Agent CRUD ──────────────────────────────────────────

  /**
   * GET /agents
   * List all agents (any status) for the builder.
   */
  router.get('/agents', async (_req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const agents = await registry.getAllAgents();
      res.json({ agents });
    } catch (error) {
      console.error('[Builder] List agents error:', error);
      res.status(500).json({ error: 'Failed to list agents' });
    }
  });

  /**
   * GET /agents/:id
   * Get a single agent by ID.
   */
  router.get('/agents/:id', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const found = await registry.getAgentById(req.params.id as string);
      if (!found) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(found);
    } catch (error) {
      console.error('[Builder] Get agent error:', error);
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  /**
   * POST /agents
   * Create a new agent (status: rascunho).
   */
  router.post('/agents', async (req: Request, res: Response) => {
    try {
      const { slug, nome, ...rest } = req.body;
      if (!slug || !nome) {
        res.status(400).json({ error: 'slug e nome são obrigatórios' });
        return;
      }

      const registry = agent.getAgentRegistry();

      // Check if slug already exists
      const existing = await registry.getAgentBySlug(slug);
      if (existing) {
        res.status(409).json({ error: `Já existe um agente com slug "${slug}"` });
        return;
      }

      const created = await registry.createAgent({
        slug,
        nome,
        criadoPor: req.headers['x-user-email'] as string || 'builder',
        ...rest,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error('[Builder] Create agent error:', error);
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  /**
   * PUT /agents/:id
   * Update an existing agent.
   */
  router.put('/agents/:id', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const updated = await registry.updateAgent(req.params.id as string, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error('[Builder] Update agent error:', error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  /**
   * PUT /agents/:id/publish
   * Publish an agent (status: publicado).
   */
  router.put('/agents/:id/publish', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const published = await registry.publishAgent(req.params.id as string);
      if (!published) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(published);
    } catch (error) {
      console.error('[Builder] Publish agent error:', error);
      res.status(500).json({ error: 'Failed to publish agent' });
    }
  });

  /**
   * PUT /agents/:id/unpublish
   * Unpublish an agent (status: testando).
   */
  router.put('/agents/:id/unpublish', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const unpublished = await registry.unpublishAgent(req.params.id as string);
      if (!unpublished) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(unpublished);
    } catch (error) {
      console.error('[Builder] Unpublish agent error:', error);
      res.status(500).json({ error: 'Failed to unpublish agent' });
    }
  });

  // ── Versioning ─────────────────────────────────────────

  /**
   * GET /agents/:id/versions
   * List all versions of an agent.
   */
  router.get('/agents/:id/versions', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const versions = await registry.getAgentVersions(req.params.id as string);
      res.json({ versions });
    } catch (error) {
      console.error('[Builder] Get versions error:', error);
      res.status(500).json({ error: 'Failed to get agent versions' });
    }
  });

  /**
   * PUT /agents/:id/rollback
   * Rollback an agent to a previous version.
   * Body: { versao: number }
   */
  router.put('/agents/:id/rollback', async (req: Request, res: Response) => {
    try {
      const { versao } = req.body as { versao: number };
      if (!versao || typeof versao !== 'number') {
        res.status(400).json({ error: 'versao é obrigatório e deve ser um número' });
        return;
      }
      const registry = agent.getAgentRegistry();
      const restored = await registry.rollbackAgent(req.params.id as string, versao);
      if (!restored) {
        res.status(404).json({ error: 'Agente ou versão não encontrado' });
        return;
      }
      res.json(restored);
    } catch (error) {
      console.error('[Builder] Rollback agent error:', error);
      res.status(500).json({ error: 'Failed to rollback agent' });
    }
  });

  // ── Schema Introspection ────────────────────────────────

  /**
   * GET /tables
   * List ClickHouse tables (ia_* prefixed).
   */
  router.get('/tables', async (_req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const tables = await registry.listTables();
      res.json({ tables });
    } catch (error) {
      console.error('[Builder] List tables error:', error);
      res.status(500).json({ error: 'Failed to list tables' });
    }
  });

  /**
   * GET /tables/:name/columns
   * List columns of a specific table.
   */
  router.get('/tables/:name/columns', async (req: Request, res: Response) => {
    try {
      const registry = agent.getAgentRegistry();
      const columns = await registry.describeTable(req.params.name as string);
      res.json({ columns });
    } catch (error: any) {
      console.error('[Builder] Describe table error:', error);
      res.status(400).json({ error: error.message ?? 'Failed to describe table' });
    }
  });

  // ── Test Chat ───────────────────────────────────────────

  /**
   * POST /agents/:id/test-chat
   * Chat with an agent in test mode (works with any status including rascunho).
   */
  router.post('/agents/:id/test-chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body;
      if (!message) {
        res.status(400).json({ error: 'message é obrigatório' });
        return;
      }

      const registry = agent.getAgentRegistry();
      const agentDef = await registry.getAgentById(req.params.id as string);
      if (!agentDef) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      // Use the agent's slug for chat (the engine resolves by slug)
      const tenant = {
        tenantId: (req.headers['x-tenant-id'] as string) || 'builder-test',
        userEmail: (req.headers['x-user-email'] as string) || 'builder@myseer.com',
      };

      const result = await agent.chat(tenant, message, conversationId, undefined, agentDef.slug);
      res.json({
        conversationId: result.conversationId,
        message: result.response,
      });
    } catch (error) {
      console.error('[Builder] Test chat error:', error);
      res.status(500).json({ error: 'Failed to test chat' });
    }
  });

  /**
   * POST /agents/:id/test-chat/stream
   * Streaming test chat with an agent.
   */
  router.post('/agents/:id/test-chat/stream', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body;
      if (!message) {
        res.status(400).json({ error: 'message é obrigatório' });
        return;
      }

      const registry = agent.getAgentRegistry();
      const agentDef = await registry.getAgentById(req.params.id as string);
      if (!agentDef) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const tenant = {
        tenantId: (req.headers['x-tenant-id'] as string) || 'builder-test',
        userEmail: (req.headers['x-user-email'] as string) || 'builder@myseer.com',
      };

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const result = await agent.chatStream(
        tenant,
        message,
        conversationId,
        (chunk: string, done: boolean) => {
          if (done) {
            res.write(`data: [DONE]\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
        },
        undefined,
        agentDef.slug
      );

      res.write(`data: ${JSON.stringify({ conversationId: result.conversationId })}\n\n`);
      res.end();
    } catch (error) {
      console.error('[Builder] Test chat stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to test chat' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Erro interno' })}\n\n`);
        res.end();
      }
    }
  });

  return router;
}
