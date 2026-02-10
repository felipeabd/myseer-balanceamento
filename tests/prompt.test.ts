import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/agent/prompt';
import { BalancingRule, TenantContext } from '../src/types';

const tenant: TenantContext = {
  tenantId: '33F6E320-F59E-4E43-99C2-2D6748A64B04',
  userEmail: 'analista@empresa.com',
};

describe('buildSystemPrompt', () => {
  it('includes tenant ID in the prompt', () => {
    const prompt = buildSystemPrompt(tenant);
    expect(prompt).toContain(tenant.tenantId);
  });

  it('includes user email in the prompt', () => {
    const prompt = buildSystemPrompt(tenant);
    expect(prompt).toContain(tenant.userEmail);
  });

  it('includes default message when no rules', () => {
    const prompt = buildSystemPrompt(tenant);
    expect(prompt).toContain('Nenhuma regra de balanceamento configurada');
  });

  it('formats active rules sorted by priority', () => {
    const rules: BalancingRule[] = [
      {
        id: '2',
        type: 'LIMITE',
        priority: 2,
        description: 'Máximo 100 unidades por transferência',
        active: true,
      },
      {
        id: '1',
        type: 'BLOQUEIO',
        priority: 1,
        description: 'Não transferir curva C',
        active: true,
      },
      {
        id: '3',
        type: 'PRIORIDADE',
        priority: 3,
        description: 'Priorizar lojas com cobertura negativa',
        active: false, // inactive — should NOT appear
      },
    ];

    const prompt = buildSystemPrompt(tenant, rules);
    expect(prompt).toContain('[BLOQUEIO] Prioridade 1: Não transferir curva C');
    expect(prompt).toContain('[LIMITE] Prioridade 2: Máximo 100 unidades por transferência');
    expect(prompt).not.toContain('Priorizar lojas com cobertura negativa');
  });

  it('includes core concepts (doadora, receptora, cobertura)', () => {
    const prompt = buildSystemPrompt(tenant);
    expect(prompt).toContain('Doadora');
    expect(prompt).toContain('Receptora');
    expect(prompt).toContain('Cobertura');
  });

  it('includes tool usage limits', () => {
    const prompt = buildSystemPrompt(tenant);
    expect(prompt).toContain('Máximo de 2 chamadas');
  });

  it('includes error handling instructions', () => {
    const prompt = buildSystemPrompt(tenant);
    expect(prompt).toContain('Problemas técnicos impediram');
  });
});
