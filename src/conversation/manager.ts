import { v4 as uuidv4 } from 'uuid';
import { Conversation, ChatMessage, TenantContext } from '../types';

/**
 * In-memory conversation manager.
 * For production, replace with Redis/DB persistence.
 */
export class ConversationManager {
  private conversations = new Map<string, Conversation>();
  private maxMessagesPerConversation = 50;

  /** Get existing conversation or create a new one */
  getOrCreate(id: string | undefined, tenant: TenantContext): Conversation {
    if (id && this.conversations.has(id)) {
      const conv = this.conversations.get(id)!;
      // Update tenant if different (allows migration for fixed tenant scenarios)
      if (conv.tenantId !== tenant.tenantId) {
        conv.tenantId = tenant.tenantId;
        conv.userEmail = tenant.userEmail;
      }
      return conv;
    }

    const conversation: Conversation = {
      id: id ?? uuidv4(),
      tenantId: tenant.tenantId,
      userEmail: tenant.userEmail,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /** Add a message to a conversation */
  addMessage(conversationId: string, message: ChatMessage): void {
    const conv = this.conversations.get(conversationId);
    if (!conv) throw new Error('Conversation not found');

    conv.messages.push(message);
    conv.updatedAt = new Date();

    // Trim old messages to avoid unbounded context growth
    if (conv.messages.length > this.maxMessagesPerConversation) {
      conv.messages = conv.messages.slice(-this.maxMessagesPerConversation);
    }
  }

  /** Get a conversation by ID */
  get(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  /** List conversations for a tenant/user */
  listByUser(tenantId: string, userEmail: string): Conversation[] {
    return Array.from(this.conversations.values()).filter(
      c => c.tenantId === tenantId && c.userEmail === userEmail
    );
  }

  /** Delete a conversation */
  delete(id: string): boolean {
    return this.conversations.delete(id);
  }

  /** Clean up old conversations (call periodically) */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, conv] of this.conversations) {
      if (now - conv.updatedAt.getTime() > maxAgeMs) {
        this.conversations.delete(id);
      }
    }
  }
}
