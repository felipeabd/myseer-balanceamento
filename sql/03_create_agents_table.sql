-- Tabela principal de definição de agentes
-- Usada pelo framework Iris para armazenar configs de agentes criados via Builder
CREATE TABLE IF NOT EXISTS ia_agentes (
    id UUID DEFAULT generateUUIDv4(),
    slug String,
    nome String,
    descricao String DEFAULT '',
    icone String DEFAULT '',
    cor String DEFAULT '#28B8CE',
    saudacao String DEFAULT '',
    placeholder_input String DEFAULT '',

    -- Prompt (seções do formulário do Builder)
    prompt_personalidade String DEFAULT '',
    prompt_tom String DEFAULT '',
    prompt_restricoes String DEFAULT '',
    prompt_exemplos String DEFAULT '',
    prompt_fluxo String DEFAULT '',

    -- Tabelas e colunas permitidas (JSON)
    -- Formato: [{"tabela":"ia_fato_balanceamento","alias":"Oportunidades","colunas":["cdprod","cdFilial"],"filtro_obrigatorio":"tenant = '{tenantId}'"}]
    tabelas String DEFAULT '[]',

    -- Habilidades ativas (JSON)
    -- Formato: {"consulta_sql":true,"gerar_csv":true,"knowledge_base":true,"otimizador":false}
    habilidades String DEFAULT '{"consulta_sql":true,"gerar_csv":true,"knowledge_base":false,"otimizador":false}',

    -- Regras de análise (texto livre do especialista)
    regras_analise String DEFAULT '',

    -- Perguntas rápidas (JSON)
    -- Formato: [{"icon":"⚠️","title":"Risco de Ruptura","prompt":"Quais produtos..."}]
    perguntas_rapidas String DEFAULT '[]',

    -- Config do modelo
    modelo_padrao String DEFAULT 'claude-haiku-4-5-20251001',
    max_tokens UInt32 DEFAULT 4096,
    temperatura Float32 DEFAULT 0.2,
    max_chamadas_ferramentas UInt8 DEFAULT 3,

    -- Lifecycle
    status LowCardinality(String) DEFAULT 'rascunho',
    custo_mensal_brl Float64 DEFAULT 0,
    criado_por String DEFAULT '',
    versao UInt32 DEFAULT 1,

    criado_em DateTime DEFAULT now(),
    atualizado_em DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(atualizado_em)
ORDER BY (id);

-- Índice para busca por slug
ALTER TABLE ia_agentes ADD INDEX idx_slug slug TYPE bloom_filter(0.01) GRANULARITY 1;

-- Tabela de habilitação de agentes por tenant
CREATE TABLE IF NOT EXISTS ia_tenant_agentes (
    tenant_id String,
    agent_id UUID,
    habilitado UInt8 DEFAULT 1,
    habilitado_em DateTime DEFAULT now(),
    atualizado_em DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(atualizado_em)
ORDER BY (tenant_id, agent_id);
