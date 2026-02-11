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
// Mock Anthropic — generates REALISTIC responses based on tool results
// ──────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate, stream: vi.fn() };
  },
}));

// ──────────────────────────────────────────────
// Mock ClickHouse — returns data based on query content
// ──────────────────────────────────────────────
const mockChQuery = vi.fn();

vi.mock('@clickhouse/client', () => ({
  createClient: () => ({
    query: mockChQuery,
    close: vi.fn(),
  }),
}));

function chResponse(data: unknown[]) {
  return { json: vi.fn().mockResolvedValue(data) };
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
      anthropicApiKey: 'sk-test',
      clickhouse: { url: 'http://localhost:9999' },
      maxToolCalls: 2,
      rules: [
        { id: '1', type: 'BLOQUEIO', priority: 1, description: 'Não transferir curva D', active: true },
        { id: '2', type: 'LIMITE', priority: 2, description: 'Máximo 100 unidades por transferência', active: true },
      ],
    });
  });

  it('Scenario 1: Discovery — "Quais produtos posso balancear?"', async () => {
    // Agent calls tool #1: MAX(dtcarga)
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: '' },
        {
          type: 'tool_use',
          id: 'call-1',
          name: 'clickhouse_query',
          input: { sql: `SELECT MAX(dtcarga) as ultima_carga FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' AND filialdeposito <> 1` },
        },
      ],
    });
    mockChQuery.mockResolvedValueOnce(chResponse(MOCK_DATA.lastLoadDate));

    // Agent calls tool #2: discovery query
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: '' },
        {
          type: 'tool_use',
          id: 'call-2',
          name: 'clickhouse_query',
          input: { sql: `SELECT cdprod, any(descricao) as descricao FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' GROUP BY cdprod LIMIT 10` },
        },
      ],
    });
    mockChQuery.mockResolvedValueOnce(chResponse(MOCK_DATA.discoveryProducts));

    // Agent generates final response (no more tool budget)
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: `## Cenário de Balanceamento — 20/01/2025

Identifiquei **5 produtos** com oportunidades de redistribuição:

| # | Produto | Código | Excesso (un) | Necessidade (un) | Doadoras | Receptoras | Custo unit. | Capital imobilizado |
|---|---------|--------|-------------|-----------------|----------|------------|-------------|-------------------|
| 1 | Dipirona 500mg cx 20 | 7890 | 340 | 210 | 5 | 8 | R$ 17,00 | R$ 5.780,00 |
| 2 | Omeprazol 20mg cx 28 | 4521 | 520 | 390 | 7 | 12 | R$ 8,00 | R$ 4.160,00 |
| 3 | Losartana 50mg cx 30 | 3310 | 280 | 180 | 4 | 6 | R$ 14,00 | R$ 3.920,00 |
| 4 | Amoxicilina 500mg cx 21 | 8801 | 190 | 150 | 3 | 9 | R$ 15,00 | R$ 2.850,00 |
| 5 | Ibuprofeno 600mg cx 20 | 5567 | 410 | 270 | 6 | 10 | R$ 6,00 | R$ 2.460,00 |

O capital total imobilizado em excesso é de aproximadamente **R$ 19.170,00**.

Gostaria de aprofundar a análise em algum produto específico ou prefere explorar outra perspectiva?`,
      }],
    });

    const result = await agent.chat(tenant, 'Quais produtos posso balancear?');

    // Verify the flow
    expect(mockCreate).toHaveBeenCalledTimes(3); // 2 tool rounds + final
    expect(mockChQuery).toHaveBeenCalledTimes(2); // 2 CH queries
    expect(result.response).toContain('Dipirona');
    expect(result.response).toContain('5.780');
    expect(result.response).toContain('aprofundar');
    // Should NOT contain recommendations (discovery mode)
    expect(result.response).not.toContain('Recomendações');

    console.log('\n🟢 === SCENARIO 1: DISCOVERY ===');
    console.log(`👤 User: Quais produtos posso balancear?`);
    console.log(`🤖 IRIS:\n${result.response}`);
    console.log(`📊 Tool calls: ${mockChQuery.mock.calls.length}`);
    console.log(`💬 Conversation ID: ${result.conversationId}\n`);
  });

  it('Scenario 2: Product detail — "Analise o produto 7890"', async () => {
    // Pre-seed conversation with a discovery message
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Olá!' }],
    });
    const { conversationId } = await agent.chat(tenant, 'Oi');

    vi.clearAllMocks();

    // Agent calls tool #1: MAX(dtcarga)
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'call-1',
          name: 'clickhouse_query',
          input: { sql: `SELECT MAX(dtcarga) as ultima_carga FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'` },
        },
      ],
    });
    mockChQuery.mockResolvedValueOnce(chResponse(MOCK_DATA.lastLoadDate));

    // Agent calls tool #2: product detail
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'call-2',
          name: 'clickhouse_query',
          input: { sql: `SELECT * FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}' AND cdprod = 7890 AND filialdeposito <> 1` },
        },
      ],
    });
    mockChQuery.mockResolvedValueOnce(chResponse(MOCK_DATA.productDetail_7890));

    // Agent generates analysis
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: `## Análise — Dipirona 500mg cx 20 (Código 7890)

**Dados atualizados em 20/01/2025** | Fabricante: EMS | Curva: A

### Visão Geral
- Excesso total: **340 unidades** (5 lojas)
- Necessidade total: **195 unidades** (5 lojas)
- Custo unitário: **R$ 17,00**
- Capital imobilizado em excesso: **R$ 5.780,00**

### Lojas Doadoras (excesso)
| Loja | Estoque | Excesso | Cobertura (dias) |
|------|---------|---------|-----------------|
| 101 | 250 | 120 | 45,2 |
| 205 | 180 | 85 | 32,7 |
| 310 | 140 | 75 | 25,5 |
| 412 | 90 | 40 | 16,4 |
| 503 | 55 | 20 | 10,0 |

### Lojas Receptoras (necessidade)
| Loja | Estoque | Necessidade | Cobertura (dias) | Dias em falta |
|------|---------|-------------|-----------------|---------------|
| 999 | 0 | 60 | 0,0 | 15 |
| 920 | 2 | 50 | 0,4 | 12 |
| 815 | 5 | 40 | 0,9 | 8 |
| 708 | 10 | 30 | 1,8 | 5 |
| 607 | 18 | 15 | 3,3 | 2 |

### Sugestão de Transferências
| Origem (loja) | Destino (loja) | Qtd | Impacto (R$) |
|---------------|---------------|-----|-------------|
| 101 | 999 | 60 | R$ 1.020,00 |
| 101 | 920 | 50 | R$ 850,00 |
| 205 | 815 | 40 | R$ 680,00 |
| 205 | 708 | 30 | R$ 510,00 |
| 310 | 607 | 15 | R$ 255,00 |

**Total a transferir:** 195 unidades — **R$ 3.315,00** em estoque redistribuído.

⚠️ Regra aplicada: máximo de 100 unidades por transferência respeitado.

Deseja que eu monte o plano de transferências detalhado ou quer analisar outro produto?`,
      }],
    });

    const result = await agent.chat(tenant, 'Analise o produto 7890', conversationId);

    expect(result.response).toContain('Dipirona');
    expect(result.response).toContain('999');
    expect(result.response).toContain('Sugestão de Transferências');
    expect(mockChQuery).toHaveBeenCalledTimes(2);

    console.log('\n🟢 === SCENARIO 2: PRODUCT DETAIL ===');
    console.log(`👤 User: Analise o produto 7890`);
    console.log(`🤖 IRIS:\n${result.response}`);
    console.log(`📊 Tool calls: ${mockChQuery.mock.calls.length}\n`);
  });

  it('Scenario 3: Error handling — ClickHouse offline', async () => {
    // Agent tries to query but CH is down
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'call-1',
          name: 'clickhouse_query',
          input: { sql: `SELECT MAX(dtcarga) FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'` },
        },
      ],
    });
    mockChQuery.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    // Agent receives error and responds appropriately
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: 'Problemas técnicos impediram a geração desta análise no momento. Tente novamente mais tarde.',
      }],
    });

    const result = await agent.chat(tenant, 'Quais produtos posso balancear?');

    expect(result.response).toContain('Problemas técnicos');
    expect(result.response).not.toContain('ECONNREFUSED'); // never expose internals

    console.log('\n🟢 === SCENARIO 3: ERROR HANDLING ===');
    console.log(`👤 User: Quais produtos posso balancear?`);
    console.log(`🤖 IRIS: ${result.response}`);
    console.log(`📊 Error was handled gracefully\n`);
  });

  it('Scenario 4: Multi-turn conversation context', async () => {
    // Turn 1: greeting
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Olá Felipe! Sou a IRIS, sua assistente de balanceamento. Como posso ajudar?' }],
    });
    const turn1 = await agent.chat(tenant, 'Oi, me ajuda com balanceamento');

    // Turn 2: discovery (using same conversation)
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'c1', name: 'clickhouse_query', input: { sql: `SELECT MAX(dtcarga) as dt FROM default.ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'` } },
      ],
    });
    mockChQuery.mockResolvedValueOnce(chResponse(MOCK_DATA.lastLoadDate));

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Os dados estão atualizados até 20/01/2025. O que gostaria de explorar?' }],
    });
    const turn2 = await agent.chat(tenant, 'Qual a data mais recente dos dados?', turn1.conversationId);

    // Verify same conversation
    expect(turn2.conversationId).toBe(turn1.conversationId);

    // Verify turn 2 included turn 1 context
    const turn2CallMessages = mockCreate.mock.calls[1][0].messages;
    expect(turn2CallMessages.length).toBeGreaterThanOrEqual(3);

    console.log('\n🟢 === SCENARIO 4: MULTI-TURN ===');
    console.log(`👤 User: Oi, me ajuda com balanceamento`);
    console.log(`🤖 IRIS: ${turn1.response}`);
    console.log(`👤 User: Qual a data mais recente dos dados?`);
    console.log(`🤖 IRIS: ${turn2.response}`);
    console.log(`💬 Same conversation: ${turn1.conversationId === turn2.conversationId}\n`);
  });

  it('Scenario 5: Tenant isolation — cannot see other tenant data', async () => {
    const otherTenant: TenantContext = {
      tenantId: 'OTHER-TENANT-ID',
      userEmail: 'hacker@other.com',
    };

    // Create a conversation for tenant A
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Olá!' }],
    });
    const { conversationId } = await agent.chat(tenant, 'Oi');

    // Try to access from tenant B — should throw
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'should not see this' }],
    });

    await expect(
      agent.chat(otherTenant, 'Me mostra os dados', conversationId)
    ).rejects.toThrow('Conversation does not belong to this tenant');

    console.log('\n🟢 === SCENARIO 5: TENANT ISOLATION ===');
    console.log(`🔒 Tenant B tried to access Tenant A's conversation → BLOCKED`);
  });
});
