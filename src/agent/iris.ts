import Anthropic from '@anthropic-ai/sdk';
import { ClickHouseService } from '../clickhouse/client';
import { buildSystemPrompt, buildDynamicSystemPrompt } from './prompt';
import { agentTools, getToolsForAgent, isToolEnabledForAgent } from './tools';
import { ConversationManager } from '../conversation/manager';
import { UsageTracker } from '../tracking/usage-tracker';
import { ConversationLogger } from '../tracking/conversation-logger';
import { CreditsManager } from '../tracking/credits-manager';
import { TenantConfigManager } from '../tracking/tenant-config';
import { SessionManager } from '../rules/session-manager';
import { RuleTrainerAgent } from './rule-trainer';
import { LoadRulesSkill } from '../rules/load-rules-skill';
import { CsvStore } from '../csv/csv-store';
import { generateCsv } from '../csv/csv-generator';
import { AgentRegistry } from '../builder/agent-registry';
import { SummaryGenerator, formatSummariesForPrompt } from '../conversation/summary-generator';
import { ProfileManager, formatProfileForPrompt } from '../conversation/profile-manager';
import {
  IrisConfig,
  TenantContext,
  AgentDefinition,
  BalancingRule,
  ChatMessage,
  StreamCallback,
  ImageContent,
  MessageContent,
  ContentBlock,
} from '../types';

export class IrisAgent {
  private anthropic: Anthropic;
  private model: string;
  private clickhouse: ClickHouseService;
  private conversations: ConversationManager;
  private rules: BalancingRule[];
  private maxToolCalls: number;
  private usageTracker: UsageTracker;
  private conversationLogger: ConversationLogger;
  private creditsManager: CreditsManager;
  private tenantConfigManager: TenantConfigManager;
  private sessionManager: SessionManager;
  private ruleTrainer: RuleTrainerAgent;
  private loadRulesSkill: LoadRulesSkill;
  private csvStore: CsvStore;
  private baseUrl: string;
  private agentRegistry: AgentRegistry;
  private summaryGenerator: SummaryGenerator;
  private profileManager: ProfileManager;

  private readonly LEGACY_AGENT_NAME = 'iris';

  /** Build message content (text only or multimodal with images) */
  private buildMessageContent(text: string, images?: ImageContent[]): MessageContent {
    if (!images || images.length === 0) {
      return text;
    }

    const contentBlocks: ContentBlock[] = [
      { type: 'text', text },
      ...images
    ];
    return contentBlocks;
  }

  constructor(config: IrisConfig) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.anthropicModel ?? 'claude-haiku-4-5-20251001';
    this.clickhouse = new ClickHouseService(config.clickhouse);
    this.conversations = new ConversationManager(this.clickhouse);
    this.rules = config.rules ?? [];
    this.maxToolCalls = config.maxToolCalls ?? 3;
    this.usageTracker = new UsageTracker(this.clickhouse);
    this.conversationLogger = new ConversationLogger(this.clickhouse);
    this.creditsManager = new CreditsManager(this.clickhouse);
    this.tenantConfigManager = new TenantConfigManager(this.clickhouse);
    this.sessionManager = new SessionManager(this.clickhouse);
    this.ruleTrainer = new RuleTrainerAgent(this.clickhouse, this.sessionManager, this.conversations);
    this.loadRulesSkill = new LoadRulesSkill(this.clickhouse);
    this.csvStore = new CsvStore();
    this.baseUrl = config.baseUrl ?? `http://localhost:${process.env.PORT ?? 3030}`;
    this.agentRegistry = new AgentRegistry(this.clickhouse);
    this.summaryGenerator = new SummaryGenerator(this.clickhouse, this.anthropic);
    this.profileManager = new ProfileManager(this.clickhouse, this.anthropic);
  }

  /** Get usage tracker instance */
  getUsageTracker(): UsageTracker {
    return this.usageTracker;
  }

  /** Get conversation logger instance */
  getConversationLogger(): ConversationLogger {
    return this.conversationLogger;
  }

  /** Get CSV store instance for download endpoint */
  getCsvStore(): CsvStore {
    return this.csvStore;
  }

  /** Get credits manager instance */
  getCreditsManager(): CreditsManager {
    return this.creditsManager;
  }

  /** Get conversation manager instance */
  getConversationManager(): ConversationManager {
    return this.conversations;
  }

  /** Get tenant config manager instance */
  getTenantConfigManager(): TenantConfigManager {
    return this.tenantConfigManager;
  }

  /** Get agent registry instance */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  // ── Agent Resolution ──────────────────────────────────────

  /**
   * Resolve an agent definition by slug.
   * Returns null if not found (caller should fall back to legacy).
   */
  private async resolveAgent(agentSlug?: string): Promise<AgentDefinition | null> {
    if (!agentSlug) return null;

    try {
      return await this.agentRegistry.getAgentBySlug(agentSlug);
    } catch (err) {
      console.warn(`[Iris] Failed to resolve agent "${agentSlug}":`, err);
      return null;
    }
  }

  /**
   * Build the system prompt and tools for a request.
   * Uses dynamic config when an agent is loaded from DB, legacy otherwise.
   */
  private async buildPromptAndTools(
    agent: AgentDefinition | null,
    tenant: TenantContext,
    currentConversationId?: string
  ): Promise<{ systemPrompt: string; tools: Anthropic.Tool[]; agentName: string; maxTokens: number; temperature: number; maxCalls: number }> {
    if (agent) {
      // Fetch rules, summaries, and user profile in parallel
      const [rulesPrompt, summaries, profile] = await Promise.all([
        this.loadRulesSkill.execute(tenant.tenantId),
        agent.contextoConversas && currentConversationId
          ? this.summaryGenerator.getRecentSummaries(
              tenant.tenantId,
              tenant.userEmail,
              agent.slug,
              currentConversationId,
              agent.numConversasAnteriores
            )
          : Promise.resolve([]),
        agent.perfilUsuario
          ? this.profileManager.getProfile(tenant.tenantId, tenant.userEmail, agent.slug)
          : Promise.resolve(''),
      ]);

      const summariesPrompt = summaries.length > 0
        ? formatSummariesForPrompt(summaries)
        : '';

      const perfilPrompt = profile
        ? formatProfileForPrompt(profile)
        : '';

      return {
        systemPrompt: buildDynamicSystemPrompt(agent, tenant, rulesPrompt, summariesPrompt, perfilPrompt),
        tools: getToolsForAgent(agent),
        agentName: agent.slug,
        maxTokens: agent.maxTokens,
        temperature: agent.temperature,
        maxCalls: agent.maxToolCalls,
      };
    }

    // Legacy path
    const rulesPrompt = await this.loadRulesSkill.execute(tenant.tenantId);
    return {
      systemPrompt: buildSystemPrompt(tenant, this.rules) + rulesPrompt,
      tools: agentTools,
      agentName: this.LEGACY_AGENT_NAME,
      maxTokens: 4096,
      temperature: 0.2,
      maxCalls: this.maxToolCalls,
    };
  }

  // ── Chat (non-streaming) ──────────────────────────────────

  /**
   * Process a user message and return the agent's response.
   * Handles the full agentic loop: LLM → tool call → LLM → response.
   * Supports multimodal input (text + images).
   */
  async chat(
    tenant: TenantContext,
    userMessage: string,
    conversationId?: string,
    images?: ImageContent[],
    agentSlug?: string
  ): Promise<{ conversationId: string; response: string; messageId?: string }> {

    const conv = await this.conversations.getOrCreate(conversationId, tenant, agentSlug);

    // ========== RULE TRAINING MODE DETECTION ==========
    // 1. Check if user wants to enter training mode (explicit command)
    const isRuleTraining = userMessage.match(/^(regras?:|\/regras?)\s*/i);

    // 2. Check if user wants to modify/fix a rule (implicit intent in normal mode)
    const isRuleModification = !isRuleTraining && this.detectRuleModificationIntent(userMessage);

    if (isRuleTraining || isRuleModification) {
      // Extract message without prefix (for explicit command)
      const ruleMessage = isRuleTraining
        ? userMessage.replace(/^(regras?:|\/regras?)\s*/i, '').trim()
        : userMessage;

      // Activate training session
      await this.sessionManager.startTrainingSession(
        conv.id,
        tenant.tenantId,
        tenant.userEmail
      );

      // Redirect to Rule Trainer Agent
      const response = await this.ruleTrainer.chat(
        ruleMessage || 'Iniciar treinamento de regras',
        conv.id,
        tenant
      );

      return {
        conversationId: conv.id,
        response,
      };
    }

    // 3. Check if conversation is already in training mode
    const isInTraining = await this.sessionManager.isInTrainingMode(conv.id);

    if (isInTraining) {
      // Continue in Rule Trainer Agent
      const response = await this.ruleTrainer.chat(
        userMessage,
        conv.id,
        tenant
      );

      return {
        conversationId: conv.id,
        response,
      };
    }

    // ========== NORMAL MODE: Resolve agent and proceed ==========
    // Add user message (with images if provided)
    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: this.buildMessageContent(userMessage, images),
      timestamp: new Date(),
    });

    // Resolve agent from DB (or null for legacy)
    const agent = await this.resolveAgent(agentSlug);
    const { systemPrompt, tools, agentName, maxTokens, temperature, maxCalls } =
      await this.buildPromptAndTools(agent, tenant, conv.id);

    const messages = this.buildAnthropicMessages(conv.messages);

    // Resolve model: agent config → tenant config → default
    const model = agent?.modeloPadrao
      ?? await this.tenantConfigManager.getModel(tenant.tenantId);

    let toolCallCount = 0;
    let currentMessages = messages;
    let finalResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const sqlQueries: string[] = [];

    // Agentic loop: keep going while the model wants to use tools
    while (true) {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      // Track token usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Collect text blocks and tool use blocks
      const textParts: string[] = [];
      const toolUseBlocks: Anthropic.ContentBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block);
        }
      }

      // If no tool calls or we hit the limit, we're done
      if (toolUseBlocks.length === 0 || toolCallCount >= maxCalls) {
        finalResponse = textParts.join('\n');
        break;
      }

      // Execute tool calls
      const assistantContent: Anthropic.ContentBlockParam[] = [
        ...response.content.map(block => {
          if (block.type === 'text') return { type: 'text' as const, text: block.text };
          if (block.type === 'tool_use') return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
          return block as Anthropic.ContentBlockParam;
        }),
      ];

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: assistantContent },
      ];

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;
        toolCallCount++;

        // Track tool usage
        toolsUsed.push(block.name);
        if (block.name === 'clickhouse_query' && (block.input as Record<string, unknown>).sql) {
          sqlQueries.push((block.input as Record<string, unknown>).sql as string);
        }

        // Validate tool is enabled for this agent
        if (agent && !isToolEnabledForAgent(block.name, agent)) {
          currentMessages = [
            ...currentMessages,
            {
              role: 'user' as const,
              content: [{
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify({ error: `Tool "${block.name}" não está habilitada para este agente.` }),
              }],
            },
          ];
          continue;
        }

        let result: string;
        try {
          result = await this.executeTool(block.name, block.input as Record<string, unknown>, tenant);
        } catch (err) {
          result = JSON.stringify({ error: 'Erro ao executar consulta' });
        }

        currentMessages = [
          ...currentMessages,
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: result,
              },
            ],
          },
        ];
      }

      // If we've hit the limit after this round, force a final response
      if (toolCallCount >= maxCalls) {
        // Continue the loop — the model will see tool results and generate text
      }
    }

    // Save assistant response
    this.conversations.addMessage(conv.id, {
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date(),
    });

    // Generate/update conversation summary (fire-and-forget)
    if (agent?.contextoConversas) {
      this.summaryGenerator.generateSummary(
        conv.id, tenant.tenantId, tenant.userEmail, agent.slug, conv.messages
      ).catch(err => console.error('[Iris] Summary generation failed:', err));
    }

    // Update user profile (fire-and-forget)
    if (agent?.perfilUsuario) {
      this.profileManager.updateProfile(
        tenant.tenantId, tenant.userEmail, agent.slug, conv.messages
      ).catch(err => console.error('[Iris] Profile update failed:', err));
    }

    // Track token usage
    await this.usageTracker.trackUsage({
      tenantId: tenant.tenantId,
      userEmail: tenant.userEmail,
      conversationId: conv.id,
      model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      endpoint: 'chat',
    });

    // Log conversation
    const responseTime = Date.now() - startTime;
    const messageId = await this.conversationLogger.log({
      agent: agentName,
      tenantId: tenant.tenantId,
      userEmail: tenant.userEmail,
      conversationId: conv.id,
      userQuestion: userMessage,
      responseSummary: finalResponse,
      responseType: this.conversationLogger.classifyResponseType(userMessage, finalResponse),
      toolsUsed,
      sqlQueries,
      keywords: this.conversationLogger.extractKeywords(userMessage),
      hasError: false,
      responseTimeMs: responseTime,
    });

    return { conversationId: conv.id, response: finalResponse, messageId };
  }

  // ── Chat Stream (SSE) ─────────────────────────────────────

  /**
   * Stream a response via SSE.
   */
  async chatStream(
    tenant: TenantContext,
    userMessage: string,
    conversationId: string | undefined,
    onChunk: StreamCallback,
    images?: ImageContent[],
    agentSlug?: string
  ): Promise<{ conversationId: string; messageId?: string }> {

    const conv = await this.conversations.getOrCreate(conversationId, tenant, agentSlug);

    // ========== RULE TRAINING MODE DETECTION ==========
    // 1. Check if user wants to enter training mode (explicit command)
    const isRuleTraining = userMessage.match(/^(regras?:|\/regras?)\s*/i);

    // 2. Check if user wants to modify/fix a rule (implicit intent in normal mode)
    const isRuleModification = !isRuleTraining && this.detectRuleModificationIntent(userMessage);

    if (isRuleTraining || isRuleModification) {
      // Extract message without prefix (for explicit command)
      const ruleMessage = isRuleTraining
        ? userMessage.replace(/^(regras?:|\/regras?)\s*/i, '').trim()
        : userMessage;

      // Activate training session
      await this.sessionManager.startTrainingSession(
        conv.id,
        tenant.tenantId,
        tenant.userEmail
      );

      // Redirect to Rule Trainer Agent (non-streaming)
      const response = await this.ruleTrainer.chat(
        ruleMessage || 'Iniciar treinamento de regras',
        conv.id,
        tenant
      );

      // Send response as chunk
      onChunk(response, false);
      onChunk('', true);

      return { conversationId: conv.id };
    }

    // 3. Check if conversation is already in training mode
    const isInTraining = await this.sessionManager.isInTrainingMode(conv.id);

    if (isInTraining) {
      // Continue in Rule Trainer Agent (non-streaming)
      const response = await this.ruleTrainer.chat(
        userMessage,
        conv.id,
        tenant
      );

      // Send response as chunk
      onChunk(response, false);
      onChunk('', true);

      return { conversationId: conv.id };
    }

    // ========== NORMAL MODE: Resolve agent and proceed ==========
    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: this.buildMessageContent(userMessage, images),
      timestamp: new Date(),
    });

    // Resolve agent from DB (or null for legacy)
    const agent = await this.resolveAgent(agentSlug);
    const { systemPrompt, tools, agentName, maxTokens, temperature, maxCalls } =
      await this.buildPromptAndTools(agent, tenant, conv.id);

    const messages = this.buildAnthropicMessages(conv.messages);

    // Resolve model: agent config → tenant config → default
    const model = agent?.modeloPadrao
      ?? await this.tenantConfigManager.getModel(tenant.tenantId);

    let toolCallCount = 0;
    let currentMessages = messages;
    let fullResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const sqlQueries: string[] = [];

    while (true) {
      // Check if we still have tool budget — if yes, use non-streaming for tool loop
      if (toolCallCount < maxCalls) {
        const response = await this.anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          tools,
          messages: currentMessages,
        });

        // Track token usage
        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;

        const textParts: string[] = [];
        const toolUseBlocks: Anthropic.ContentBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'text') textParts.push(block.text);
          else if (block.type === 'tool_use') toolUseBlocks.push(block);
        }

        if (toolUseBlocks.length === 0) {
          // Final response — stream it to the client
          const text = textParts.join('\n');
          onChunk(text, false);  // Send text first
          onChunk('', true);      // Then send done signal
          fullResponse = text;
          break;
        }

        // Execute tools and loop
        const assistantContent: Anthropic.ContentBlockParam[] = response.content.map(block => {
          if (block.type === 'text') return { type: 'text' as const, text: block.text };
          if (block.type === 'tool_use') return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
          return block as Anthropic.ContentBlockParam;
        });

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: assistantContent },
        ];

        for (const block of toolUseBlocks) {
          if (block.type !== 'tool_use') continue;
          toolCallCount++;

          // Track tool usage
          toolsUsed.push(block.name);
          if (block.name === 'clickhouse_query' && (block.input as Record<string, unknown>).sql) {
            sqlQueries.push((block.input as Record<string, unknown>).sql as string);
          }

          // Validate tool is enabled for this agent
          if (agent && !isToolEnabledForAgent(block.name, agent)) {
            currentMessages = [
              ...currentMessages,
              {
                role: 'user' as const,
                content: [{
                  type: 'tool_result' as const,
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: `Tool "${block.name}" não está habilitada para este agente.` }),
                }],
              },
            ];
            continue;
          }

          let result: string;
          try {
            result = await this.executeTool(block.name, block.input as Record<string, unknown>, tenant);
          } catch {
            result = JSON.stringify({ error: 'Erro ao executar consulta' });
          }

          currentMessages = [
            ...currentMessages,
            {
              role: 'user' as const,
              content: [{
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: result,
              }],
            },
          ];
        }

        continue;
      }

      // Final streaming response after tools exhausted
      const stream = this.anthropic.messages.stream({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: currentMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text;
          onChunk(event.delta.text, false);
        }
      }

      // Get final message with usage stats
      const finalMessage = await stream.finalMessage();
      totalInputTokens += finalMessage.usage.input_tokens;
      totalOutputTokens += finalMessage.usage.output_tokens;

      onChunk('', true);
      break;
    }

    this.conversations.addMessage(conv.id, {
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
    });

    // Generate/update conversation summary (fire-and-forget)
    if (agent?.contextoConversas) {
      this.summaryGenerator.generateSummary(
        conv.id, tenant.tenantId, tenant.userEmail, agent.slug, conv.messages
      ).catch(err => console.error('[Iris] Summary generation failed:', err));
    }

    // Update user profile (fire-and-forget)
    if (agent?.perfilUsuario) {
      this.profileManager.updateProfile(
        tenant.tenantId, tenant.userEmail, agent.slug, conv.messages
      ).catch(err => console.error('[Iris] Profile update failed:', err));
    }

    // Track token usage
    await this.usageTracker.trackUsage({
      tenantId: tenant.tenantId,
      userEmail: tenant.userEmail,
      conversationId: conv.id,
      model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      endpoint: 'stream',
    });

    // Log conversation
    const responseTime = Date.now() - startTime;
    const messageId = await this.conversationLogger.log({
      agent: agentName,
      tenantId: tenant.tenantId,
      userEmail: tenant.userEmail,
      conversationId: conv.id,
      userQuestion: userMessage,
      responseSummary: fullResponse,
      responseType: this.conversationLogger.classifyResponseType(userMessage, fullResponse),
      toolsUsed,
      sqlQueries,
      keywords: this.conversationLogger.extractKeywords(userMessage),
      hasError: false,
      responseTimeMs: responseTime,
    });

    return { conversationId: conv.id, messageId };
  }

  // ── Tool Execution ────────────────────────────────────────

  /**
   * Execute a tool call from the agent.
   */
  private async executeTool(
    name: string,
    input: Record<string, unknown>,
    tenant: TenantContext
  ): Promise<string> {
    if (name === 'clickhouse_query') {
      const sql = input.sql as string;
      console.log('[Iris Tool] clickhouse_query SQL:', sql);

      const rows = await this.clickhouse.query(sql, tenant);
      console.log('[Iris Tool] Result rows:', Array.isArray(rows) ? rows.length : 0);
      console.log('[Iris Tool] Result data:', JSON.stringify(rows.slice(0, 10), null, 2));

      // Auto-truncate large results to prevent context overflow
      if (rows.length > 100) {
        console.log(`[Iris Tool] WARNING: Query returned ${rows.length} rows, truncating to 100 + summary`);
        const truncated = rows.slice(0, 100);
        const summary = {
          _truncated: true,
          _total_rows: rows.length,
          _showing: 100,
          _message: `Resultado truncado. Mostrando apenas 100 de ${rows.length} linhas. Para análise de grupos grandes, use optimize_batch em vez de clickhouse_query.`
        };
        return JSON.stringify([summary, ...truncated]);
      }

      return JSON.stringify(rows);
    }

    if (name === 'generate_csv') {
      const columns = input.columns as string[];
      const data = input.data as Record<string, unknown>[];
      const filename = (input.filename as string) || 'exportacao';

      if (!columns?.length || !Array.isArray(data)) {
        return JSON.stringify({ error: 'columns e data são obrigatórios' });
      }

      const csvContent = generateCsv(columns, data);
      const csvId = this.csvStore.save(csvContent, `${filename}.csv`);

      // Generate absolute URL for download (backend server)
      const backendPort = process.env.PORT || '3030';
      const downloadUrl = `http://localhost:${backendPort}/api/iris/download/csv/${csvId}`;

      return JSON.stringify({
        success: true,
        url: downloadUrl,
        filename: `${filename}.csv`,
        rows: data.length,
        columns: columns.length,
      });
    }

    if (name === 'consultar_conhecimento') {
      const termo = input.termo as string;

      console.log('[Iris Tool] consultar_conhecimento:', termo);

      const knowledge = await this.loadKnowledgeBase(termo);

      if (knowledge.length === 0) {
        return JSON.stringify({
          termo,
          encontrado: false,
          message: `Conceito "${termo}" não encontrado na base de conhecimento.`,
          sugestao: 'Termos disponíveis: excesso, necessidade, cobertura, vencido, ruptura, curva_abc, balanceamento, capital_parado',
        });
      }

      return JSON.stringify({
        termo,
        encontrado: true,
        conhecimento: knowledge[0],
      });
    }

    if (name === 'adicionar_conhecimento') {
      const termo = input.termo as string;
      const definicao = input.definicao as string;
      const porque_importa = input.porque_importa as string;
      const categoria = input.categoria as string;
      const relacoes = (input.relacoes as string) || '';
      const exemplos = (input.exemplos as string) || '';
      const tags = (input.tags as string) || '';

      console.log('[Iris Tool] adicionar_conhecimento:', termo);

      // Insert knowledge into database
      const insertQuery = `
        INSERT INTO default.ia_base_conhecimento (
          termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant, ativo
        ) VALUES (
          '${termo.replace(/'/g, "\\'")}',
          '${definicao.replace(/'/g, "\\'")}',
          '${porque_importa.replace(/'/g, "\\'")}',
          '${relacoes.replace(/'/g, "\\'")}',
          '${exemplos.replace(/'/g, "\\'")}',
          '${categoria.replace(/'/g, "\\'")}',
          '${tags.replace(/'/g, "\\'")}',
          'global',
          true
        )
      `;

      await this.clickhouse.execute(insertQuery);

      return JSON.stringify({
        sucesso: true,
        termo,
        message: `Conhecimento "${termo}" adicionado com sucesso à base de conhecimento!`,
        categoria,
      });
    }

    if (name === 'optimize_batch') {
      const filters = input.filters as Record<string, unknown>;
      const constraints = input.constraints as Record<string, unknown> | undefined;
      const customColumns = input.columns as string[] | undefined;

      console.log('[Iris Tool] optimize_batch filters:', filters);
      if (customColumns) {
        console.log('[Iris Tool] Custom columns requested:', customColumns);
      }

      // Fetch data from ClickHouse based on filters
      const products = await this.fetchProductsForOptimization(filters, tenant);

      if (products.length === 0) {
        return JSON.stringify({
          error: 'Nenhum produto encontrado com os filtros especificados',
          filters,
        });
      }

      console.log('[Iris Tool] optimize_batch products found:', products.length);

      // Load active rules for this tenant
      const rules = await this.loadActiveRules(tenant.tenantId);
      console.log('[Iris Tool] Active rules loaded:', rules.length);

      // Call Python optimizer with rules
      const result = await this.runPythonOptimizer(products, constraints, rules);

      console.log('[Iris Tool] Python result type:', typeof result);
      console.log('[Iris Tool] Has transfers?', 'transfers' in result);
      console.log('[Iris Tool] Transfers length:', (result as any).transfers?.length || 0);

      // Auto-generate CSV for large results (> 1000 transfers)
      if (result.transfers && Array.isArray(result.transfers) && result.transfers.length > 1000) {
        console.log(`[Iris Tool] Auto-generating CSV for ${result.transfers.length} transfers`);

        try {

        // Define columns - use custom if provided, otherwise all available
        const allColumns = [
          'cdprod', 'descricao', 'curva', 'linha',
          'filial_origem', 'filial_destino',
          'qtexcesso_origem', 'qtnecessidade_destino', 'qt_transferida',
          'vlrcusto', 'valor_gerado',
          'cobertura_inicial_origem', 'cobertura_final_origem',
          'cobertura_inicial_destino', 'cobertura_final_destino',
        ];
        const columns = customColumns || allColumns;
        console.log('[Iris Tool] Using columns:', columns);

          const csvContent = generateCsv(columns, result.transfers);
          console.log('[Iris Tool] CSV generated, size:', csvContent.length, 'bytes');

          const csvId = this.csvStore.save(csvContent, `balanceamento_${filters.linha || filters.fabricante || 'grupo'}.csv`);
          console.log('[Iris Tool] CSV saved with ID:', csvId);

          // Generate absolute URL for download (backend server)
          const backendPort = process.env.PORT || '3030';
          const downloadUrl = `http://localhost:${backendPort}/api/iris/download/csv/${csvId}`;
          console.log('[Iris Tool] Download URL:', downloadUrl);

          return JSON.stringify({
            auto_csv: true,
            csv_url: downloadUrl,
            summary: result.summary,
            message: `✅ Resultado completo gerado! ${result.transfers.length} transferências disponíveis para download.`,
            transfers_sample: result.transfers.slice(0, 20), // Mostra apenas 20 primeiras
          });
        } catch (error) {
          console.error('[Iris Tool] Error generating CSV:', error);
          return JSON.stringify({
            error: 'Erro ao gerar CSV: ' + (error instanceof Error ? error.message : String(error)),
            summary: result.summary,
          });
        }
      }

      // For moderate results (50-1000), truncate to prevent overflow
      if (result.transfers && Array.isArray(result.transfers) && result.transfers.length > 50) {
        console.log(`[Iris Tool] Truncating ${result.transfers.length} transfers to 50 + summary`);
        return JSON.stringify({
          _truncated: true,
          _total_transfers: result.transfers.length,
          _message: `⚠️ Resultado truncado. Mostrando 50 de ${result.transfers.length} transferências. Peça para gerar CSV completo.`,
          summary: result.summary,
          transfers_sample: result.transfers.slice(0, 50),
        });
      }

      return JSON.stringify(result);
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Convert our ChatMessage[] to Anthropic's message format.
   */
  private buildAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Detect if user wants to modify/fix/redo a rule in normal mode.
   */
  private detectRuleModificationIntent(message: string): boolean {
    const lower = message.toLowerCase();
    const patterns = [
      /refaz(?:er|a)?\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /corrig(?:ir|a|e)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /alter(?:ar|e|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /atualiz(?:ar|e|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /mud(?:ar|e|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /edit(?:ar|e|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /desativ(?:ar|e|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /remov(?:er|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /exclu(?:ir|a)\s+(?:a|uma|essa|esta|aquela)?\s*regra/,
      /regra.*(errada|incorreta|equivocada|wrong)/,
      /regra.*(deve ser|deveria ser|precisa ser)/,
      /preciso.*(alterar|mudar|corrigir|atualizar|criar|adicionar).*regra/,
      /quero.*(alterar|mudar|corrigir|atualizar|criar|adicionar).*regra/,
    ];
    return patterns.some(p => p.test(lower));
  }

  /** Load or update balancing rules at runtime */
  setRules(rules: BalancingRule[]): void {
    this.rules = rules;
  }

  /** Clean up resources */
  async destroy(): Promise<void> {
    this.csvStore.destroy();
    await this.clickhouse.close();
  }

  /**
   * Load knowledge base for enriching explanations
   */
  private async loadKnowledgeBase(termo?: string): Promise<Record<string, unknown>[]> {
    const whereConditions = ["ativo = true", "tenant = 'global'"];

    if (termo) {
      whereConditions.push(`lower(termo) = lower('${termo}')`);
    }

    const query = `
      SELECT
        termo,
        definicao,
        porque_importa,
        relacoes,
        exemplos,
        categoria,
        tags
      FROM ia_base_conhecimento
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY termo ASC
      LIMIT 50
    `;

    try {
      const rows = await this.clickhouse.query(query, { tenantId: 'global', userEmail: '' });
      return rows;
    } catch (error) {
      console.warn('[Iris] Failed to load knowledge:', error);
      return [];
    }
  }

  /**
   * Load active rules from database for Python optimizer
   */
  private async loadActiveRules(tenantId: string): Promise<Record<string, unknown>[]> {
    const query = `
      SELECT
        id,
        tipo,
        prioridade,
        alvo,
        condicao,
        acao,
        texto
      FROM ia_regras_balanceamento
      WHERE status = 'ativo'
        AND (tenant = '${tenantId}' OR tenant = 'null')
      ORDER BY prioridade ASC, criado_em ASC
      LIMIT 100
    `;

    try {
      const rows = await this.clickhouse.query(query, { tenantId, userEmail: '' });
      return rows;
    } catch (error) {
      console.warn('[Iris] Failed to load rules:', error);
      return [];
    }
  }

  /**
   * Fetch products for batch optimization based on filters.
   */
  private async fetchProductsForOptimization(
    filters: Record<string, unknown>,
    tenant: TenantContext
  ): Promise<Record<string, unknown>[]> {
    const whereConditions = [`tenant = '${tenant.tenantId}'`];
    whereConditions.push('filialdeposito <> 1');

    // Build filters dynamically (case-insensitive)
    if (filters.linha) whereConditions.push(`upper(linha) = upper('${filters.linha}')`);
    if (filters.fabricante) whereConditions.push(`upper(nomefabricante) = upper('${filters.fabricante}')`);
    if (filters.curva) whereConditions.push(`upper(curva) = upper('${filters.curva}')`);
    if (filters.produtos && Array.isArray(filters.produtos)) {
      whereConditions.push(`cdprod IN (${(filters.produtos as number[]).join(',')})`);
    }

    // Get latest date first
    const dateQuery = `
      SELECT MAX(dtcarga) AS max_date
      FROM default.ia_fato_balanceamento
      WHERE ${whereConditions.join(' AND ')}
    `;
    const dateResult = await this.clickhouse.query(dateQuery, tenant);
    const maxDate = dateResult[0]?.max_date;

    if (!maxDate) {
      return [];
    }

    whereConditions.push(`dtcarga = '${maxDate}'`);

    const sql = `
      SELECT
        cdprod, cdFilial, descricao, curva, nomefabricante,
        qtexcesso, qtnecessidade, qtestoque, cobertura,
        mediaf_un, vlrcusto, linha
      FROM default.ia_fato_balanceamento
      WHERE ${whereConditions.join(' AND ')}
        AND (qtexcesso > 0 OR qtnecessidade > 0)
      ORDER BY cdprod, cdFilial
    `;

    return await this.clickhouse.query(sql, tenant);
  }

  /**
   * Run Python optimizer subprocess and return results.
   * Uses temporary file for large datasets to avoid command-line argument size limits.
   */
  private async runPythonOptimizer(
    products: Record<string, unknown>[],
    constraints?: Record<string, unknown>,
    rules?: Record<string, unknown>[]
  ): Promise<Record<string, unknown>> {
    const { spawn } = await import('child_process');
    const { writeFileSync, unlinkSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    // Create temporary input file
    const tempInputFile = join(tmpdir(), `iris-optimizer-${Date.now()}.json`);

    try {
      // Package all data together
      const inputData = {
        products,
        rules: rules || [],
        constraints: constraints || {},
      };

      writeFileSync(tempInputFile, JSON.stringify(inputData));
      console.log(`[Iris Tool] Writing ${products.length} products + ${rules?.length || 0} rules to temp file: ${tempInputFile}`);

      return await new Promise((resolve, reject) => {
        const python = spawn('python', [
          'optimizer/optimize.py',
          tempInputFile,
        ]);

        let output = '';
        let errorOutput = '';

        python.stdout.on('data', (data) => {
          output += data.toString();
        });

        python.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        python.on('close', (code) => {
          // Clean up temp file
          try {
            unlinkSync(tempInputFile);
          } catch (e) {
            console.warn('[Iris Tool] Failed to delete temp file:', tempInputFile);
          }

          if (code !== 0) {
            reject(new Error(`Python optimizer failed: ${errorOutput}`));
          } else {
            try {
              resolve(JSON.parse(output));
            } catch (e) {
              reject(new Error(`Failed to parse optimizer output: ${output}`));
            }
          }
        });
      });
    } catch (error) {
      // Clean up on error
      try {
        unlinkSync(tempInputFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
