import type { ChatContextType, AgentConfig } from '../types';

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
   * Get published agents available for this tenant
   */
  async getAgents(): Promise<AgentConfig[]> {
    const response = await fetch(`${API_BASE_URL}/api/iris/agents`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.agents || [];
  }

  /**
   * Send a message and receive streaming response via SSE
   */
  async sendMessageStream(
    message: string,
    conversationId: string | undefined,
    onChunk: (text: string) => void,
    onComplete: (conversationId: string) => void,
    onError: (error: Error) => void,
    images?: Array<{ data: string; mediaType: string }>,
    agentSlug?: string
  ): Promise<void> {
    try {
      // Build request body with images if provided
      const requestBody: {
        message: string;
        conversationId?: string;
        agentSlug?: string;
        images?: Array<{
          type: 'image';
          source: {
            type: 'base64';
            media_type: string;
            data: string;
          };
        }>;
      } = { message, conversationId, agentSlug };

      if (images && images.length > 0) {
        requestBody.images = images.map(img => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType,
            data: img.data,
          },
        }));
      }

      const response = await fetch(`${API_BASE_URL}/api/iris/chat/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
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
    conversationId?: string,
    agentSlug?: string
  ): Promise<{ conversationId: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/iris/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ message, conversationId, agentSlug }),
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
   * Get a single conversation with full message history
   */
  async getConversation(conversationId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/iris/conversations/${conversationId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get tenant config (current model + available models)
   */
  async getConfig(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/iris/config`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  /**
   * Update tenant config (e.g. change model)
   */
  async updateConfig(modelId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/iris/config`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ modelId }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  }

  /**
   * Get credits info (contracted, used, available) + usage breakdown in BRL
   */
  async getCredits(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/iris/credits`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  /**
   * Add credits to the tenant (accumulated into contracted_brl)
   */
  async addCredits(amountBrl: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/iris/credits/add`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amountBrl }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  /**
   * Get recharge invoices, optionally filtered by month (YYYY-MM)
   */
  async getInvoices(month?: string): Promise<Array<{ id: number; amountBrl: number; rechargedAt: string }>> {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    const response = await fetch(`${API_BASE_URL}/api/iris/credits/invoices?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  /**
   * Get drill-down credits detail filtered by date and/or user
   */
  async getCreditsDetail(date?: string, userEmail?: string, hour?: string): Promise<{
    hourly: Array<{ hour: string; totalTokens: number; costBrl: number }>;
    byUser: Array<{ userEmail: string; totalTokens: number; costBrl: number }>;
  }> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (userEmail) params.set('user', userEmail);
    if (hour) params.set('hour', hour);
    const response = await fetch(`${API_BASE_URL}/api/iris/credits/detail?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
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
