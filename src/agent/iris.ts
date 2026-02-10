import Anthropic from '@anthropic-ai/sdk';
import { ClickHouseService } from '../clickhouse/client';
import { buildSystemPrompt } from './prompt';
import { agentTools } from './tools';
import { ConversationManager } from '../conversation/manager';
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

  constructor(config: IrisConfig) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.anthropicModel ?? 'claude-sonnet-4-5-20250929';
    this.clickhouse = new ClickHouseService(config.clickhouse);
    this.conversations = new ConversationManager();
    this.rules = config.rules ?? [];
    this.maxToolCalls = config.maxToolCalls ?? 2;
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
    const conv = this.conversations.getOrCreate(conversationId, tenant);

    // Add user message
    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const systemPrompt = buildSystemPrompt(tenant, this.rules);
    const messages = this.buildAnthropicMessages(conv.messages);

    let toolCallCount = 0;
    let currentMessages = messages;
    let finalResponse = '';

    // Agentic loop: keep going while the model wants to use tools
    while (true) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: agentTools,
        messages: currentMessages,
      });

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
    const conv = this.conversations.getOrCreate(conversationId, tenant);

    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const systemPrompt = buildSystemPrompt(tenant, this.rules);
    const messages = this.buildAnthropicMessages(conv.messages);

    let toolCallCount = 0;
    let currentMessages = messages;
    let fullResponse = '';

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

        const textParts: string[] = [];
        const toolUseBlocks: Anthropic.ContentBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'text') textParts.push(block.text);
          else if (block.type === 'tool_use') toolUseBlocks.push(block);
        }

        if (toolUseBlocks.length === 0) {
          // Final response — stream it to the client
          const text = textParts.join('\n');
          onChunk(text, true);
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
      onChunk('', true);
      break;
    }

    this.conversations.addMessage(conv.id, {
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
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
      const rows = await this.clickhouse.query(sql, tenant);
      return JSON.stringify(rows);
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

  /** Load or update balancing rules at runtime */
  setRules(rules: BalancingRule[]): void {
    this.rules = rules;
  }

  /** Clean up resources */
  async destroy(): Promise<void> {
    await this.clickhouse.close();
  }
}
