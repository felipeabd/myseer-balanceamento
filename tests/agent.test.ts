import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IrisAgent } from '../src/agent/iris';
import { TenantContext } from '../src/types';

// ──────────────────────────────────────────────
// Mock: Anthropic SDK
// ──────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: vi.fn(),
      };
    },
  };
});

// ──────────────────────────────────────────────
// Mock: ClickHouse client
// ──────────────────────────────────────────────
const mockQuery = vi.fn();

vi.mock('@clickhouse/client', () => {
  return {
    createClient: () => ({
      query: mockQuery,
      close: vi.fn(),
    }),
  };
});

// ──────────────────────────────────────────────
// Test data
// ──────────────────────────────────────────────
const tenant: TenantContext = {
  tenantId: '33F6E320-F59E-4E43-99C2-2D6748A64B04',
  userEmail: 'analista@empresa.com',
};

const sampleProducts = [
  {
    cdprod: 1001,
    descricao: 'Shampoo 400ml',
    fabricante: 'Marca X',
    curva: 'A',
    total_excesso: 150,
    total_necessidade: 80,
    lojas_doadoras: 3,
    lojas_receptoras: 5,
    cobertura_media: 12.5,
    capital_imobilizado_excesso: 4500.0,
  },
  {
    cdprod: 2002,
    descricao: 'Condicionador 300ml',
    fabricante: 'Marca Y',
    curva: 'B',
    total_excesso: 200,
    total_necessidade: 120,
    lojas_doadoras: 4,
    lojas_receptoras: 6,
    cobertura_media: 8.3,
    capital_imobilizado_excesso: 3200.0,
  },
];

function makeClickHouseResponse(data: unknown[]) {
  return {
    json: vi.fn().mockResolvedValue(data),
  };
}

describe('IrisAgent', () => {
  let agent: IrisAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new IrisAgent({
      anthropicApiKey: 'sk-test-fake-key',
      clickhouse: { url: 'http://localhost:9999' },
      maxToolCalls: 2,
    });
  });

  it('handles a simple text response (no tool calls)', async () => {
    // Anthropic returns a plain text response
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Olá! Sou a IRIS. Como posso ajudar com o balanceamento?' },
      ],
      stop_reason: 'end_turn',
    });

    const result = await agent.chat(tenant, 'Olá');

    expect(result.conversationId).toBeDefined();
    expect(result.response).toContain('IRIS');
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Verify it passed the system prompt with tenant
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain(tenant.tenantId);
    expect(callArgs.system).toContain(tenant.userEmail);
  });

  it('executes tool calls and returns final response', async () => {
    // First call: model wants to query MAX(dtcarga)
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Vou verificar a data mais recente dos dados.' },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'clickhouse_query',
          input: {
            sql: `SELECT MAX(dtcarga) as ultima_carga FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' AND filialdeposito <> 1`,
          },
        },
      ],
      stop_reason: 'tool_use',
    });

    // Mock ClickHouse response for the tool call
    mockQuery.mockResolvedValueOnce(
      makeClickHouseResponse([{ ultima_carga: '2025-01-15' }])
    );

    // Second call: model returns final answer after seeing tool result
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '## Resumo\n\nDados atualizados até 15/01/2025.\n\nEncontrei 2 produtos com oportunidade de balanceamento.',
        },
      ],
      stop_reason: 'end_turn',
    });

    const result = await agent.chat(tenant, 'Quais produtos posso balancear?');

    expect(result.response).toContain('15/01/2025');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify tool result was passed back to the model
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages.find(
      (m: { role: string }) => m.role === 'user' && Array.isArray(m.content)
    );
    expect(toolResultMsg).toBeDefined();
  });

  it('respects maxToolCalls limit', async () => {
    // First call: tool use #1
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'clickhouse_query',
          input: { sql: `SELECT MAX(dtcarga) as dt FROM x WHERE tenant = '${tenant.tenantId}'` },
        },
      ],
      stop_reason: 'tool_use',
    });

    mockQuery.mockResolvedValueOnce(
      makeClickHouseResponse([{ dt: '2025-01-15' }])
    );

    // Second call: tool use #2
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool-2',
          name: 'clickhouse_query',
          input: { sql: `SELECT * FROM x WHERE tenant = '${tenant.tenantId}' LIMIT 10` },
        },
      ],
      stop_reason: 'tool_use',
    });

    mockQuery.mockResolvedValueOnce(
      makeClickHouseResponse(sampleProducts)
    );

    // Third call: model should generate text (tool budget exhausted)
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Aqui estão os produtos encontrados.' },
      ],
      stop_reason: 'end_turn',
    });

    const result = await agent.chat(tenant, 'O que posso redistribuir?');

    expect(result.response).toContain('produtos encontrados');
    expect(mockCreate).toHaveBeenCalledTimes(3);
    // ClickHouse was called exactly 2 times (the limit)
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('handles ClickHouse errors gracefully', async () => {
    // Model wants to query
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'clickhouse_query',
          input: { sql: `SELECT 1 WHERE tenant = '${tenant.tenantId}'` },
        },
      ],
      stop_reason: 'tool_use',
    });

    // ClickHouse fails
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    // Model gets error and responds gracefully
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Problemas técnicos impediram a geração desta análise no momento.',
        },
      ],
      stop_reason: 'end_turn',
    });

    const result = await agent.chat(tenant, 'Analise o produto 1001');

    expect(result.response).toContain('Problemas técnicos');
    // The tool error was caught and sent back to the model
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages.find(
      (m: { role: string; content: unknown[] }) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content[0]?.type === 'tool_result'
    );
    expect(toolResultMsg).toBeDefined();
  });

  it('maintains conversation context across messages', async () => {
    // First message
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Olá! Como posso ajudar?' }],
      stop_reason: 'end_turn',
    });

    const first = await agent.chat(tenant, 'Oi');

    // Second message in same conversation
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Vou listar os produtos disponíveis.' }],
      stop_reason: 'end_turn',
    });

    const second = await agent.chat(tenant, 'Quais produtos?', first.conversationId);

    expect(second.conversationId).toBe(first.conversationId);

    // Second call should include previous messages
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    expect(secondCallMessages).toHaveLength(3); // user, assistant, user
    expect(secondCallMessages[0].content).toBe('Oi');
    expect(secondCallMessages[1].content).toBe('Olá! Como posso ajudar?');
    expect(secondCallMessages[2].content).toBe('Quais produtos?');
  });

  it('includes balancing rules in system prompt', async () => {
    const agentWithRules = new IrisAgent({
      anthropicApiKey: 'sk-test-fake-key',
      clickhouse: { url: 'http://localhost:9999' },
      rules: [
        {
          id: '1',
          type: 'BLOQUEIO',
          priority: 1,
          description: 'Não transferir produtos curva D',
          active: true,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Entendido.' }],
      stop_reason: 'end_turn',
    });

    await agentWithRules.chat(tenant, 'Olá');

    const systemPrompt = mockCreate.mock.calls[0][0].system;
    expect(systemPrompt).toContain('BLOQUEIO');
    expect(systemPrompt).toContain('Não transferir produtos curva D');
  });
});
