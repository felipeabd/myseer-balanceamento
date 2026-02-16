-- =====================================================
-- Tabela: Base de Conhecimento de Negócio
-- Descrição: Armazena conhecimento CONCEITUAL sobre
--            termos e conceitos de varejo/farmácia
-- Uso: Educação, explicações, enriquecimento de respostas
-- IMPORTANTE: Não confundir com REGRAS (ia_regras_balanceamento)
-- =====================================================

CREATE TABLE IF NOT EXISTS default.ia_base_conhecimento (
    id UUID DEFAULT generateUUIDv4(),
    termo String NOT NULL,
    definicao String NOT NULL,
    porque_importa String,
    relacoes String,
    exemplos String,
    categoria String,
    tags String,
    tenant String DEFAULT 'global',
    ativo Bool DEFAULT true,
    criado_em DateTime DEFAULT now(),
    atualizado_em DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (termo, tenant, id);
