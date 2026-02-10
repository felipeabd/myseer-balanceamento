-- Table for tracking token usage and costs
CREATE TABLE IF NOT EXISTS ia_usage_tokens (
    timestamp DateTime DEFAULT now(),
    tenant_id String,
    user_email String,
    conversation_id String,
    model String,
    input_tokens UInt32,
    output_tokens UInt32,
    total_tokens UInt32,
    cost_usd Float32,
    endpoint String,
    date Date DEFAULT toDate(timestamp)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, timestamp);

-- Index for faster queries by conversation
ALTER TABLE ia_usage_tokens ADD INDEX idx_conversation_id conversation_id TYPE bloom_filter(0.01) GRANULARITY 1;

-- Example queries:

-- 1. Total usage by tenant (current month)
-- SELECT
--     tenant_id,
--     sum(total_tokens) as total_tokens,
--     sum(cost_usd) as total_cost_usd
-- FROM ia_usage_tokens
-- WHERE toYYYYMM(date) = toYYYYMM(now())
-- GROUP BY tenant_id
-- ORDER BY total_cost_usd DESC;

-- 2. Daily usage
-- SELECT
--     date,
--     sum(total_tokens) as total_tokens,
--     sum(cost_usd) as total_cost_usd
-- FROM ia_usage_tokens
-- WHERE date >= today() - INTERVAL 30 DAY
-- GROUP BY date
-- ORDER BY date;

-- 3. Top conversations by cost
-- SELECT
--     conversation_id,
--     tenant_id,
--     user_email,
--     sum(total_tokens) as total_tokens,
--     sum(cost_usd) as total_cost_usd
-- FROM ia_usage_tokens
-- WHERE date >= today() - INTERVAL 7 DAY
-- GROUP BY conversation_id, tenant_id, user_email
-- ORDER BY total_cost_usd DESC
-- LIMIT 10;
