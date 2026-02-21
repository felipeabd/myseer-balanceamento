# Rastreamento de Uso de Tokens

Sistema de monitoramento de uso de tokens e custos do agente Iris.

## O que é rastreado?

Para cada interação com o agente, salvamos na tabela `ia_uso_tokens`:
- **data_hora**: quando ocorreu
- **tenant_id**: qual cliente
- **email_usuario**: qual usuário
- **conversa_id**: qual conversa
- **modelo**: qual modelo da Anthropic foi usado
- **tokens_entrada**: tokens enviados
- **tokens_saida**: tokens recebidos
- **tokens_total**: soma dos dois
- **custo_usd**: custo estimado em dólares
- **endpoint**: chat ou stream

## Setup

A tabela já foi criada automaticamente. Se precisar recriar:

```bash
npm run setup:tracking
```

## Endpoints de Métricas

### 1. Métricas do Tenant

```bash
GET /api/iris/metrics?days=30

Headers:
- x-tenant-id: seu-tenant-id
- x-user-email: usuario@email.com
```

**Resposta:**
```json
{
  "tenant": "33F6E320-F59E-4E43-99C2-2D6748A64B04",
  "period": "30 days",
  "summary": {
    "totalTokens": 125430,
    "inputTokens": 45230,
    "outputTokens": 80200,
    "estimatedCostUSD": 0.52,
    "requestCount": 15
  },
  "daily": [
    {
      "date": "2026-02-10",
      "totalTokens": 8320,
      "costUsd": 0.034
    }
  ]
}
```

### 2. Métricas por Conversa

```bash
GET /api/iris/metrics/conversation/{conversationId}

Headers:
- x-tenant-id: seu-tenant-id
- x-user-email: usuario@email.com
```

**Resposta:**
```json
{
  "conversationId": "abc-123",
  "metrics": {
    "totalTokens": 2340,
    "inputTokens": 890,
    "outputTokens": 1450,
    "estimatedCostUSD": 0.012,
    "requestCount": 3
  }
}
```

## Custos por Modelo (por 1M tokens)

| Modelo | Input | Output |
|--------|-------|--------|
| Claude Opus 4 | $15.00 | $75.00 |
| Claude Sonnet 4 | $3.00 | $15.00 |
| **Claude Haiku 4.5** | **$1.00** | **$5.00** |
| Claude Haiku 3.5 | $0.25 | $1.25 |

**Dica**: Use Haiku 4.5 para economizar! É 3x mais barato que Sonnet.

## Queries Úteis no ClickHouse

### Consumo Total por Tenant

```sql
SELECT
    tenant_id,
    sum(tokens_total) as tokens_total,
    sum(custo_usd) as custo_total_usd
FROM ia_uso_tokens
WHERE data >= today() - INTERVAL 30 DAY
GROUP BY tenant_id
ORDER BY custo_total_usd DESC;
```

### Top 10 Conversas Mais Caras

```sql
SELECT
    conversa_id,
    tenant_id,
    email_usuario,
    sum(tokens_total) as tokens_total,
    sum(custo_usd) as custo_total_usd,
    count(*) as mensagens
FROM ia_uso_tokens
WHERE data >= today() - INTERVAL 7 DAY
GROUP BY conversa_id, tenant_id, email_usuario
ORDER BY custo_total_usd DESC
LIMIT 10;
```

### Evolução Diária de Custos

```sql
SELECT
    data,
    sum(tokens_entrada) as tokens_entrada,
    sum(tokens_saida) as tokens_saida,
    sum(tokens_total) as tokens_total,
    sum(custo_usd) as custo_usd
FROM ia_uso_tokens
WHERE data >= today() - INTERVAL 30 DAY
GROUP BY data
ORDER BY data;
```

### Comparação de Modelos

```sql
SELECT
    modelo,
    count(*) as requisicoes,
    sum(tokens_total) as tokens_total,
    sum(custo_usd) as custo_total_usd,
    avg(custo_usd) as custo_medio_por_requisicao
FROM ia_uso_tokens
WHERE data >= today() - INTERVAL 30 DAY
GROUP BY modelo
ORDER BY custo_total_usd DESC;
```

## Próximos Passos

- [ ] Dashboard visual (Grafana/Metabase)
- [ ] Alertas de custo (quando atingir limite)
- [ ] Limites por tenant
- [ ] Relatórios mensais automáticos
- [ ] Otimização de prompts baseada em uso

## Monitoramento em Tempo Real

Os dados são salvos automaticamente após cada interação. Você pode:

1. Consultar via API (endpoints acima)
2. Consultar direto no ClickHouse
3. Integrar com seu dashboard existente
4. Exportar para análise

## Importante

- O tracking NÃO afeta performance (async)
- Se falhar, não quebra a aplicação
- Custos são **estimativas** (preços Anthropic)
- Dados particionados por mês para performance
