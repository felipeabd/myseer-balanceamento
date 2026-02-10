import type { ChatContextType } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030';

export class ApiService {
  private tenantId: string;
  private userEmail: string;

  constructor(context: ChatContextType) {
    this.tenantId = context.tenantId;
    this.userEmail = context.userEmail;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-tenant-id': this.tenantId,
      'x-user-email': this.userEmail,
    };
  }

  /**
   * Send a message and receive streaming response via SSE
   */
  async sendMessageStream(
    message: string,
    conversationId: string | undefined,
    onChunk: (text: string) => void,
    onComplete: (conversationId: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/iris/chat/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ message, conversationId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is null');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.text) {
                onChunk(parsed.text);
              }

              if (parsed.conversationId) {
                onComplete(parsed.conversationId);
              }

              if (parsed.error) {
                onError(new Error(parsed.error));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      onError(error as Error);
    }
  }

  /**
   * Send a message and receive complete response (non-streaming)
   */
  async sendMessage(
    message: string,
    conversationId?: string
  ): Promise<{ conversationId: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/iris/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ message, conversationId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get list of conversations
   */
  async getConversations(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/iris/conversations`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.conversations || [];
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/iris/conversations/${conversationId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
}
