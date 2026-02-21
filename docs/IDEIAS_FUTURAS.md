# Ideias Futuras - Myseer Iris

Ideias discutidas mas adiadas para versões futuras.

---

## 1. Skills Customizáveis (Opção B)

**Contexto:** Hoje as skills são um catálogo fixo (consulta SQL, gerar CSV, otimizador, knowledge base). O especialista só ativa/desativa.

**Ideia futura:** Permitir que o especialista crie skills customizadas — definindo nome, descrição, parâmetros e comportamento. Isso daria flexibilidade total para criar tools sob medida para cada agente sem precisar de código.

**Complexidade:** Alta. Requer um sistema de definição de tools dinâmicas, validação de parâmetros, e sandboxing da execução.

---

## 2. Agentes Exclusivos por Tenant

**Contexto:** Hoje os agentes são globais (disponíveis para todos os tenants habilitarem).

**Ideia futura:** Permitir que um tenant tenha agentes exclusivos, criados especificamente para ele. O especialista Myseer criaria um agente vinculado a um tenant específico, com tabelas, regras e prompt customizados para aquele cliente.

**Casos de uso:**
- Cliente grande que precisa de um agente com lógica muito específica
- Agentes de nicho que só fazem sentido para um segmento
- Agentes "white label" personalizados

**Implementação:** Adicionar campo `tenant_id` na tabela `ia_agentes` (null = global, UUID = exclusivo).

---

## 3. ~~Builder com UX para não-técnicos~~ (IMPLEMENTADO)

Implementado com TableSelector (dropdown + checkboxes de colunas) e StarterPromptsEditor (cards visuais com move up/down).

---

## 4. ~~Persistência de Conversas~~ (IMPLEMENTADO)

Implementado com tabelas `ia_conversas` (ReplacingMergeTree) e `ia_mensagens` (MergeTree). Cache in-memory + ClickHouse persistence. Conversas sobrevivem restart do servidor.

---

## 5. ~~Versionamento e Rollback de Agentes~~ (IMPLEMENTADO)

Implementado usando o histórico natural do ReplacingMergeTree (sem tabela extra). Tab "Historico" no Builder com lista de versões e botão "Restaurar".

---

## 6. Contexto Cross-Conversa (Resumo no System Prompt)

**Contexto:** Hoje cada conversa nova começa do zero. O agente não lembra do que foi discutido em conversas anteriores do mesmo usuário.

**Ideia:** Ao iniciar uma conversa nova, carregar resumos das últimas N conversas do usuário e injetar no system prompt. Exemplo: "O usuário já conversou sobre ruptura na linha X, excesso na filial Y, etc."

**Complexidade:** Baixa. Já temos as mensagens persistidas em `ia_mensagens`. Basta buscar as últimas conversas, gerar resumo (pode ser via LLM ou simples truncamento) e incluir no prompt.

---

## 7. Contexto Cross-Conversa (Busca Semântica / RAG)

**Contexto:** O resumo simples funciona bem para conversas recentes, mas não escala para meses de histórico.

**Ideia:** Quando o usuário faz uma pergunta, buscar nas conversas anteriores trechos semanticamente relevantes e incluir como contexto. Permite que o agente "lembre" de discussões passadas mesmo sem ter visto o resumo.

**Complexidade:** Alta. Requer embeddings das mensagens, armazenamento vetorial (pode usar ClickHouse com `cosineDistance` ou banco vetorial dedicado), e pipeline de indexação.

---

## 8. Contexto Cross-Conversa (Perfil Persistente do Usuário)

**Contexto:** Resumos e RAG são reativos — buscam quando perguntado. Um perfil persistente seria proativo.

**Ideia:** Manter um "perfil" por usuário que acumula preferências e contexto ao longo do tempo. Exemplos:
- "Esse usuário acompanha a linha Medicamentos Genéricos"
- "Geralmente filtra por curva A e B"
- "Costuma pedir exportação CSV"
- "Prefere análises por filial"

O perfil seria atualizado automaticamente após cada conversa (via LLM) e injetado no system prompt de toda conversa nova.

**Complexidade:** Média. Tabela `ia_perfil_usuario` com campo JSON. Após cada conversa, chamar LLM para atualizar o perfil com novos insights.

---
