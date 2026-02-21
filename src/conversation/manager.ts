import { v4 as uuidv4 } from 'uuid';
import { Conversation, ChatMessage, TenantContext, MessageContent, TextContent } from '../types';
import { ClickHouseService } from '../clickhouse/client';

/** Escape single quotes for ClickHouse SQL */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Extract plain text from MessageContent (handles multimodal) */
function contentToText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  const textBlock = content.find(b => b.type === 'text') as TextContent | undefined;
  return textBlock?.text ?? '';
}

/** Format Date to ClickHouse DateTime string */
function toDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/** Summary returned by listByUser (no full messages) */
export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
}

/**
 * Conversation manager with ClickHouse persistence and in-memory cache.
 *
 * - Active conversations are kept in memory for fast access during the agentic loop.
 * - All writes are persisted to ClickHouse (fire-and-forget).
 * - On cache miss, conversations are loaded from ClickHouse.
 */
export class ConversationManager {
  private cache = new Map<string, Conversation>();
  private maxMessagesPerConversation = 50;
  private clickhouse: ClickHouseService;
  private tablesReady = false;
  private initPromise: Promise<void>;

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
    this.initPromise = this.initTables();
  }

  // ── Table Initialization ─────────────────────────────────

  private async initTables(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_conversas (
          conversa_id String,
          tenant_id String,
          email_usuario String,
          titulo String DEFAULT '',
          ultima_mensagem String DEFAULT '',
          criada_em DateTime DEFAULT now(),
          atualizada_em DateTime DEFAULT now(),
          ativo UInt8 DEFAULT 1
        ) ENGINE = ReplacingMergeTree(atualizada_em)
        ORDER BY (tenant_id, conversa_id)
      `);

      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_mensagens (
          conversa_id String,
          tenant_id String,
          indice UInt32,
          role String,
          conteudo String,
          criada_em DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (tenant_id, conversa_id, indice)
      `);

      this.tablesReady = true;
      console.log('[ConversationManager] ClickHouse tables ready');
    } catch (err) {
      console.error('[ConversationManager] Failed to init tables:', err);
    }
  }

  private async ensureReady(): Promise<boolean> {
    if (this.tablesReady) return true;
    await this.initPromise;
    return this.tablesReady;
  }

  // ── Public API ───────────────────────────────────────────

  /** Get existing conversation (from cache or DB) or create a new one */
  async getOrCreate(id: string | undefined, tenant: TenantContext): Promise<Conversation> {
    // 1. Check cache
    if (id && this.cache.has(id)) {
      const conv = this.cache.get(id)!;
      if (conv.tenantId !== tenant.tenantId) {
        conv.tenantId = tenant.tenantId;
        conv.userEmail = tenant.userEmail;
      }
      return conv;
    }

    // 2. Try loading from ClickHouse
    if (id && await this.ensureReady()) {
      try {
        const conv = await this.loadFromDB(id);
        if (conv) {
          this.cache.set(id, conv);
          return conv;
        }
      } catch (err) {
        console.error('[ConversationManager] Failed to load from DB:', err);
      }
    }

    // 3. Create new conversation
    const conversation: Conversation = {
      id: id ?? uuidv4(),
      tenantId: tenant.tenantId,
      userEmail: tenant.userEmail,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cache.set(conversation.id, conversation);

    // Persist to DB (fire-and-forget)
    this.persistNewConversation(conversation).catch(err => {
      console.error('[ConversationManager] Failed to persist new conversation:', err);
    });

    return conversation;
  }

  /** Add a message to a conversation (sync in-memory, async DB persist) */
  addMessage(conversationId: string, message: ChatMessage): void {
    const conv = this.cache.get(conversationId);
    if (!conv) throw new Error('Conversation not found');

    const messageIndex = conv.messages.length;
    conv.messages.push(message);
    conv.updatedAt = new Date();

    // Trim old messages to avoid unbounded context growth
    if (conv.messages.length > this.maxMessagesPerConversation) {
      conv.messages = conv.messages.slice(-this.maxMessagesPerConversation);
    }

    // Persist to DB (fire-and-forget)
    this.persistMessage(conv, messageIndex, message).catch(err => {
      console.error('[ConversationManager] Failed to persist message:', err);
    });
  }

  /** Get a conversation by ID (cache first, then DB) */
  async get(id: string): Promise<Conversation | undefined> {
    if (this.cache.has(id)) return this.cache.get(id);

    if (await this.ensureReady()) {
      try {
        const conv = await this.loadFromDB(id);
        if (conv) {
          this.cache.set(id, conv);
          return conv;
        }
      } catch (err) {
        console.error('[ConversationManager] Failed to load conversation:', err);
      }
    }

    return undefined;
  }

  /** List conversations for a tenant/user (from DB for completeness) */
  async listByUser(tenantId: string, userEmail: string): Promise<ConversationSummary[]> {
    if (await this.ensureReady()) {
      try {
        const rows = await this.clickhouse.rawQuery(`
          SELECT conversa_id, titulo, ultima_mensagem, atualizada_em
          FROM ia_conversas FINAL
          WHERE tenant_id = '${esc(tenantId)}'
            AND email_usuario = '${esc(userEmail)}'
            AND ativo = 1
          ORDER BY atualizada_em DESC
          LIMIT 100
        `);

        return rows.map(r => ({
          id: r.conversa_id as string,
          title: (r.titulo as string) || 'Nova conversa',
          lastMessage: (r.ultima_mensagem as string) || '',
          updatedAt: new Date(r.atualizada_em as string),
        }));
      } catch (err) {
        console.error('[ConversationManager] Failed to list from DB:', err);
      }
    }

    // Fallback to cache if DB is unavailable
    return Array.from(this.cache.values())
      .filter(c => c.tenantId === tenantId && c.userEmail === userEmail)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(c => {
        const firstUserMsg = c.messages.find(m => m.role === 'user');
        const lastAssistantMsg = [...c.messages].reverse().find(m => m.role === 'assistant');
        return {
          id: c.id,
          title: contentToText(firstUserMsg?.content ?? '').substring(0, 60) || 'Nova conversa',
          lastMessage: contentToText(lastAssistantMsg?.content ?? '').substring(0, 100),
          updatedAt: c.updatedAt,
        };
      });
  }

  /** Delete a conversation (soft-delete in DB via ReplacingMergeTree) */
  async delete(id: string): Promise<boolean> {
    this.cache.delete(id);

    if (await this.ensureReady()) {
      try {
        const rows = await this.clickhouse.rawQuery(
          `SELECT tenant_id, email_usuario, titulo, ultima_mensagem, criada_em
           FROM ia_conversas FINAL
           WHERE conversa_id = '${esc(id)}' LIMIT 1`
        );
        if (rows.length > 0) {
          const r = rows[0];
          await this.clickhouse.execute(`
            INSERT INTO ia_conversas (conversa_id, tenant_id, email_usuario, titulo, ultima_mensagem, criada_em, atualizada_em, ativo)
            VALUES (
              '${esc(id)}',
              '${esc(r.tenant_id as string)}',
              '${esc(r.email_usuario as string)}',
              '${esc(r.titulo as string)}',
              '${esc(r.ultima_mensagem as string)}',
              '${r.criada_em}',
              now(),
              0
            )
          `);
          return true;
        }
      } catch (err) {
        console.error('[ConversationManager] Failed to delete from DB:', err);
      }
    }

    return false;
  }

  /** Clean up old conversations from cache (DB handles its own lifecycle) */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, conv] of this.cache) {
      if (now - conv.updatedAt.getTime() > maxAgeMs) {
        this.cache.delete(id);
      }
    }
  }

  // ── Private: DB Operations ───────────────────────────────

  /** Load a conversation from ClickHouse (metadata + messages) */
  private async loadFromDB(id: string): Promise<Conversation | undefined> {
    const metaRows = await this.clickhouse.rawQuery(
      `SELECT tenant_id, email_usuario, criada_em, atualizada_em
       FROM ia_conversas FINAL
       WHERE conversa_id = '${esc(id)}' AND ativo = 1
       LIMIT 1`
    );

    if (metaRows.length === 0) return undefined;
    const meta = metaRows[0];

    const msgRows = await this.clickhouse.rawQuery(
      `SELECT role, conteudo, criada_em
       FROM ia_mensagens
       WHERE conversa_id = '${esc(id)}'
       ORDER BY indice ASC`
    );

    const messages: ChatMessage[] = msgRows.map(r => ({
      role: r.role as 'user' | 'assistant',
      content: r.conteudo as string,
      timestamp: new Date(r.criada_em as string),
    }));

    // Trim to last N for context window
    const trimmed = messages.length > this.maxMessagesPerConversation
      ? messages.slice(-this.maxMessagesPerConversation)
      : messages;

    return {
      id,
      tenantId: meta.tenant_id as string,
      userEmail: meta.email_usuario as string,
      messages: trimmed,
      createdAt: new Date(meta.criada_em as string),
      updatedAt: new Date(meta.atualizada_em as string),
    };
  }

  /** Persist a new conversation to ClickHouse */
  private async persistNewConversation(conv: Conversation): Promise<void> {
    if (!this.tablesReady) return;

    await this.clickhouse.execute(`
      INSERT INTO ia_conversas (conversa_id, tenant_id, email_usuario, titulo, ultima_mensagem, criada_em, atualizada_em, ativo)
      VALUES (
        '${esc(conv.id)}',
        '${esc(conv.tenantId)}',
        '${esc(conv.userEmail)}',
        '',
        '',
        '${toDateTime(conv.createdAt)}',
        '${toDateTime(conv.updatedAt)}',
        1
      )
    `);
  }

  /** Persist a message and update conversation metadata */
  private async persistMessage(conv: Conversation, index: number, message: ChatMessage): Promise<void> {
    if (!this.tablesReady) return;

    const text = contentToText(message.content);

    // Insert message
    await this.clickhouse.execute(`
      INSERT INTO ia_mensagens (conversa_id, tenant_id, indice, role, conteudo, criada_em)
      VALUES (
        '${esc(conv.id)}',
        '${esc(conv.tenantId)}',
        ${index},
        '${message.role}',
        '${esc(text)}',
        '${toDateTime(message.timestamp)}'
      )
    `);

    // Update conversation metadata
    // titulo = first user message text; ultima_mensagem = last assistant text
    const currentMeta = await this.clickhouse.rawQuery(
      `SELECT titulo, ultima_mensagem, criada_em
       FROM ia_conversas FINAL
       WHERE conversa_id = '${esc(conv.id)}' LIMIT 1`
    );

    const existing = currentMeta[0] || {};
    const currentTitulo = (existing.titulo as string) || '';
    const currentUltima = (existing.ultima_mensagem as string) || '';

    const newTitulo = (message.role === 'user' && !currentTitulo)
      ? text.substring(0, 100)
      : currentTitulo;
    const newUltima = message.role === 'assistant'
      ? text.substring(0, 200)
      : currentUltima;

    // Re-insert with updated atualizada_em (ReplacingMergeTree deduplicates)
    await this.clickhouse.execute(`
      INSERT INTO ia_conversas (conversa_id, tenant_id, email_usuario, titulo, ultima_mensagem, criada_em, atualizada_em, ativo)
      VALUES (
        '${esc(conv.id)}',
        '${esc(conv.tenantId)}',
        '${esc(conv.userEmail)}',
        '${esc(newTitulo)}',
        '${esc(newUltima)}',
        '${existing.criada_em ?? toDateTime(conv.createdAt)}',
        '${toDateTime(new Date())}',
        1
      )
    `);
  }
}
