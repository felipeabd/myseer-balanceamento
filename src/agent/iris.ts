import OpenAI from 'openai';
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
  private openai: OpenAI;
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
    this.openai = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000 });
    this.model = config.openaiModel ?? 'gpt-4o-mini';
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
   * Handle OpenAI API errors with user-friendly messages in Portuguese.
   */
  private handleApiError(err: unknown): string {
    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      return 'O serviço de IA demorou demais para responder. Por favor, tente novamente em alguns instantes.';
    }
    if (err instanceof OpenAI.RateLimitError) {
      return 'O serviço de IA está com muitas requisições no momento. Aguarde alguns segundos e tente novamente.';
    }
    if (err instanceof OpenAI.AuthenticationError) {
      return 'Erro de autenticação com o serviço de IA. Entre em contato com o suporte técnico.';
    }
    if (err instanceof OpenAI.APIError) {
      console.error('[IrisAgent] OpenAI API error:', err.message);
      return 'Ocorreu um erro no serviço de IA. Por favor, tente novamente.';
    }
    console.error('[IrisAgent] Unexpected error:', err);
    return 'Ocorreu um erro inesperado. Por favor, tente novamente.';
  }

  /**
   * Process a user message and return the agent's response.
   * Handles the full agentic loop: LLM -> tool call -> LLM -> response.
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
    const messages = this.buildOpenAIMessages(systemPrompt, conv.messages);

    let toolCallCount = 0;
    let currentMessages = messages;
    let finalResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const sqlQueries: string[] = [];

    // Agentic loop: keep going while the model wants to use tools
    try {
      while (true) {
        const response = await this.openai.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          tools: agentTools,
          messages: currentMessages,
        });

        // Track token usage
        totalInputTokens += response.usage?.prompt_tokens ?? 0;
        totalOutputTokens += response.usage?.completion_tokens ?? 0;

        const choice = response.choices[0];
        const message = choice.message;

        // If no tool calls or we hit the limit, we're done
        if (!message.tool_calls?.length || toolCallCount >= this.maxToolCalls) {
          finalResponse = message.content ?? '';
          break;
        }

        // Add the assistant message with tool_calls to the conversation
        currentMessages = [
          ...currentMessages,
          message,
        ];

        // Execute tool calls and add results
        for (const toolCall of message.tool_calls) {
          toolCallCount++;

          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          // Track tool usage
          toolsUsed.push(toolName);
          if (toolName === 'clickhouse_query' && toolArgs.sql) {
            sqlQueries.push(toolArgs.sql);
          }

          let result: string;
          try {
            result = await this.executeTool(toolName, toolArgs, tenant);
          } catch (err) {
            result = JSON.stringify({ error: 'Erro ao executar consulta' });
          }

          currentMessages = [
            ...currentMessages,
            {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: result,
            },
          ];
        }

        // If we've hit the limit after this round, force a final response
        if (toolCallCount >= this.maxToolCalls) {
          // Continue the loop — the model will see tool results and generate text
        }
      }
    } catch (err) {
      finalResponse = this.handleApiError(err);
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
    const messages = this.buildOpenAIMessages(systemPrompt, conv.messages);

    let toolCallCount = 0;
    let currentMessages = messages;
    let fullResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const sqlQueries: string[] = [];

    try {
      while (true) {
        // Check if we still have tool budget — if yes, use non-streaming for tool loop
        if (toolCallCount < this.maxToolCalls) {
          const response = await this.openai.chat.completions.create({
            model: this.model,
            max_tokens: 4096,
            tools: agentTools,
            messages: currentMessages,
          });

          // Track token usage
          totalInputTokens += response.usage?.prompt_tokens ?? 0;
          totalOutputTokens += response.usage?.completion_tokens ?? 0;

          const choice = response.choices[0];
          const message = choice.message;

          if (!message.tool_calls?.length) {
            // Final response — stream it to the client
            const text = message.content ?? '';
            onChunk(text, false);
            onChunk('', true);
            fullResponse = text;
            break;
          }

          // Add the assistant message with tool_calls
          currentMessages = [
            ...currentMessages,
            message,
          ];

          // Execute tools and loop
          for (const toolCall of message.tool_calls) {
            toolCallCount++;

            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            // Track tool usage
            toolsUsed.push(toolName);
            if (toolName === 'clickhouse_query' && toolArgs.sql) {
              sqlQueries.push(toolArgs.sql);
            }

            let result: string;
            try {
              result = await this.executeTool(toolName, toolArgs, tenant);
            } catch {
              result = JSON.stringify({ error: 'Erro ao executar consulta' });
            }

            currentMessages = [
              ...currentMessages,
              {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                content: result,
              },
            ];
          }

          continue;
        }

        // Final streaming response after tools exhausted
        const stream = await this.openai.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          messages: currentMessages,
          stream: true,
          stream_options: { include_usage: true },
        });

        for await (const chunk of stream) {
          // Usage comes in the final chunk
          if (chunk.usage) {
            totalInputTokens += chunk.usage.prompt_tokens;
            totalOutputTokens += chunk.usage.completion_tokens;
          }

          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullResponse += delta.content;
            onChunk(delta.content, false);
          }
        }

        onChunk('', true);
        break;
      }
    } catch (err) {
      fullResponse = this.handleApiError(err);
      onChunk(fullResponse, false);
      onChunk('', true);
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

      // TEMPORARY: Override tenant with fixed tenant ID for development
      const fixedTenant = this.getFixedTenant(tenant);

      const rows = await this.clickhouse.query(sql, fixedTenant);
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
      const downloadUrl = `${this.baseUrl}/api/iris/download/csv/${csvId}`;

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
   * Convert our ChatMessage[] to OpenAI's message format, with system prompt as first message.
   */
  private buildOpenAIMessages(systemPrompt: string, messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];
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
