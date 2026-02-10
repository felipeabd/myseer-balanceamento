import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { createIrisRouter } from '../src/api/router';
import { IrisAgent } from '../src/agent/iris';

// We'll test the Express router by making HTTP-like calls via supertest pattern
// Since we don't want to add supertest, we test the middleware + router logic directly.

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {
      'x-tenant-id': 'TENANT-123',
      'x-user-email': 'test@test.com',
    },
    body: { message: 'Quais produtos posso balancear?' },
    ...overrides,
  };
}

function makeRes() {
  const res: Record<string, unknown> = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
  };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((data: unknown) => { res.body = data; return res; });
  res.setHeader = vi.fn((k: string, v: string) => {
    (res.headers as Record<string, string>)[k] = v;
    return res;
  });
  res.flushHeaders = vi.fn();
  res.write = vi.fn();
  res.end = vi.fn();
  return res;
}

describe('tenantMiddleware', () => {
  it('rejects request without tenant headers', async () => {
    const { tenantMiddleware } = await import('../src/api/middleware');
    const req = { headers: {} } as express.Request;
    const res = makeRes();
    const next = vi.fn();

    tenantMiddleware(req, res as unknown as express.Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets tenant context and calls next', async () => {
    const { tenantMiddleware } = await import('../src/api/middleware');
    const req = {
      headers: {
        'x-tenant-id': 'T-001',
        'x-user-email': 'user@example.com',
      },
    } as unknown as express.Request;
    const res = makeRes();
    const next = vi.fn();

    tenantMiddleware(req, res as unknown as express.Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({
      tenantId: 'T-001',
      userEmail: 'user@example.com',
    });
  });
});

describe('createIrisRouter', () => {
  it('creates a router with expected routes', () => {
    // Create a minimal mock agent
    const mockAgent = {} as IrisAgent;
    const router = createIrisRouter(mockAgent);
    expect(router).toBeDefined();
    // Router is an Express router (function)
    expect(typeof router).toBe('function');
  });
});
