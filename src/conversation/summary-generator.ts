import Anthropic from '@anthropic-ai/sdk';
import { ClickHouseService } from '../clickhouse/client';
import { ChatMessage, MessageContent, TextContent } from '../types';

/** Escape single quotes for ClickHouse SQL */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Extract plain text from MessageContent */
function contentToText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  const textBlock = content.find(b => b.type === 'text') as TextContent | undefined;
  return textBlock?.text ?? '';
}

/** A stored conversation summary */
export interface ConversationSummaryRecord {
  conversaId: string;
  resumo: string;
  topicos: string[];
  atualizadoEm: string;
}

const SUMMARY_PROMPT = `Resuma esta conversa em 2-3 frases curtas focando em:
1. Topicos discutidos (produtos, filiais, metricas, decisoes)
2. Conclusoes ou resultados alcancados
3. Dados ou numeros chave mencionados

Responda APENAS em JSON valido, sem markdown:
{"resumo": "...", "topicos": ["topico1", "topico2"]}`;

/**
 * Generates and stores LLM-based conversation summaries.
 * Used for cross-conversation context injection.
 */
export class SummaryGenerator {
  private clickhouse: ClickHouseService;
  private anthropic: Anthropic;
  private tablesReady = false;
  private initPromise: Promise<void>;

  constructor(clickhouse: ClickHouseService, anthropic: Anthropic) {
    this.clickhouse = clickhouse;
    this.anthropic = anthropic;
    this.initPromise = this.initTable();
  }

  // ── Table Init ─────────────────────────────────────────

  private async initTable(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_resumos_conversas (
          conversa_id String,
          tenant_id String,
          email_usuario String,
          agent_slug String DEFAULT '',
          resumo String DEFAULT '',
          topicos Array(String) DEFAULT [],
          num_mensagens UInt32 DEFAULT 0,
          atualizado_em DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(atualizado_em)
        ORDER BY (tenant_id, email_usuario, conversa_id)
      `);
      this.tablesReady = true;
      console.log('[SummaryGenerator] ClickHouse table ready');
    } catch (err) {
      console.error('[SummaryGenerator] Failed to init table:', err);
    }
  }

  private async ensureReady(): Promise<boolean> {
    if (this.tablesReady) return true;
    await this.initPromise;
    return this.tablesReady;
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Generate and store a summary for a conversation.
   * Skips if summary is already fresh enough (< 4 new messages).
   * Skips conversations with fewer than 2 exchanges.
   */
  async generateSummary(
    conversationId: string,
    tenantId: string,
    userEmail: string,
    agentSlug: string,
    messages: ChatMessage[]
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    // Skip very short conversations (just greetings)
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (userMessages.length < 1 || assistantMessages.length < 1) return;

    // Check if existing summary is fresh enough
    const existing = await this.getExistingSummary(conversationId);
    if (existing && messages.length - existing.numMensagens < 4) return;

    // Build conversation text for summarization
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Agente'}: ${contentToText(m.content).substring(0, 500)}`)
      .join('\n');

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SUMMARY_PROMPT,
        messages: [{ role: 'user', content: conversationText }],
      });

      // Extract text from response
      const responseText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

      // Parse JSON response
      let resumo = '';
      let topicos: string[] = [];
      try {
        const parsed = JSON.parse(responseText);
        resumo = parsed.resumo || '';
        topicos = Array.isArray(parsed.topicos) ? parsed.topicos : [];
      } catch {
        // If JSON parse fails, use raw text as summary
        resumo = responseText.substring(0, 500);
      }

      if (!resumo) return;

      // Store in ClickHouse (upsert via ReplacingMergeTree)
      const topicosStr = topicos.length > 0
        ? `[${topicos.map(t => `'${esc(t)}'`).join(', ')}]`
        : '[]';

      await this.clickhouse.execute(`
        INSERT INTO ia_resumos_conversas (
          conversa_id, tenant_id, email_usuario, agent_slug,
          resumo, topicos, num_mensagens, atualizado_em
        ) VALUES (
          '${esc(conversationId)}',
          '${esc(tenantId)}',
          '${esc(userEmail)}',
          '${esc(agentSlug)}',
          '${esc(resumo)}',
          ${topicosStr},
          ${messages.length},
          now()
        )
      `);

      console.log(`[SummaryGenerator] Summary generated for conversation ${conversationId}`);
    } catch (err) {
      console.error('[SummaryGenerator] Failed to generate summary:', err);
    }
  }

  /**
   * Fetch the N most recent summaries for a user+agent.
   * Excludes the current conversation.
   */
  async getRecentSummaries(
    tenantId: string,
    userEmail: string,
    agentSlug: string,
    currentConversationId: string,
    limit: number
  ): Promise<ConversationSummaryRecord[]> {
    if (!(await this.ensureReady())) return [];

    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT conversa_id, resumo, topicos, atualizado_em
        FROM ia_resumos_conversas FINAL
        WHERE tenant_id = '${esc(tenantId)}'
          AND email_usuario = '${esc(userEmail)}'
          AND agent_slug = '${esc(agentSlug)}'
          AND conversa_id != '${esc(currentConversationId)}'
          AND resumo != ''
        ORDER BY atualizado_em DESC
        LIMIT ${limit}
      `);

      return rows.map(r => ({
        conversaId: r.conversa_id as string,
        resumo: r.resumo as string,
        topicos: Array.isArray(r.topicos) ? (r.topicos as string[]) : [],
        atualizadoEm: r.atualizado_em as string,
      }));
    } catch (err) {
      console.error('[SummaryGenerator] Failed to fetch summaries:', err);
      return [];
    }
  }

  // ── Private ────────────────────────────────────────────

  private async getExistingSummary(conversationId: string): Promise<{ numMensagens: number } | null> {
    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT num_mensagens
        FROM ia_resumos_conversas FINAL
        WHERE conversa_id = '${esc(conversationId)}'
        LIMIT 1
      `);
      if (rows.length === 0) return null;
      return { numMensagens: Number(rows[0].num_mensagens) };
    } catch {
      return null;
    }
  }
}

/**
 * Format summaries for injection into the system prompt.
 */
export function formatSummariesForPrompt(summaries: ConversationSummaryRecord[]): string {
  if (summaries.length === 0) return '';

  const items = summaries
    .map((s, i) => `${i + 1}. ${s.resumo}`)
    .join('\n');

  return `## CONTEXTO DE CONVERSAS ANTERIORES
O usuario ja conversou com voce anteriormente. Aqui estao os resumos das ultimas conversas para contexto:

${items}

Use este contexto para:
- Evitar repetir informacoes ja discutidas
- Referenciar decisoes anteriores quando relevante
- Manter continuidade no atendimento
- NAO mencionar explicitamente "nas conversas anteriores" a menos que seja natural`;
}
