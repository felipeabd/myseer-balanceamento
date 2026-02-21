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

## 3. Builder com UX para não-técnicos

**Contexto:** Hoje os campos de Tabelas e Perguntas Rápidas no Builder são JSONs em textarea. Funciona para o time técnico mas não é acessível para um especialista de negócio.

**Ideia futura:** Substituir os textareas JSON por componentes visuais:
- **Tabelas:** Dropdown para selecionar tabela, checkboxes para colunas, input para filtro obrigatório. Botão "+ Adicionar tabela".
- **Perguntas Rápidas:** Lista editável com inputs separados para emoji, título e prompt. Drag-and-drop para reordenar.

**Complexidade:** Média. Os endpoints de introspection (`GET /tables`, `GET /tables/:name/columns`) já existem no builder-router.

---

## 4. Persistência de Conversas

**Contexto:** O ConversationManager é in-memory. Se o servidor reiniciar, todas as conversas são perdidas. Em produção com múltiplas instâncias, cada instância teria conversas isoladas.

**Ideia futura:** Persistir conversas no ClickHouse (ou outro banco). Permitiria:
- Sobreviver a restarts
- Múltiplas instâncias compartilhando estado
- Histórico de conversas para analytics

**Implementação:** Criar tabela `ia_conversas` com messages serializadas em JSON.

---

## 5. Versionamento e Rollback de Agentes

**Contexto:** O campo `versao` existe na tabela `ia_agentes` mas não há mecanismo de rollback. Se alguém publicar uma config ruim, não tem como reverter facilmente.

**Ideia futura:** Manter histórico de versões do agente. Cada save cria uma nova versão. O Builder mostraria timeline de versões com diff e botão "Restaurar versão X".

**Implementação:** Tabela `ia_agentes_versoes` que armazena snapshots completos da config. O ReplacingMergeTree já versiona naturalmente, mas um histórico explícito daria controle ao usuário.

---
