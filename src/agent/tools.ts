import Anthropic from '@anthropic-ai/sdk';
import { AgentDefinition, AgentTableConfig } from '../types';

// ── Dynamic Tool Builder (config-driven) ──────────────────────

/**
 * Builds a dynamic description of available tables/columns for the clickhouse_query tool.
 * Each agent only sees the tables it has access to.
 */
function buildClickhouseTablesDocs(tabelas: AgentTableConfig[]): string {
  if (tabelas.length === 0) return 'Nenhuma tabela configurada.';

  return tabelas.map(t => {
    const lines: string[] = [];
    lines.push(`**${t.tabela}** — ${t.alias}`);
    lines.push(`Colunas: ${t.colunas.join(', ')}`);
    if (t.filtroObrigatorio) {
      lines.push(`Filtro obrigatório: ${t.filtroObrigatorio}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

/**
 * Builds the clickhouse_query tool with dynamic table docs from agent config.
 */
function buildClickhouseQueryTool(tabelas: AgentTableConfig[]): Anthropic.Tool {
  const tablesDocs = buildClickhouseTablesDocs(tabelas);

  return {
    name: 'clickhouse_query',
    description: `Execute a read-only SQL query against the ClickHouse database.
The query MUST:
- Be a SELECT statement only
- Always include the tenant filter in the WHERE clause
- Always start by fetching MAX(dtcarga) before querying data tables

Available tables:

${tablesDocs}

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
  };
}

/** Static tool: generate_csv */
const csvTool: Anthropic.Tool = {
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
};

/** Static tool: consultar_conhecimento */
const consultarConhecimentoTool: Anthropic.Tool = {
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
};

/** Static tool: adicionar_conhecimento */
const adicionarConhecimentoTool: Anthropic.Tool = {
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
};

/** Static tool: optimize_batch */
const optimizeBatchTool: Anthropic.Tool = {
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
};

// ── Dynamic Tool Selection ────────────────────────────────────

/**
 * Returns the set of tools available for an agent based on its skills config.
 * The clickhouse_query tool description is dynamic — it lists only the tables
 * the agent has access to.
 */
export function getToolsForAgent(agent: AgentDefinition): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];

  if (agent.skills.consulta_sql) {
    tools.push(buildClickhouseQueryTool(agent.tabelas));
  }

  if (agent.skills.gerar_csv) {
    tools.push(csvTool);
  }

  if (agent.skills.knowledge_base) {
    tools.push(consultarConhecimentoTool);
    tools.push(adicionarConhecimentoTool);
  }

  if (agent.skills.otimizador) {
    tools.push(optimizeBatchTool);
  }

  return tools;
}

/**
 * Checks if a tool name is enabled for the given agent.
 * Used by the tool executor to validate before running.
 */
export function isToolEnabledForAgent(toolName: string, agent: AgentDefinition): boolean {
  const skillMap: Record<string, keyof AgentDefinition['skills']> = {
    clickhouse_query: 'consulta_sql',
    generate_csv: 'gerar_csv',
    consultar_conhecimento: 'knowledge_base',
    adicionar_conhecimento: 'knowledge_base',
    optimize_batch: 'otimizador',
  };

  const skill = skillMap[toolName];
  if (!skill) return false;
  return agent.skills[skill];
}

// ── Legacy Export (backwards compatibility) ────────────────────

/**
 * Original hardcoded tools array for the estoque agent.
 * @deprecated Use getToolsForAgent(agent) instead.
 */
export const agentTools: Anthropic.Tool[] = [
  {
    name: 'clickhouse_query',
    description: `Execute a read-only SQL query against the ClickHouse database.
The query MUST:
- Be a SELECT statement only
- Always include the tenant filter in the WHERE clause
- Always start by fetching MAX(dtcarga) before querying data tables

Available tables:

**default.ia_fato_balanceamento** — balancing opportunities between branches
Fields: tenant, dtcarga, cdprod, cdFilial, descricao, curva, nomefabricante,
  qtnecessidade, qtexcesso, qtestoque, cobertura, mediaf_un, vlrcusto,
  dias_parado, dias_falta, filialdeposito
Always filter: filialdeposito = 0

**default.ia_agente_fato_estoque** — full inventory status per product/branch
Fields: tenant, dtcarga, cdFilial, nome_filial, supervisor, filialdeposito,
  flagnaopartindic, cdprod, descricao, nomefabricante, curva, linha, comprador,
  departamento, categoria, principioativo, tipocompra, marcapropria,
  flaganaliseexcobprod, flaganalisefaltasprod, flagnaopartindicadoreslinha,
  qtestoque, vlr_custo, mediaf_un, qtexcesso, qtnecessidade,
  qt_seguranca, qt_maxima,
  estoque_valor, excesso_valor, mediaf_valor, faltavlr,
  qt_pendencia_entrada, qt_pendencia_saida,
  dias_parado, dias_falta, dias_sem_estoque, dias_sem_venda, dias_sem_entrada,
  qt_faceamento, qt_financiado, percent_vlr
Flag logic (INVERTED — 0 = PARTICIPATES, 1 = DOES NOT participate):
  - Excess analysis: AND flaganaliseexcobprod = 0 AND filialdeposito = 0
  - Shortage analysis: AND flaganalisefaltasprod = 0 AND filialdeposito = 0
  - General analysis: AND filialdeposito = 0
  - Branch indicator analysis: AND flagnaopartindic = 0

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
  csvTool,
  consultarConhecimentoTool,
  optimizeBatchTool,
  adicionarConhecimentoTool,
];
