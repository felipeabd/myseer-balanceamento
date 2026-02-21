-- Tabela para rastreamento de uso de tokens e custos
CREATE TABLE IF NOT EXISTS ia_uso_tokens (
    data_hora DateTime DEFAULT now(),
    tenant_id String,
    email_usuario String,
    conversa_id String,
    modelo String,
    tokens_entrada UInt32,
    tokens_saida UInt32,
    tokens_total UInt32,
    custo_usd Float32,
    endpoint String,
    data Date DEFAULT toDate(data_hora)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(data)
ORDER BY (tenant_id, data, data_hora);

-- Índice para consultas por conversa mais rápidas
ALTER TABLE ia_uso_tokens ADD INDEX idx_conversa_id conversa_id TYPE bloom_filter(0.01) GRANULARITY 1;

-- Consultas de exemplo:

-- 1. Uso total por tenant (mês atual)
-- SELECT
--     tenant_id,
--     sum(tokens_total) as tokens_total,
--     sum(custo_usd) as custo_total_usd
-- FROM ia_uso_tokens
-- WHERE toYYYYMM(data) = toYYYYMM(now())
-- GROUP BY tenant_id
-- ORDER BY custo_total_usd DESC;

-- 2. Uso diário
-- SELECT
--     data,
--     sum(tokens_total) as tokens_total,
--     sum(custo_usd) as custo_total_usd
-- FROM ia_uso_tokens
-- WHERE data >= today() - INTERVAL 30 DAY
-- GROUP BY data
-- ORDER BY data;

-- 3. Top conversas por custo
-- SELECT
--     conversa_id,
--     tenant_id,
--     email_usuario,
--     sum(tokens_total) as tokens_total,
--     sum(custo_usd) as custo_total_usd
-- FROM ia_uso_tokens
-- WHERE data >= today() - INTERVAL 7 DAY
-- GROUP BY conversa_id, tenant_id, email_usuario
-- ORDER BY custo_total_usd DESC
-- LIMIT 10;
