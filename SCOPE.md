# Escopo do Projeto - Iris

## Objetivo
Criar um agente conversacional para análise de balanceamento de estoque que seja integrado à aplicação web existente.

## Requisitos Principais

### 1. Interface de Conversa
- Interface de chat similar ao Claude/ChatGPT
- Usuário conversa com o agente sobre:
  - Balanceamento de estoque
  - Produtos e oportunidades
  - Análise de lojas
  - Recomendações de redistribuição

### 2. Integração com Aplicação Existente
- Solução "plugável" na aplicação web atual (Node.js)
- API REST ou SDK que se integre facilmente
- Mínimo impacto na arquitetura existente

### 3. Multi-tenancy
- Sistema multi-tenant com isolamento de dados
- Agente deve identificar automaticamente:
  - **Email do usuário** que está conversando
  - **Tenant ID** do contexto atual
- Garantir que consultas e análises sejam sempre filtradas pelo tenant correto

### 4. Segurança e Contexto
- Cada conversa isolada por tenant
- Dados de um tenant nunca devem vazar para outro
- Histórico de conversas associado ao usuário e tenant

## Status Atual
- ✅ API REST implementada com endpoints de chat
- ✅ Multi-tenancy via headers (x-tenant-id, x-user-email)
- ✅ Integração com ClickHouse para dados de balanceamento
- ✅ Agente conversacional com Anthropic Claude
- ✅ Suporte a conversas com histórico (conversation ID)
- ✅ Endpoints: chat síncrono e streaming (SSE)
