# Documentação de Funcionalidades — Myseer Iris

Referência para desenvolvedores e especialistas que configuram agentes no Builder.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Builder — Configuração de Agentes](#2-builder--configuração-de-agentes)
   - [Aba Básico](#21-aba-básico)
   - [Aba Prompt](#22-aba-prompt)
   - [Aba Tabelas](#23-aba-tabelas)
   - [Aba Skills](#24-aba-skills)
   - [Aba Regras](#25-aba-regras)
   - [Aba Conhecimento](#26-aba-conhecimento)
   - [Aba Perguntas](#27-aba-perguntas)
   - [Aba Config](#28-aba-config)
   - [Aba Histórico](#29-aba-histórico)
   - [Aba Testar](#210-aba-testar)
   - [Aba Analytics](#211-aba-analytics)
3. [Gestão de Regras de Negócio](#3-gestão-de-regras-de-negócio)
4. [Features de Contexto e Personalização](#4-features-de-contexto-e-personalização)
5. [Chat — Modos de Uso](#5-chat--modos-de-uso)
6. [Skills Disponíveis](#6-skills-disponíveis)
7. [Créditos e Métricas](#7-créditos-e-métricas)
8. [Multi-tenant](#8-multi-tenant)

---

## 1. Visão Geral

O Myseer Iris é um framework de agentes de IA multi-tenant. Cada **agente** é uma configuração independente com prompt, tabelas de dados, skills e comportamento próprios. Múltiplos clientes (tenants) compartilham os mesmos agentes publicados, podendo ter regras de negócio diferentes entre si.

**Fluxo básico:**
```
Usuário envia mensagem
  → Iris resolve o agente (por slug)
  → Monta system prompt (prompt base + regras + contexto)
  → Loop agentic: LLM → tools → LLM → resposta final
  → Salva conversa + gera resumo/perfil em background
```

---

## 2. Builder — Configuração de Agentes

O Builder é a interface de administração para criar e editar agentes. Acesse pelo botão Builder na tela principal.

A sidebar tem dois modos:
- **Agentes** — lista e gerencia agentes
- **Regras** — gerencia regras de negócio por tenant (ver [seção 3](#3-gestão-de-regras-de-negócio))

---

### 2.1 Aba Básico

Identidade visual e apresentação do agente ao usuário final.

| Campo | Descrição |
|-------|-----------|
| **Nome** | Nome exibido no chat (ex: "Gestor de Estoque") |
| **Descrição** | Texto curto sobre o que o agente faz |
| **Ícone** | Emoji exibido no seletor de agentes |
| **Cor** | Cor hex usada na interface |
| **Saudação** | Mensagem exibida na tela inicial do chat antes do usuário digitar |
| **Placeholder do input** | Texto de dica no campo de mensagem |

---

### 2.2 Aba Prompt

Define a personalidade e comportamento do agente. Tudo aqui vai direto no **system prompt**.

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **Personalidade** | Quem é o agente, qual seu papel | "Você é Ana, consultora sênior de estoque..." |
| **Tom de comunicação** | Como o agente fala | "Linguagem executiva, direta, sem jargão técnico" |
| **Restrições** | O que o agente não deve fazer | "Nunca invente dados. Nunca exponha nomes de tabelas." |
| **Exemplos de resposta** | Exemplos do formato esperado | Mostrar uma resposta boa e uma ruim |
| **Fluxo de funcionamento** | Passo-a-passo de como o agente deve agir | "1. Verificar data dos dados. 2. Query ampla. 3. Drill-down." |

**Dica:** Use a aba Regras (seção abaixo) para lógica de negócio específica — deixe o Prompt para comportamento geral do agente.

---

### 2.3 Aba Tabelas

Define quais tabelas ClickHouse o agente pode consultar.

Para cada tabela:
- **Tabela** — nome exato no ClickHouse (ex: `ia_fato_balanceamento`)
- **Alias** — nome amigável exibido no prompt (ex: "Balanceamento")
- **Colunas** — lista das colunas disponíveis para o agente usar
- **Filtro obrigatório** — cláusula WHERE sempre aplicada (ex: `tenant = '{tenantId}'`)

O filtro obrigatório suporta a variável `{tenantId}` que é substituída automaticamente pelo ID do tenant na hora do chat.

---

### 2.4 Aba Skills

Habilita ou desabilita as ferramentas (tools) disponíveis para o agente.

| Skill | O que faz |
|-------|-----------|
| **Consulta SQL** | Permite ao agente executar queries no ClickHouse |
| **Gerar CSV** | Permite ao agente exportar dados como arquivo CSV para download |
| **Knowledge Base** | Permite consultar e adicionar conhecimento de domínio |
| **Otimizador** | Permite executar otimização em lote de balanceamento |

Ver detalhes de cada skill na [seção 6](#6-skills-disponíveis).

---

### 2.5 Aba Regras

Campo de texto livre para **regras de análise escritas pelo especialista de negócio**.

**O que colocar aqui:**
- Como o agente deve interpretar os dados
- Critérios de diagnóstico e priorização
- Fórmulas e benchmarks do setor
- Alertas e flags específicos do negócio

**Exemplo:**
```
Ruptura ativa = qtestoque = 0 AND mediaf_un > 0 → Compra emergencial
Risco de ruptura = qtestoque < qt_seguranca → Balanceamento preventivo
Curva A: cobertura ideal = 30 dias. Acima de 60 dias = excesso crítico.
```

**⚠️ Diferença importante:** Este campo é **por agente** — vale igual para todos os clientes.
Para regras que variam por cliente, use o painel de [Regras de Negócio](#3-gestão-de-regras-de-negócio).

---

### 2.6 Aba Conhecimento

Base de conhecimento do agente em texto livre.

Usado para informações de contexto que o agente deve saber, mas que não são regras de análise nem prompt de personalidade. Exemplos:
- Características do mercado ou setor
- Sazonalidades conhecidas
- Particularidades do cliente
- Glossário de termos do negócio

---

### 2.7 Aba Perguntas

Perguntas rápidas exibidas na tela inicial do chat (antes do usuário digitar).

Cada pergunta tem:
- **Ícone** — emoji exibido no card
- **Título** — texto curto do card
- **Prompt** — mensagem enviada ao agente quando o usuário clica

Suporta reordenação (▲▼) e remoção individual.

---

### 2.8 Aba Config

Configurações técnicas e de comportamento avançado.

**Modelo padrão**
| Opção | Uso recomendado |
|-------|-----------------|
| Haiku 4.5 | Agentes de consulta rápida, menor custo |
| Sonnet 4.5 | Agentes que exigem mais raciocínio e qualidade |

**Limites**
- **Max Tokens** — tamanho máximo da resposta (padrão: 4096)
- **Temperatura** — criatividade da resposta, 0 = mais determinístico (padrão: 0.2)
- **Max Tool Calls** — quantas vezes o agente pode usar ferramentas por mensagem (padrão: 3)

**Contexto entre conversas**

Quando habilitado, o agente recebe resumos das N conversas anteriores do usuário no system prompt. Mantém continuidade no atendimento — o agente "lembra" do que foi discutido antes.

- Cada resumo adiciona ~100–150 tokens ao prompt
- Recomendado: 3–10 conversas
- Os resumos são gerados automaticamente após cada resposta (background, via Haiku)
- Armazenados em `ia_resumos_conversas`

**Perfil persistente do usuário**

Quando habilitado, o agente acumula um perfil do usuário ao longo do tempo e o injeta no system prompt de toda conversa nova.

O perfil captura:
- Cargo e responsabilidades
- Áreas de interesse recorrentes (filiais, linhas, fabricantes)
- Preferências de análise
- Contexto de negócio relevante

- Adiciona ~100–200 tokens ao prompt
- Atualizado automaticamente após cada conversa (background, via Haiku)
- Armazenado em `ia_perfil_usuario`

---

### 2.9 Aba Histórico

Lista todas as versões salvas do agente. Cada vez que você salva, uma nova versão é criada automaticamente.

- Versão atual é destacada em azul
- Botão "Restaurar" em versões antigas faz rollback (a versão restaurada passa a ser a atual, a antiga fica no histórico)

---

### 2.10 Aba Testar

Chat de teste direto no Builder. Permite conversar com o agente em qualquer status (rascunho, testando, publicado) sem precisar acessar o chat do cliente.

O tenant de teste é `builder-test` — não usa créditos reais nem aparece nos dados do cliente.

---

### 2.11 Aba Analytics

Métricas de uso do agente nos últimos N dias (padrão: 30).

| Métrica | Descrição |
|---------|-----------|
| Total de mensagens | Quantidade de mensagens processadas |
| Total de conversas | Sessões únicas de chat |
| Tempo médio de resposta | Latência média em ms |
| Taxa de erro | % de mensagens com erro |
| Perguntas frequentes | Top 10 termos mais usados |
| Custo diário | Tokens consumidos e custo em USD por dia |
| Por tenant | Breakdown de uso por cliente |
| Por usuário | Breakdown de uso por e-mail |

---

## 3. Gestão de Regras de Negócio

Acessível pelo botão **"Regras"** na sidebar do Builder.

São regras operacionais que variam por cliente (tenant). Diferentemente da [Aba Regras](#25-aba-regras) do agente (que é global), estas regras são aplicadas individualmente por tenant em runtime.

**Campos de uma regra:**

| Campo | Descrição |
|-------|-----------|
| **Tenant** | ID do cliente. Use `null` para regra global (vale para todos) |
| **Tipo** | Bloqueio / Limite / Prioridade / Exceção |
| **Prioridade** | 1–9 bloqueio crítico · 10–19 limite · 20–29 prioridade · 30–39 heurística |
| **Descrição** | Texto em linguagem de negócio explicando a regra |
| **Alvo** | O que a regra afeta (produto, filial, linha, fabricante) — opcional |
| **Condição** | Quando a regra se aplica — opcional |
| **Ação** | O que deve acontecer — opcional |

**Tipos de regra:**
- **BLOQUEIO** — impede completamente uma sugestão (nunca pode ser violada)
- **LIMITE** — altera valores numéricos (ex: máximo de 100 unidades por transferência)
- **PRIORIDADE** — altera ordenação de sugestões
- **EXCEÇÃO** — permite casos especiais explícitos

**Como criar:** Botão "+ Nova Regra" no painel, ou via chat com o comando `/regras`.

**Ações disponíveis por regra:**
- Ativar / Desativar (sem deletar)
- Deletar permanentemente
- Expandir para ver detalhes técnicos (alvo, condição, ação)

**⚠️ Diferença em relação à Aba Regras do agente:**

| | Aba Regras (agente) | Painel Regras (Builder) |
|---|---|---|
| Formato | Texto livre | Estruturado |
| Escopo | Por agente (todos os clientes) | Por tenant (cliente específico) |
| Propósito | Como o agente raciocina | O que o cliente restringiu/priorizou |
| Quem cria | Desenvolvedor no Builder | Desenvolvedor ou usuário final via `/regras` |

---

## 4. Features de Contexto e Personalização

### 4.1 Contexto entre Conversas (Resumos)

**Onde ativar:** Aba Config do agente → toggle "Habilitar contexto de conversas anteriores"

**Como funciona:**
1. Ao final de cada conversa, o Iris chama o Haiku em background para gerar um resumo (2–3 frases: tópicos, conclusões, dados-chave)
2. Na próxima conversa do mesmo usuário com o mesmo agente, os N resumos mais recentes são injetados no system prompt
3. O agente usa esse contexto para evitar repetições e manter continuidade

**Quando usar:** Agentes que atendem o mesmo usuário repetidamente e onde o histórico tem valor (análises periódicas, acompanhamento de indicadores).

**Custo:** ~100–150 tokens extras por resumo no prompt.

---

### 4.2 Perfil Persistente do Usuário

**Onde ativar:** Aba Config do agente → toggle "Habilitar perfil persistente do usuário"

**Como funciona:**
1. Ao final de cada conversa, o Iris chama o Haiku em background para atualizar o perfil do usuário
2. O perfil acumula cargo, preferências, áreas de interesse e contexto de negócio
3. Em toda conversa nova, o perfil é injetado no system prompt antes dos resumos

**Diferença em relação aos resumos:**
- Resumos = histórico reativo ("o que foi discutido antes")
- Perfil = conhecimento proativo ("quem é esse usuário e o que ele valoriza")

**Quando usar:** Agentes que precisam personalizar respostas por tipo de usuário (comprador vs. gestor vs. analista).

**Custo:** ~100–200 tokens extras no prompt.

---

## 5. Chat — Modos de Uso

### 5.1 Modo Normal

O usuário envia uma mensagem e o agente responde. O Iris executa o loop agentic:
1. Monta system prompt com toda a configuração do agente
2. Chama o LLM com as tools disponíveis
3. Se o LLM usa uma tool, executa e volta para o LLM com o resultado
4. Repete até o LLM retornar uma resposta final (sem tool call) ou atingir o limite de tool calls
5. Resposta é enviada via SSE (streaming em tempo real)

### 5.2 Modo Treinamento de Regras

Ativado quando o usuário envia uma mensagem começando com `regras:` ou `/regras`.

O Iris redireciona para o **RuleTrainerAgent**, que:
1. Interpreta a intenção em linguagem natural
2. Propõe uma regra estruturada
3. Pede confirmação do usuário
4. Salva em `ia_regras_balanceamento` com o tenant do usuário

**Exemplo de uso:**
```
/regras não balancear produtos da linha Controlados para a filial 99
```

O RuleTrainer sugere: `[BLOQUEIO] Prioridade 5: Não transferir produtos da linha Controlados para filial 99` e pede confirmação antes de salvar.

### 5.3 Feedback

Cada resposta do agente tem botões de 👍 / 👎. No dislike, o usuário pode opcionalmente descrever o problema.

O feedback é salvo em `ia_agents_log` (campos `user_rating` e `user_feedback`) e aparece nas métricas de Analytics.

---

## 6. Skills Disponíveis

### consulta_sql (`clickhouse_query`)
Permite ao agente executar queries SQL no ClickHouse. É a skill central de qualquer agente analítico.

- O agente gera o SQL, executa, recebe o resultado e interpreta
- Respeita o filtro obrigatório configurado em cada tabela
- Limitado a tabelas configuradas na Aba Tabelas do agente

### gerar_csv (`generate_csv`)
Permite ao agente gerar um arquivo CSV para download a partir de dados já consultados.

- O agente monta o CSV com as colunas na ordem que o usuário pediu
- Gera um link de download único com validade temporária
- O link aparece na resposta como botão "Baixar CSV"

### knowledge_base (`consultar_conhecimento` / `adicionar_conhecimento`)
Base de conhecimento de domínio. O agente pode consultar e adicionar verbetes.

- Útil para termos do setor, benchmarks, conceitos específicos do negócio
- O usuário pode ensinar o agente com `conhecimento: [definição]`

### otimizador (`optimize_batch`)
Executa otimização de balanceamento em lote para múltiplos produtos de uma vez.

- Usa o algoritmo de equalização de cobertura
- Retorna plano completo de transferências com impacto financeiro
- Indicado para: "balancear linha X", "otimizar fabricante Y", lista de produtos

---

## 7. Créditos e Métricas

### Créditos
Cada tenant tem um saldo de créditos em BRL (`ia_creditos` table).

- Uso de tokens é convertido para BRL com base no pricing do modelo
- Quando o saldo acaba, novas mensagens são bloqueadas
- Recargas via `POST /api/iris/credits/add` (endpoint administrativo)

**Endpoints disponíveis:**
- `GET /api/iris/credits` — saldo atual + breakdown de uso
- `GET /api/iris/credits/invoices` — histórico de recargas
- `GET /api/iris/credits/detail` — consumo detalhado por hora/usuário

### Métricas de tokens
- `GET /api/iris/metrics` — uso agregado do tenant (últimos N dias)
- `GET /api/iris/metrics/conversation/:id` — uso de uma conversa específica

---

## 8. Multi-tenant

O sistema identifica o tenant via header HTTP nas requisições:
- `x-tenant-id` — ID do tenant
- `x-user-email` — e-mail do usuário

Cada tenant tem:
- Seus próprios **créditos** e limite de uso
- Suas próprias **regras de negócio** (`ia_regras_balanceamento`)
- Suas próprias **conversas** e histórico
- Seus próprios **resumos** e **perfis de usuário**
- Controle de quais **agentes estão habilitados** (`ia_tenant_agentes`)

Os **agentes em si** são globais — criados pelo desenvolvedor no Builder e publicados para todos. O que varia por tenant é: regras, créditos, histórico e quais agentes estão ativos.

**Para habilitar/desabilitar um agente por tenant:**
```
ia_tenant_agentes: (tenant_id, agent_id, habilitado)
```
Se não houver registro, o agente publicado fica habilitado por padrão.
