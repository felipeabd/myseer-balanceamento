-- Tabela centralizada de log de conversas para todos os agentes de IA
CREATE TABLE IF NOT EXISTS ia_log_agentes (
    data_hora DateTime DEFAULT now(),

    -- Identificação
    agente LowCardinality(String),  -- 'iris', 'iris_compras', etc
    tenant_id String,
    email_usuario String,
    conversa_id String,
    mensagem_id String,

    -- Entrada
    pergunta_usuario String,

    -- Saída
    resumo_resposta String,  -- Primeiros 500 chars da resposta
    tipo_resposta LowCardinality(String),  -- 'discovery', 'analysis', 'plan', 'error', 'greeting'

    -- Rastreamento técnico
    ferramentas_usadas Array(String),
    consultas_sql Array(String),

    -- Contexto de negócio (flexível para todos os agentes)
    entidades_negocio Map(String, Array(String)),  -- produtos, lojas, fornecedores, etc
    palavras_chave Array(String),

    -- Métricas de qualidade
    tem_erro UInt8,
    tempo_resposta_ms UInt32,

    -- Feedback do usuário (atualizado depois)
    avaliacao_usuario Int8 DEFAULT 0,  -- -1 (ruim), 0 (neutro), 1 (bom)
    feedback_usuario String,

    -- Metadados específicos do agente (JSON para dados únicos)
    metadados_agente String,

    data Date DEFAULT toDate(data_hora)
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(data), agente)
ORDER BY (agente, tenant_id, data, data_hora);

-- Índice para consultas de conversa mais rápidas
ALTER TABLE ia_log_agentes ADD INDEX idx_conversa_id conversa_id TYPE bloom_filter(0.01) GRANULARITY 1;

-- Consultas de exemplo:

-- 1. Perguntas mais comuns por agente
-- SELECT
--     agente,
--     pergunta_usuario,
--     count() as frequencia
-- FROM ia_log_agentes
-- WHERE data >= today() - 30
-- GROUP BY agente, pergunta_usuario
-- ORDER BY agente, frequencia DESC
-- LIMIT 20;

-- 2. Comparação entre agentes
-- SELECT
--     agente,
--     count() as total_requisicoes,
--     avg(tempo_resposta_ms) as tempo_medio_resposta,
--     sum(tem_erro) as erros,
--     avg(avaliacao_usuario) as avaliacao_media
-- FROM ia_log_agentes
-- WHERE data >= today() - 30
-- GROUP BY agente;

-- 3. Taxa de erro por agente
-- SELECT
--     agente,
--     data,
--     countIf(tem_erro = 1) as erros,
--     count() as total,
--     (erros / total) * 100 as taxa_erro
-- FROM ia_log_agentes
-- WHERE data >= today() - 30
-- GROUP BY agente, data
-- ORDER BY agente, data;

-- 4. Entidades de negócio mais consultadas (produtos, lojas, etc)
-- SELECT
--     agente,
--     arrayJoin(entidades_negocio.values) as entidades,
--     count() as frequencia
-- FROM ia_log_agentes
-- WHERE data >= today() - 7
-- GROUP BY agente, entidades
-- ORDER BY agente, frequencia DESC
-- LIMIT 50;

-- 5. Drill-down de conversa
-- SELECT
--     data_hora,
--     pergunta_usuario,
--     resumo_resposta,
--     tipo_resposta,
--     ferramentas_usadas,
--     tempo_resposta_ms
-- FROM ia_log_agentes
-- WHERE conversa_id = 'seu-id-de-conversa'
-- ORDER BY data_hora;
