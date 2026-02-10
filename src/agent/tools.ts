import Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions that the IRIS agent can use.
 * Currently only clickhouse_query — the agent writes SQL and we execute it.
 */
export const agentTools: Anthropic.Tool[] = [
  {
    name: 'clickhouse_query',
    description: `Execute a read-only SQL query against the ClickHouse database.
The query MUST:
- Be a SELECT statement only
- Include the tenant filter in the WHERE clause
- Include filialdeposito <> 1
- Target the table default.ia_fato_balanceamento

Return format: array of JSON objects (one per row).
Maximum 500 rows returned.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'The SQL SELECT query to execute',
        },
      },
      required: ['sql'],
    },
  },
];
