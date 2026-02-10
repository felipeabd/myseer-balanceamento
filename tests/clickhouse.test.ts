import { describe, it, expect } from 'vitest';
import { ClickHouseService } from '../src/clickhouse/client';
import { TenantContext } from '../src/types';

/**
 * These tests validate the SAFETY LAYER of ClickHouseService
 * without needing a real ClickHouse connection.
 *
 * We test that:
 * - Non-SELECT queries are rejected
 * - Queries without tenant filter are rejected
 */

const tenant: TenantContext = {
  tenantId: '33F6E320-F59E-4E43-99C2-2D6748A64B04',
  userEmail: 'test@example.com',
};

// We create the service but won't actually connect — the safety
// checks run BEFORE the query is sent to ClickHouse.
const service = new ClickHouseService({
  url: 'http://localhost:9999', // fake — we never connect
});

describe('ClickHouseService — safety validations', () => {
  it('rejects DELETE queries', async () => {
    await expect(
      service.query('DELETE FROM ia_fato_balanceamento WHERE 1=1', tenant)
    ).rejects.toThrow('Only SELECT queries are allowed');
  });

  it('rejects INSERT queries', async () => {
    await expect(
      service.query("INSERT INTO ia_fato_balanceamento VALUES ('x')", tenant)
    ).rejects.toThrow('Only SELECT queries are allowed');
  });

  it('rejects DROP queries', async () => {
    await expect(
      service.query('DROP TABLE ia_fato_balanceamento', tenant)
    ).rejects.toThrow('Only SELECT queries are allowed');
  });

  it('rejects ALTER queries', async () => {
    await expect(
      service.query('ALTER TABLE ia_fato_balanceamento ADD COLUMN x Int32', tenant)
    ).rejects.toThrow('Only SELECT queries are allowed');
  });

  it('rejects SELECT without tenant filter', async () => {
    await expect(
      service.query('SELECT * FROM ia_fato_balanceamento', tenant)
    ).rejects.toThrow('Query must include tenant filter');
  });

  it('allows SELECT with tenant filter (would fail on connection, not on validation)', async () => {
    // This will fail because there's no real ClickHouse, but
    // it should NOT fail on our safety checks.
    await expect(
      service.query(
        `SELECT * FROM ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'`,
        tenant
      )
    ).rejects.not.toThrow('Only SELECT queries are allowed');

    await expect(
      service.query(
        `SELECT * FROM ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}'`,
        tenant
      )
    ).rejects.not.toThrow('Query must include tenant filter');
  });

  it('allows WITH (CTE) queries that include tenant', async () => {
    await expect(
      service.query(
        `WITH latest AS (SELECT MAX(dtcarga) as dt FROM ia_fato_balanceamento WHERE tenant = '${tenant.tenantId}') SELECT * FROM latest`,
        tenant
      )
    ).rejects.not.toThrow('Only SELECT queries are allowed');
  });
});
