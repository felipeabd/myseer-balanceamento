import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IrisAgent } from '../src/agent/iris';
import { TenantContext } from '../src/types';

// ──────────────────────────────────────────────
// Realistic mock data — simulates what ClickHouse would return
// ──────────────────────────────────────────────
const MOCK_DATA = {
  lastLoadDate: [{ ultima_carga: '2025-01-20' }],

  discoveryProducts: [
    {
      cdprod: 7890,
      descricao: 'Dipirona 500mg cx 20',
      fabricante: 'EMS',
      curva: 'A',
      total_excesso: 340,
      total_necessidade: 210,
      lojas_doadoras: 5,
      lojas_receptoras: 8,
      cobertura_media: 18.4,
      capital_imobilizado_excesso: 5780.00,
    },
    {
      cdprod: 4521,
      descricao: 'Omeprazol 20mg cx 28',
      fabricante: 'Medley',
      curva: 'A',
      total_excesso: 520,
      total_necessidade: 390,
      lojas_doadoras: 7,
      lojas_receptoras: 12,
      cobertura_media: 14.2,
      capital_imobilizado_excesso: 4160.00,
    },
    {
      cdprod: 3310,
      descricao: 'Losartana 50mg cx 30',
      fabricante: 'Germed',
      curva: 'A',
      total_excesso: 280,
      total_necessidade: 180,
      lojas_doadoras: 4,
      lojas_receptoras: 6,
      cobertura_media: 22.1,
      capital_imobilizado_excesso: 3920.00,
    },
    {
      cdprod: 8801,
      descricao: 'Amoxicilina 500mg cx 21',
      fabricante: 'Neo Quimica',
      curva: 'B',
      total_excesso: 190,
      total_necessidade: 150,
      lojas_doadoras: 3,
      lojas_receptoras: 9,
      cobertura_media: 11.6,
      capital_imobilizado_excesso: 2850.00,
    },
    {
      cdprod: 5567,
      descricao: 'Ibuprofeno 600mg cx 20',
      fabricante: 'Prati-Donaduzzi',
      curva: 'B',
      total_excesso: 410,
      total_necessidade: 270,
      lojas_doadoras: 6,
      lojas_receptoras: 10,
      cobertura_media: 9.8,
      capital_imobilizado_excesso: 2460.00,
    },
  ],

  productDetail_7890: [
    { cdprod: 7890, cdFilial: 101, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 0, qtexcesso: 120, qtestoque: 250, cobertura: 45.2, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 0 },
    { cdprod: 7890, cdFilial: 205, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 0, qtexcesso: 85, qtestoque: 180, cobertura: 32.7, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 0 },
    { cdprod: 7890, cdFilial: 310, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 0, qtexcesso: 75, qtestoque: 140, cobertura: 25.5, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 0 },
    { cdprod: 7890, cdFilial: 412, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 0, qtexcesso: 40, qtestoque: 90, cobertura: 16.4, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 0 },
    { cdprod: 7890, cdFilial: 503, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 0, qtexcesso: 20, qtestoque: 55, cobertura: 10.0, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 0 },
    { cdprod: 7890, cdFilial: 607, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 15, qtexcesso: 0, qtestoque: 18, cobertura: 3.3, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 2 },
    { cdprod: 7890, cdFilial: 708, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 30, qtexcesso: 0, qtestoque: 10, cobertura: 1.8, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 5 },
    { cdprod: 7890, cdFilial: 815, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 40, qtexcesso: 0, qtestoque: 5, cobertura: 0.9, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 8 },
    { cdprod: 7890, cdFilial: 920, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 50, qtexcesso: 0, qtestoque: 2, cobertura: 0.4, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 12 },
    { cdprod: 7890, cdFilial: 999, descricao: 'Dipirona 500mg cx 20', curva: 'A', nomefabricante: 'EMS', qtnecessidade: 60, qtexcesso: 0, qtestoque: 0, cobertura: 0.0, mediaf_un: 5.5, vlrcusto: 17.00, dias_parado: 0, dias_falta: 15 },
  ],
};

// ──────────────────────────────────────────────
// Mock OpenAI
// ──────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

// ──────────────────────────────────────────────
// Mock ClickHouse
// ──────────────────────────────────────────────
const mockChQuery = vi.fn();
const mockExec = vi.fn().mockResolvedValue(undefined);

vi.mock('@clickhouse/client', () => ({
  createClient: () => ({
    query: mockChQuery,
    exec: mockExec,
    close: vi.fn(),
  }),
}));

function chResponse(data: unknown[]) {
  return { json: vi.fn().mockResolvedValue(data) };
}

/**
 * Helper: set up ClickHouse mock for a single agent.chat() call.
 * 2 internal queries (isInTrainingMode, loadRulesSkill) + tool call responses.
 */
function setupChatMocks(...toolResponses: ReturnType<typeof chResponse>[]) {
  mockChQuery.mockResolvedValueOnce(chResponse([])); // isInTrainingMode
  mockChQuery.mockResolvedValueOnce(chResponse([])); // loadRulesSkill
  for (const r of toolResponses) {
    mockChQuery.mockResolvedValueOnce(r);
  }
}

// ──────────────────────────────────────────────
const tenant: TenantContext = {
  tenantId: '33F6E320-F59E-4E43-99C2-2D6748A64B04',
  userEmail: 'felipe@empresa.com',
};

describe('Integration: Full conversation flow', () => {
  let agent: IrisAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new IrisAgent({
      openaiApiKey: 'sk-test',
      clickhouse: { url: 'http://localhost:9999' },
      maxToolCalls: 2,
      rules: [
        { id: '1', type: 'BLOQUEIO', priority: 1, description: 'Não transferir curva D', active: true },
        { id: '2', type: 'LIMITE', priority: 2, description: 'Máximo 100 unidades por transferência', active: true },
      ],
    });
  });

  it('Scenario 1: Discovery — "Quais produtos posso balancear?"', async () => {
    setupChatMocks(
      chResponse(MOCK_DATA.lastLoadDate),      // tool call #1
      chResponse(MOCK_DATA.discoveryProducts),  // tool call #2
    );

    // Agent calls tool #1
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT MAX(dtcarga) as ultima_carga FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' AND filialdeposito <> 1` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    // Agent calls tool #2
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '',
          tool_calls: [{
            id: 'call-2',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT cdprod, any(descricao) as descricao FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' GROUP BY cdprod LIMIT 10` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 200, completion_tokens: 60 },
    });

    // Final response
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: `## Cenário de Balanceamento — 20/01/2025

Identifiquei **5 produtos** com oportunidades de redistribuição:

| # | Produto | Código | Excesso (un) | Capital imobilizado |
|---|---------|--------|-------------|-------------------|
| 1 | Dipirona 500mg cx 20 | 7890 | 340 | R$ 5.780,00 |
| 2 | Omeprazol 20mg cx 28 | 4521 | 520 | R$ 4.160,00 |

Gostaria de aprofundar a análise em algum produto específico ou prefere explorar outra perspectiva?`,
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 400, completion_tokens: 200 },
    });

    const result = await agent.chat(tenant, 'Quais produtos posso balancear?');

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.response).toContain('Dipirona');
    expect(result.response).toContain('5.780');
    expect(result.response).toContain('aprofundar');
  });

  it('Scenario 2: Product detail — "Analise o produto 7890"', async () => {
    // Pre-seed conversation
    setupChatMocks();
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: { content: 'Olá!', tool_calls: null },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 50, completion_tokens: 5 },
    });
    const { conversationId } = await agent.chat(tenant, 'Oi');

    // Set up for the second chat call
    setupChatMocks(
      chResponse(MOCK_DATA.lastLoadDate),        // tool call #1
      chResponse(MOCK_DATA.productDetail_7890),   // tool call #2
    );

    // Agent calls tool #1
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT MAX(dtcarga) as ultima_carga FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 150, completion_tokens: 40 },
    });

    // Agent calls tool #2
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-2',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT * FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' AND cdprod = 7890 AND filialdeposito <> 1` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 250, completion_tokens: 50 },
    });

    // Final analysis
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: `## Análise — Dipirona 500mg cx 20 (Código 7890)

### Sugestão de Transferências
| Origem (loja) | Destino (loja) | Qtd |
|---------------|---------------|-----|
| 101 | 999 | 60 |

Deseja analisar outro produto?`,
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 500, completion_tokens: 300 },
    });

    const result = await agent.chat(tenant, 'Analise o produto 7890', conversationId);

    expect(result.response).toContain('Dipirona');
    expect(result.response).toContain('999');
    expect(result.response).toContain('Sugestão de Transferências');
  });

  it('Scenario 3: Error handling — ClickHouse offline', async () => {
    // Internal calls succeed, but tool call fails
    mockChQuery.mockResolvedValueOnce(chResponse([])); // isInTrainingMode
    mockChQuery.mockResolvedValueOnce(chResponse([])); // loadRulesSkill
    mockChQuery.mockRejectedValueOnce(new Error('ECONNREFUSED')); // tool call fails

    // Agent tries to query
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT MAX(dtcarga) FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    });

    // Agent responds after seeing error
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Problemas técnicos impediram a geração desta análise no momento. Tente novamente mais tarde.',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 150, completion_tokens: 20 },
    });

    const result = await agent.chat(tenant, 'Quais produtos posso balancear?');

    expect(result.response).toContain('Problemas técnicos');
    expect(result.response).not.toContain('ECONNREFUSED');
  });

  it('Scenario 4: Multi-turn conversation context', async () => {
    // Turn 1: greeting
    setupChatMocks();
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Olá Felipe! Sou a IRIS, sua assistente de balanceamento. Como posso ajudar?',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 80, completion_tokens: 20 },
    });
    const turn1 = await agent.chat(tenant, 'Oi, me ajuda com balanceamento');

    // Turn 2: discovery (using same conversation)
    setupChatMocks(
      chResponse(MOCK_DATA.lastLoadDate), // tool call
    );

    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'c1',
            type: 'function',
            function: {
              name: 'clickhouse_query',
              arguments: JSON.stringify({ sql: `SELECT MAX(dtcarga) as dt FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'` }),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 150, completion_tokens: 40 },
    });

    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Os dados estão atualizados até 20/01/2025. O que gostaria de explorar?',
          tool_calls: null,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 200, completion_tokens: 20 },
    });
    const turn2 = await agent.chat(tenant, 'Qual a data mais recente dos dados?', turn1.conversationId);

    expect(turn2.conversationId).toBe(turn1.conversationId);

    // Verify turn 2 included turn 1 context (system + user + assistant + user = 4+)
    const turn2Messages = mockCreate.mock.calls[1][0].messages;
    expect(turn2Messages.length).toBeGreaterThanOrEqual(4);
  });

  it('Scenario 5: Tenant isolation — cannot see other tenant data', async () => {
    const otherTenant: TenantContext = {
      tenantId: 'OTHER-TENANT-ID',
      userEmail: 'hacker@other.com',
    };

    // Create a conversation for tenant A
    setupChatMocks();
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: { content: 'Olá!', tool_calls: null },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 50, completion_tokens: 5 },
    });
    const { conversationId } = await agent.chat(tenant, 'Oi');

    // Try to access from tenant B — should throw
    setupChatMocks();
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: { content: 'should not see this', tool_calls: null },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 50, completion_tokens: 5 },
    });

    await expect(
      agent.chat(otherTenant, 'Me mostra os dados', conversationId)
    ).rejects.toThrow('Conversation does not belong to this tenant');
  });
});
