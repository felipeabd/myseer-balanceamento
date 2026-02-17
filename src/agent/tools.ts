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
  {
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
    input_schema: {
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
  {
    name: 'consultar_conhecimento',
    description: `Busca definições de conceitos de negócio na base de conhecimento.

Use quando:
- Usuário pergunta "o que é X?"
- Precisa explicar um conceito (excesso, vencido, cobertura, ruptura, curva ABC)
- Quer enriquecer resposta com contexto de negócio

Retorna: definição, importância, relações e exemplos práticos`,
    input_schema: {
      type: 'object' as const,
      properties: {
        termo: {
          type: 'string',
          description: 'Termo a buscar (ex: "excesso", "vencido", "cobertura", "ruptura", "curva_abc")',
        },
      },
      required: ['termo'],
    },
  },
  {
    name: 'optimize_batch',
    description: `Executa otimização em lote usando algoritmo Python.

Use quando:
- Análise envolve 2 ou mais produtos
- Grupo (linha, fabricante, comprador, curva)
- Lista explícita de produtos

O sistema irá:
1. Buscar dados do ClickHouse
2. Executar otimização matemática (equalização de cobertura)
3. Retornar plano de transferências otimizado

Retorno: JSON com transferências sugeridas + métricas agregadas`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filters: {
          type: 'object',
          description: 'Filtros para seleção de produtos',
          properties: {
            linha: { type: 'string' },
            fabricante: { type: 'string' },
            comprador: { type: 'string' },
            curva: { type: 'string' },
            produtos: {
              type: 'array',
              items: { type: 'number' },
              description: 'Lista de cdprod',
            },
          },
        },
        constraints: {
          type: 'object',
          description: 'Restrições opcionais (futuro)',
          properties: {
            max_transfers_per_store: { type: 'number' },
            prioritize_curve: { type: 'string' },
          },
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: `Colunas para incluir no CSV (opcional). Se não especificado, usa todas as colunas disponíveis.

Colunas disponíveis:
- cdprod, descricao, curva, linha
- filial_origem, filial_destino
- qtexcesso_origem, qtnecessidade_destino, qt_transferida
- vlrcusto, valor_gerado
- cobertura_inicial_origem, cobertura_final_origem
- cobertura_inicial_destino, cobertura_final_destino

Exemplo: ["cdprod", "filial_origem", "filial_destino", "qt_transferida", "valor_gerado"]`,
        },
      },
      required: ['filters'],
    },
  },
  {
    name: 'adicionar_conhecimento',
    description: `Adiciona um novo conhecimento à base de conhecimento do sistema.

Use quando:
- Usuário usar o comando "conhecimento: [conteúdo]"
- Quiser ensinar um novo conceito ao sistema
- Adicionar definição de termo de negócio

IMPORTANTE: Extraia as informações do texto fornecido pelo usuário:
- termo: Nome do conceito (ex: "vencido próximo", "ruptura crônica")
- definicao: O que é (1-2 frases)
- porque_importa: Por que é relevante para o negócio
- relacoes: Como se relaciona com outros conceitos
- exemplos: Casos práticos de uso
- categoria: inventario | balanceamento | ruptura | giro | compra
- tags: Palavras-chave separadas por vírgula`,
    input_schema: {
      type: 'object' as const,
      properties: {
        termo: {
          type: 'string',
          description: 'Nome do conceito/termo',
        },
        definicao: {
          type: 'string',
          description: 'Definição do conceito (1-2 frases)',
        },
        porque_importa: {
          type: 'string',
          description: 'Por que é importante para o negócio',
        },
        relacoes: {
          type: 'string',
          description: 'Relações com outros conceitos (opcional)',
        },
        exemplos: {
          type: 'string',
          description: 'Exemplos práticos (opcional)',
        },
        categoria: {
          type: 'string',
          description: 'Categoria do conhecimento',
          enum: ['inventario', 'balanceamento', 'ruptura', 'giro', 'compra', 'diagnostico', 'padrao', 'fornecedor', 'sazonalidade', 'outro'],
        },
        tags: {
          type: 'string',
          description: 'Tags separadas por vírgula (opcional)',
        },
      },
      required: ['termo', 'definicao', 'porque_importa', 'categoria'],
    },
  },
];
