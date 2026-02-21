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

## 6. ~~Contexto Cross-Conversa (Resumo no System Prompt)~~ (IMPLEMENTADO)

Implementado com `SummaryGenerator` que gera resumos via LLM (Haiku) após cada resposta do assistente (fire-and-forget). Resumos armazenados na tabela `ia_resumos_conversas` (ReplacingMergeTree). Na conversa nova, resumos das últimas N conversas são injetados no system prompt como seção "CONTEXTO DE CONVERSAS ANTERIORES". Configurável por agente no Builder (toggle + número de conversas).

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

## 9. Suporte Multi-Provider (OpenAI, Gemini, DeepSeek)

**Contexto:** Hoje o sistema usa exclusivamente a API da Anthropic (Claude). Todos os agentes rodam no mesmo provider, variando apenas o modelo (Haiku, Sonnet, Opus).

**Ideia:** Permitir que cada agente use um provider diferente (Anthropic, OpenAI, Google Gemini, DeepSeek). O especialista escolheria no Builder qual provider/modelo usar para cada agente.

**Benefícios:**
- **Custo:** DeepSeek (gratuito) ou modelos baratos para agentes simples (saudação, FAQ)
- **Flexibilidade:** Modelo certo para cada caso de uso
- **Resiliência:** Se um provider cair, agentes em outros providers continuam funcionando

**Desafios:**
- Cada provider tem formato diferente de tool calling (Anthropic `tool_use`, OpenAI `function_calling`, Gemini `functionDeclarations`)
- Streaming SSE tem formatos diferentes por provider
- Gerenciamento de múltiplas API keys por tenant/global
- Contagem de tokens e pricing diferente por provider

**UX para o usuário final:** O usuário não precisa saber qual provider está por trás. Ele continua vendo apenas "Básico" e "Avançado" no toggle do chat. Quem define o que cada nível significa é o **desenvolvedor no Builder**. Exemplo:

```
Agente Balanceamento:
  Modelo Básico:     DeepSeek V3        (gratuito)
  Modelo Avançado:   Claude Opus        (premium)

Agente Compras:
  Modelo Básico:     Gemini Flash       (barato)
  Modelo Avançado:   GPT-4o             (caro)
```

O usuário final só vê o toggle — a complexidade de providers fica invisível pra ele.

**Implementação:**
1. Criar interface `LLMProvider` com métodos: `chat()`, `chatStream()`, `formatTools()`
2. Implementar adapters: `AnthropicProvider`, `OpenAIProvider`, `GeminiProvider`, `DeepSeekProvider` (compatível com SDK OpenAI)
3. No Builder, trocar campo `modeloPadrao` por dois campos: `modeloBasico` e `modeloAvancado`, cada um com select de provider + modelo
4. Na `iris.ts`, resolver o provider correto baseado na escolha do usuário (básico/avançado) + config do agente
5. API keys configuradas via env vars (`OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`)

**Complexidade:** Alta. A camada de abstração de tools é o maior desafio, pois cada provider interpreta tool results de forma diferente.

---

## 10. Dashboard de Analytics no Builder

**Contexto:** O desenvolvedor cria e publica agentes, mas não tem visibilidade nenhuma de como eles estão performando. Os dados já existem nas tabelas `ia_agents_log` e `ia_usage_tokens`, mas não há interface pra visualizá-los.

**Ideia:** Nova tab "Analytics" no Builder mostrando métricas por agente:
- Quantidade de conversas e mensagens
- Tempo médio de resposta
- Taxa de erro
- Perguntas mais frequentes (top 10)
- Custo acumulado (tokens e USD)
- Gráfico de uso diário (últimos 30 dias)

**Implementação:**
1. Backend: Endpoints de agregação em `builder-router.ts` que consultam `ia_agents_log` e `ia_usage_tokens` com GROUP BY por agente
2. Frontend: Nova tab "Analytics" no `AgentEditor.tsx` com cards de métricas e gráfico simples (pode usar chart library leve ou SVG puro)
3. Filtros: período (7d, 30d, 90d) e tenant

**Complexidade:** Média. Os dados já existem — é questão de agregar e apresentar.

---

## 11. Observabilidade, Feedback e Testes A/B

**Contexto:** O item 10 dá visibilidade de métricas agregadas, mas pra realmente otimizar agentes o desenvolvedor precisa de ferramentas mais profundas — na linha do que LangSmith/LangFuse oferecem, porém integrado ao nosso Builder.

**Evolução em fases:**

### Fase 1 — Feedback do Usuário (Thumbs Up/Down)
A tabela `ia_agents_log` já possui `user_rating` e `user_feedback`. Falta a UI.
- Botões de like/dislike em cada resposta do agente no chat
- Campo opcional de texto ao clicar dislike ("o que estava errado?")
- Dados alimentam o Dashboard de Analytics (item 10) com métrica de satisfação
- **Complexidade:** Baixa

### Fase 2 — Trace Viewer (Observabilidade)
Visualizar o passo-a-passo de cada interação do agente:
- Quais tools foram chamadas e em qual ordem
- SQL gerado e resultado retornado
- Tokens consumidos em cada step
- Tempo de cada step (latência por tool call vs. LLM)
- Replay de conversas pra debugging
- **Complexidade:** Média. Os dados já existem em `ia_agents_log` (tools_used, sql_queries, response_time_ms) — precisa de UI de timeline/trace

### Fase 3 — Testes A/B de Prompts
Comparar variações de prompt pra medir qual performa melhor:
- Criar "experimentos" com 2 variantes de prompt para o mesmo agente
- Split automático de tráfego (50/50 ou configurável)
- Métricas por variante: satisfação (feedback), taxa de erro, tempo de resposta, custo
- Declarar vencedor e promover variante
- **Complexidade:** Alta. Requer versionamento de prompts ativo (não só histórico), roteamento de tráfego, e análise estatística mínima

### Fase 4 — Avaliação Automatizada (Eval)
Rodar datasets de teste contra o agente automaticamente:
- Criar dataset de perguntas + respostas esperadas
- Executar batch contra o agente e comparar resultados
- Score automático (pode usar LLM-as-judge)
- Rodar antes de publicar nova versão do agente (CI pra prompts)
- **Complexidade:** Alta. Requer infra de batch execution, avaliação automatizada, e UI de resultados

**Visão geral:** Isso evolui o Builder de uma ferramenta de configuração para uma **plataforma de otimização de agentes** — similar a LangSmith mas integrada e específica pro nosso contexto.

---

## 12. Gestão de Regras no Builder

**Contexto:** Hoje regras de negócio são criadas exclusivamente via chat no modo treinador (`/regras`). O desenvolvedor não tem como visualizar, editar ou deletar regras existentes fora do chat.

**Ideia:** Nova tab "Regras" no Builder com uma interface visual para gerenciar regras:
- Lista de regras existentes por tenant (com filtro por tipo: BLOQUEIO, LIMITE, PRIORIDADE, EXCEÇÃO)
- Visualização clara de cada regra: tipo, descrição, prioridade, condições
- Edição inline de regras existentes
- Botão para deletar regras obsoletas
- Indicador de regras globais vs. por tenant

**Benefícios:**
- O desenvolvedor tem controle total sem depender do chat
- Facilita auditoria e revisão de regras ativas
- Permite cleanup de regras antigas ou conflitantes

**Implementação:**
1. Backend: Endpoints CRUD em `builder-router.ts` para `ia_regras_balanceamento`
2. Frontend: Tab "Regras" no `AgentEditor.tsx` com tabela/lista de regras e formulário de edição
3. Filtros por tipo de regra, prioridade e tenant

**Complexidade:** Média. A tabela já existe com estrutura bem definida — é questão de criar a UI de gestão.

---
