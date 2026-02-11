import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IrisAgent } from '../src/agent/iris';
import { TenantContext } from '../src/types';

// ──────────────────────────────────────────────
// Mock: OpenAI SDK
// ──────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// ──────────────────────────────────────────────
// Mock: ClickHouse client
// ──────────────────────────────────────────────
const mockQuery = vi.fn();
const mockExec = vi.fn().mockResolvedValue(undefined);

vi.mock('@clickhouse/client', () => {
  return {
    createClient: () => ({
      query: mockQuery,
      exec: mockExec,
      close: vi.fn(),
    }),
  };
});

function makeClickHouseResponse(data: unknown[]) {
  return {
    json: vi.fn().mockResolvedValue(data),
  };
}

/**
 * Helper: set up ClickHouse mock responses for a single agent.chat() call.
 * Each call internally queries: 1) isInTrainingMode, 2) loadRulesSkill.
 * Then tool calls follow.
 */
function setupChatMocks(...toolResponses: ReturnType<typeof makeClickHouseResponse>[]) {
  // Internal calls return empty
  mockQuery.mockResolvedValueOnce(makeClickHouseResponse([])); // isInTrainingMode
  mockQuery.mockResolvedValueOnce(makeClickHouseResponse([])); // loadRulesSkill
  for (const r of toolResponses) {
    mockQuery.mockResolvedValueOnce(r);
  }
}

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

describe('IrisAgent', () => {
  let agent: IrisAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new IrisAgent({
      openaiApiKey: 'sk-test-fake-key',
      clickhouse: { url: 'http://localhost:9999' },
      maxToolCalls: 2,
    });
  });

  it('handles a simple text response (no tool calls)', async () => {
    setupChatMocks(); // just internal calls, no tool responses

    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Olá! Sou a IRIS. Como posso ajudar com o balanceamento?',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    });

    const result = await agent.chat(tenant, 'Olá');

    expect(result.conversationId).toBeDefined();
    expect(result.response).toContain('IRIS');
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Verify it passed the system prompt with tenant
    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg.content).toContain(tenant.tenantId);
    expect(systemMsg.content).toContain(tenant.userEmail);
  });

  it('executes tool calls and returns final response', async () => {
    setupChatMocks(
      makeClickHouseResponse([{ ultima_carga: '2025-01-15' }]), // tool call response
    );

    // First call: model wants to query MAX(dtcarga)
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Vou verificar a data mais recente dos dados.',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({
                sql: `SELECT MAX(dtcarga) as ultima_carga FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' AND filialdeposito <> 1`,
              }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    // Second call: model returns final answer after seeing tool result
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '## Resumo\n\nDados atualizados até 15/01/2025.\n\nEncontrei 2 produtos com oportunidade de balanceamento.',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 200, completion_tokens: 40 },
    });

    const result = await agent.chat(tenant, 'Quais produtos posso balancear?');

    expect(result.response).toContain('15/01/2025');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify tool result was passed back to the model
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages.find(
      (m: { role: string }) => m.role === 'tool'
    );
    expect(toolResultMsg).toBeDefined();
  });

  it('respects maxToolCalls limit', async () => {
    setupChatMocks(
      makeClickHouseResponse([{ dt: '2025-01-15' }]),   // tool call #1
      makeClickHouseResponse(sampleProducts),             // tool call #2
    );

    // First call: tool use #1
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT MAX(dtcarga) as dt FROM x WHERE tenant = '${tenant.tenantId}'` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    });

    // Second call: tool use #2
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-2',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT * FROM x WHERE tenant = '${tenant.tenantId}' LIMIT 10` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 200, completion_tokens: 40 },
    });

    // Third call: model should generate text (tool budget exhausted)
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Aqui estão os produtos encontrados.',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 300, completion_tokens: 20 },
    });

    const result = await agent.chat(tenant, 'O que posso redistribuir?');

    expect(result.response).toContain('produtos encontrados');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('handles ClickHouse errors gracefully', async () => {
    // Internal calls
    mockQuery.mockResolvedValueOnce(makeClickHouseResponse([])); // isInTrainingMode
    mockQuery.mockResolvedValueOnce(makeClickHouseResponse([])); // loadRulesSkill
    // Tool call: ClickHouse fails
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    // Model wants to query
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT 1 WHERE tenant = '${tenant.tenantId}'` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    });

    // Model gets error and responds gracefully
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Problemas técnicos impediram a geração desta análise no momento.',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 200, completion_tokens: 20 },
    });

    const result = await agent.chat(tenant, 'Analise o produto 1001');

    expect(result.response).toContain('Problemas técnicos');
    // The tool error was caught and sent back to the model
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages.find(
      (m: { role: string }) => m.role === 'tool'
    );
    expect(toolResultMsg).toBeDefined();
  });

  it('maintains conversation context across messages', async () => {
    // First message
    setupChatMocks(); // internal calls for 1st chat
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Olá! Como posso ajudar?',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });

    const first = await agent.chat(tenant, 'Oi');

    // Second message in same conversation
    setupChatMocks(); // internal calls for 2nd chat
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Vou listar os produtos disponíveis.',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 150, completion_tokens: 15 },
    });

    const second = await agent.chat(tenant, 'Quais produtos?', first.conversationId);

    expect(second.conversationId).toBe(first.conversationId);

    // Second call should include previous messages (system + user + assistant + user = 4)
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    expect(secondCallMessages).toHaveLength(4);
    expect(secondCallMessages[1].content).toBe('Oi');
    expect(secondCallMessages[2].content).toBe('Olá! Como posso ajudar?');
    expect(secondCallMessages[3].content).toBe('Quais produtos?');
  });

  it('includes balancing rules in system prompt', async () => {
    const agentWithRules = new IrisAgent({
      openaiApiKey: 'sk-test-fake-key',
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

    setupChatMocks(); // internal calls
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Entendido.',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 5 },
    });

    await agentWithRules.chat(tenant, 'Olá');

    const systemMsg = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'system'
    );
    expect(systemMsg.content).toContain('BLOQUEIO');
    expect(systemMsg.content).toContain('Não transferir produtos curva D');
  });
});
