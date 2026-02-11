import Anthropic from '@anthropic-ai/sdk';
import { ClickHouseService } from '../clickhouse/client';
import { buildSystemPrompt } from './prompt';
import { agentTools } from './tools';
import { ConversationManager } from '../conversation/manager';
import { UsageTracker } from '../tracking/usage-tracker';
import { ConversationLogger } from '../tracking/conversation-logger';
import { SessionManager } from '../rules/session-manager';
import { RuleTrainerAgent } from './rule-trainer';
import { LoadRulesSkill } from '../rules/load-rules-skill';
import { CsvStore } from '../csv/csv-store';
import { generateCsv } from '../csv/csv-generator';
import {
  IrisConfig,
  TenantContext,
  BalancingRule,
  ChatMessage,
  StreamCallback,
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
  private sessionManager: SessionManager;
  private ruleTrainer: RuleTrainerAgent;
  private loadRulesSkill: LoadRulesSkill;
  private csvStore: CsvStore;
  private baseUrl: string;

  // TEMPORARY: Fixed tenant for development until multi-tenant filtering is properly implemented
  private readonly FIXED_TENANT_ID = '33F6E320-F59E-4E43-99C2-2D6748A64B04';
  private readonly AGENT_NAME = 'iris_balanceamento';

  /** Get tenant context with fixed tenant ID */
  private getFixedTenant(tenant: TenantContext): TenantContext {
    return {
      ...tenant,
      tenantId: this.FIXED_TENANT_ID,
    };
  }

  constructor(config: IrisConfig) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.anthropicModel ?? 'claude-haiku-4-5-20251001';
    this.clickhouse = new ClickHouseService(config.clickhouse);
    this.conversations = new ConversationManager();
    this.rules = config.rules ?? [];
    this.maxToolCalls = config.maxToolCalls ?? 3;
    this.usageTracker = new UsageTracker(this.clickhouse);
    this.conversationLogger = new ConversationLogger(this.clickhouse);
    this.sessionManager = new SessionManager(this.clickhouse);
    this.ruleTrainer = new RuleTrainerAgent(this.clickhouse, this.sessionManager, this.conversations);
    this.loadRulesSkill = new LoadRulesSkill(this.clickhouse);
    this.csvStore = new CsvStore();
    this.baseUrl = config.baseUrl ?? `http://localhost:${process.env.PORT ?? 3030}`;
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

  /**
   * Process a user message and return the agent's response.
   * Handles the full agentic loop: LLM → tool call → LLM → response.
   */
  async chat(
    tenant: TenantContext,
    userMessage: string,
    conversationId?: string
  ): Promise<{ conversationId: string; response: string }> {
    const fixedTenant = this.getFixedTenant(tenant);
    const conv = this.conversations.getOrCreate(conversationId, fixedTenant);

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
        fixedTenant.tenantId,
        tenant.userEmail
      );

      // Redirect to Rule Trainer Agent
      const response = await this.ruleTrainer.chat(
        ruleMessage || 'Iniciar treinamento de regras',
        conv.id,
        fixedTenant
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
        fixedTenant
      );

      return {
        conversationId: conv.id,
        response,
      };
    }

    // ========== NORMAL MODE: Load rules and proceed ==========
    // Add user message
    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Load active rules and inject into prompt
    const rulesPrompt = await this.loadRulesSkill.execute(fixedTenant.tenantId);
    const systemPrompt = buildSystemPrompt(fixedTenant, this.rules) + rulesPrompt;
    const messages = this.buildAnthropicMessages(conv.messages);

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
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: agentTools,
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
      if (toolUseBlocks.length === 0 || toolCallCount >= this.maxToolCalls) {
        finalResponse = textParts.join('\n');
        break;
      }

      // Execute tool calls
      const toolResults: Anthropic.MessageParam[] = [];
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
      if (toolCallCount >= this.maxToolCalls) {
        // Continue the loop — the model will see tool results and generate text
      }
    }

    // Save assistant response
    this.conversations.addMessage(conv.id, {
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date(),
    });

    // Track token usage (use fixed tenant for consistency with queries)
    await this.usageTracker.trackUsage({
      tenantId: fixedTenant.tenantId,
      userEmail: tenant.userEmail,
      conversationId: conv.id,
      model: this.model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      endpoint: 'chat',
    });

    // Log conversation
    const responseTime = Date.now() - startTime;
    await this.conversationLogger.log({
      agent: this.AGENT_NAME,
      tenantId: fixedTenant.tenantId,
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

    return { conversationId: conv.id, response: finalResponse };
  }

  /**
   * Stream a response via SSE.
   */
  async chatStream(
    tenant: TenantContext,
    userMessage: string,
    conversationId: string | undefined,
    onChunk: StreamCallback
  ): Promise<{ conversationId: string }> {
    const fixedTenant = this.getFixedTenant(tenant);
    const conv = this.conversations.getOrCreate(conversationId, fixedTenant);

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
        fixedTenant.tenantId,
        tenant.userEmail
      );

      // Redirect to Rule Trainer Agent (non-streaming, use original tenant for conversation access)
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
      // Continue in Rule Trainer Agent (non-streaming, use original tenant for conversation access)
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

    // ========== NORMAL MODE: Load rules and proceed ==========
    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Load active rules and inject into prompt
    const rulesPrompt = await this.loadRulesSkill.execute(fixedTenant.tenantId);
    const systemPrompt = buildSystemPrompt(fixedTenant, this.rules) + rulesPrompt;
    const messages = this.buildAnthropicMessages(conv.messages);

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
      if (toolCallCount < this.maxToolCalls) {
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: agentTools,
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
        model: this.model,
        max_tokens: 4096,
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

    // Track token usage (use fixed tenant for consistency with queries)
    await this.usageTracker.trackUsage({
      tenantId: fixedTenant.tenantId,
      userEmail: tenant.userEmail,
      conversationId: conv.id,
      model: this.model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      endpoint: 'stream',
    });

    // Log conversation
    const responseTime = Date.now() - startTime;
    await this.conversationLogger.log({
      agent: this.AGENT_NAME,
      tenantId: fixedTenant.tenantId,
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

    return { conversationId: conv.id };
  }

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

      // TEMPORARY: Override tenant with fixed tenant ID for development
      const fixedTenant = this.getFixedTenant(tenant);

      const rows = await this.clickhouse.query(sql, fixedTenant);
      console.log('[Iris Tool] Result rows:', Array.isArray(rows) ? rows.length : 0);
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
      const downloadUrl = `/api/iris/download/csv/${csvId}`;

      return JSON.stringify({
        success: true,
        url: downloadUrl,
        filename: `${filename}.csv`,
        rows: data.length,
        columns: columns.length,
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

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
}
