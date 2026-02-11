import type OpenAI from 'openai';

/**
 * Tool definitions that the IRIS agent can use.
 * Currently only clickhouse_query — the agent writes SQL and we execute it.
 */
export const agentTools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'clickhouse_query',
      description: `Execute a read-only SQL query against the ClickHouse database.
The query MUST:
- Be a SELECT statement only
- Include the tenant filter in the WHERE clause
- Include filialdeposito <> 1
- Target the table default.ia_fato_balanceamento

Return format: array of JSON objects (one per row).
Maximum 500 rows returned.`,
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'generate_csv',
      description: `Gera um arquivo CSV para download pelo usuário.
Use quando o usuário pedir para exportar dados como CSV, planilha, Excel ou download.

IMPORTANTE:
- Use os dados já obtidos de tool_result anteriores (NÃO faça nova consulta apenas para o CSV)
- Se o usuário especificou a ordem das colunas, respeite EXATAMENTE
- Se não especificou, use uma ordem lógica de negócio
- Use nomes de colunas em português amigáveis para negócio
- O retorno contém uma URL de download — inclua como link markdown na resposta: [Baixar CSV](url_retornada)

Traduções padrão de colunas:
cdprod → Código Produto, descricao → Descrição, cdFilial → Filial,
qtexcesso → Excesso (un), qtnecessidade → Necessidade (un),
qtestoque → Estoque (un), cobertura → Cobertura (dias),
mediaf_un → Média Diária (un), vlrcusto → Custo Unitário (R$),
dias_parado → Dias Parado, dias_falta → Dias em Falta,
nomefabricante → Fabricante, curva → Curva, linha → Linha`,
      parameters: {
        type: 'object' as const,
        properties: {
          columns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array ordenado de nomes de colunas (viram o cabeçalho do CSV)',
          },
          data: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array de objetos com os dados. Chaves devem corresponder ao array columns.',
          },
          filename: {
            type: 'string',
            description: 'Nome sugerido do arquivo sem extensão (ex: "balanceamento_produto_1001")',
          },
        },
        required: ['columns', 'data'],
      },
    },
  },
];
