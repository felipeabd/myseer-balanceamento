-- Central logging table for all AI agents
CREATE TABLE IF NOT EXISTS ia_agents_log (
    timestamp DateTime DEFAULT now(),

    -- Identification
    agent LowCardinality(String),  -- 'iris_balanceamento', 'iris_compras', etc
    tenant_id String,
    user_email String,
    conversation_id String,
    message_id String,

    -- Input
    user_question String,

    -- Output
    response_summary String,  -- First 500 chars of response
    response_type LowCardinality(String),  -- 'discovery', 'analysis', 'plan', 'error', 'greeting'

    -- Technical tracking
    tools_used Array(String),
    sql_queries Array(String),

    -- Business context (flexible for all agents)
    business_entities Map(String, Array(String)),  -- products, stores, suppliers, etc
    keywords Array(String),

    -- Quality metrics
    has_error UInt8,
    response_time_ms UInt32,

    -- User feedback (updated later)
    user_rating Int8 DEFAULT 0,  -- -1 (bad), 0 (neutral), 1 (good)
    user_feedback String,

    -- Agent-specific metadata (JSON for unique data)
    agent_metadata String,

    date Date DEFAULT toDate(timestamp)
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(date), agent)
ORDER BY (agent, tenant_id, date, timestamp);

-- Index for faster conversation queries
ALTER TABLE ia_agents_log ADD INDEX idx_conversation_id conversation_id TYPE bloom_filter(0.01) GRANULARITY 1;

-- Example queries:

-- 1. Most common questions per agent
-- SELECT
--     agent,
--     user_question,
--     count() as frequency
-- FROM ia_agents_log
-- WHERE date >= today() - 30
-- GROUP BY agent, user_question
-- ORDER BY agent, frequency DESC
-- LIMIT 20;

-- 2. Agent comparison
-- SELECT
--     agent,
--     count() as total_requests,
--     avg(response_time_ms) as avg_response_time,
--     sum(has_error) as errors,
--     avg(user_rating) as avg_rating
-- FROM ia_agents_log
-- WHERE date >= today() - 30
-- GROUP BY agent;

-- 3. Error rate by agent
-- SELECT
--     agent,
--     date,
--     countIf(has_error = 1) as errors,
--     count() as total,
--     (errors / total) * 100 as error_rate
-- FROM ia_agents_log
-- WHERE date >= today() - 30
-- GROUP BY agent, date
-- ORDER BY agent, date;

-- 4. Most queried business entities (products, stores, etc)
-- SELECT
--     agent,
--     arrayJoin(business_entities.values) as entities,
--     count() as frequency
-- FROM ia_agents_log
-- WHERE date >= today() - 7
-- GROUP BY agent, entities
-- ORDER BY agent, frequency DESC
-- LIMIT 50;

-- 5. Conversation drill-down
-- SELECT
--     timestamp,
--     user_question,
--     response_summary,
--     response_type,
--     tools_used,
--     response_time_ms
-- FROM ia_agents_log
-- WHERE conversation_id = 'your-conversation-id'
-- ORDER BY timestamp;
