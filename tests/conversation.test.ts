import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from '../src/conversation/manager';
import { TenantContext } from '../src/types';

const tenantA: TenantContext = {
  tenantId: 'TENANT-AAA',
  userEmail: 'user@tenantA.com',
};

const tenantB: TenantContext = {
  tenantId: 'TENANT-BBB',
  userEmail: 'user@tenantB.com',
};

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  it('creates a new conversation when no id provided', () => {
    const conv = manager.getOrCreate(undefined, tenantA);
    expect(conv.id).toBeDefined();
    expect(conv.tenantId).toBe(tenantA.tenantId);
    expect(conv.userEmail).toBe(tenantA.userEmail);
    expect(conv.messages).toEqual([]);
  });

  it('returns existing conversation by id', () => {
    const conv1 = manager.getOrCreate(undefined, tenantA);
    const conv2 = manager.getOrCreate(conv1.id, tenantA);
    expect(conv2.id).toBe(conv1.id);
  });

  it('rejects access from wrong tenant', () => {
    const conv = manager.getOrCreate(undefined, tenantA);
    expect(() => manager.getOrCreate(conv.id, tenantB)).toThrow(
      'Conversation does not belong to this tenant'
    );
  });

  it('adds messages to conversation', () => {
    const conv = manager.getOrCreate(undefined, tenantA);
    manager.addMessage(conv.id, {
      role: 'user',
      content: 'Olá',
      timestamp: new Date(),
    });
    manager.addMessage(conv.id, {
      role: 'assistant',
      content: 'Oi! Como posso ajudar?',
      timestamp: new Date(),
    });

    const updated = manager.get(conv.id)!;
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[0].content).toBe('Olá');
    expect(updated.messages[1].role).toBe('assistant');
  });

  it('trims messages when exceeding limit', () => {
    const conv = manager.getOrCreate(undefined, tenantA);

    // Add 55 messages (limit is 50)
    for (let i = 0; i < 55; i++) {
      manager.addMessage(conv.id, {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    const updated = manager.get(conv.id)!;
    expect(updated.messages).toHaveLength(50);
    expect(updated.messages[0].content).toBe('Message 5'); // first 5 trimmed
  });

  it('throws when adding to nonexistent conversation', () => {
    expect(() =>
      manager.addMessage('fake-id', {
        role: 'user',
        content: 'test',
        timestamp: new Date(),
      })
    ).toThrow('Conversation not found');
  });

  it('lists conversations by user', () => {
    manager.getOrCreate(undefined, tenantA);
    manager.getOrCreate(undefined, tenantA);
    manager.getOrCreate(undefined, tenantB);

    const listA = manager.listByUser(tenantA.tenantId, tenantA.userEmail);
    expect(listA).toHaveLength(2);

    const listB = manager.listByUser(tenantB.tenantId, tenantB.userEmail);
    expect(listB).toHaveLength(1);
  });

  it('deletes a conversation', () => {
    const conv = manager.getOrCreate(undefined, tenantA);
    expect(manager.delete(conv.id)).toBe(true);
    expect(manager.get(conv.id)).toBeUndefined();
  });

  it('cleans up old conversations', () => {
    const conv = manager.getOrCreate(undefined, tenantA);
    // Manually set updatedAt to 2 days ago
    conv.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    manager.cleanup(24 * 60 * 60 * 1000); // 1 day
    expect(manager.get(conv.id)).toBeUndefined();
  });
});
