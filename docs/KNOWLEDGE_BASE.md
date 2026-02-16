# 📚 Base de Conhecimento - Iris Balanceamento

## O que é?

Sistema de conhecimento conceitual sobre termos e processos de negócio de varejo/farmácia.

**Diferença chave:**
- **CONHECIMENTO** = Explicações, definições, contexto ("O que é excesso?")
- **REGRAS** = Critérios operacionais, executáveis ("Bloquear Filial 5")

---

## 🚀 Setup Inicial

### 1. Instalar Base de Conhecimento

```bash
# Executar script de setup (cria tabela + popula)
npm run setup:knowledge
```

**O que faz:**
- Cria tabela `ia_base_conhecimento` no ClickHouse
- Popula com 14+ conceitos fundamentais
- Verifica instalação

### 2. Verificar Instalação

```sql
-- Via ClickHouse client
SELECT termo, categoria, definicao
FROM ia_base_conhecimento
WHERE ativo = true
ORDER BY categoria, termo;
```

---

## 📖 Conceitos Disponíveis

### **Métricas de Estoque**
- `excesso` - Estoque acima do ideal
- `necessidade` - Estoque abaixo do mínimo
- `cobertura` - Dias de estoque baseado em demanda
- `vencido` - Produto parado sem movimentação
- `ruptura` - Cliente não encontra produto na loja

### **Classificação**
- `curva_abc` - Princípio de Pareto (A, B, C)
- `linha` - Agrupamento por categoria/departamento

### **Processos**
- `balanceamento` - Redistribuição de estoque
- `equalizacao_cobertura` - Algoritmo de otimização

### **Financeiro**
- `capital_parado` - Valor investido em excesso
- `valor_transferivel` - Impacto financeiro do balanceamento

---

## 💡 Como Usar

### **1. Consulta via Tool (Claude)**

```typescript
// Usuário pergunta: "O que é excesso?"

// Claude automaticamente chama:
consultar_conhecimento({ termo: 'excesso' })

// Retorna:
{
  "termo": "excesso",
  "encontrado": true,
  "conhecimento": {
    "definicao": "Quantidade de estoque acima da quantidade máxima ideal...",
    "porque_importa": "Representa capital parado e aumenta risco...",
    "relacoes": "Quanto mais excesso, maior chance de vencidos...",
    "exemplos": "Loja tem estoque para 120 dias mas ideal seria 30...",
    "categoria": "metrica",
    "tags": ["estoque", "cobertura", "capital_parado", "vencido"]
  }
}
```

### **2. Conceitos Core (Sempre Disponíveis)**

Claude tem conhecimento básico **sempre carregado** no prompt:
- Excesso, Necessidade, Vencido, Ruptura
- Curva ABC, Balanceamento

Para **detalhes extras**, usa a tool `consultar_conhecimento`.

### **3. Programaticamente**

```typescript
// Em iris.ts
const knowledge = await this.loadKnowledgeBase('vencido');
const conceito = knowledge[0];

console.log(conceito.definicao);
console.log(conceito.porque_importa);
console.log(conceito.exemplos);
```

---

## ➕ Adicionar Novos Conceitos

### **Via SQL**

```sql
INSERT INTO ia_base_conhecimento (
  termo,
  definicao,
  porque_importa,
  relacoes,
  exemplos,
  categoria,
  tags,
  tenant
) VALUES (
  'giro',
  'Velocidade com que o estoque se renova (vendas ÷ estoque médio)',
  'Produtos de alto giro exigem reposição frequente e prioridade no balanceamento',
  'Relacionado a cobertura. Alto giro = baixa cobertura ideal. Baixo giro = maior cobertura aceitável',
  'Paracetamol vende 100 un/dia com estoque médio de 300 un = giro de 10 dias',
  'metrica',
  '["demanda", "velocidade", "rotatividade"]',
  'global'
);
```

### **Via Interface (Futuro)**

Será criada interface CRUD para:
- Adicionar novos conceitos
- Editar definições existentes
- Desativar conceitos obsoletos
- Versionar mudanças

---

## 🔗 Integração com Outros Sistemas

### **1. Regras de Balanceamento**

Regras podem **referenciar** conhecimento:

```json
{
  "tipo": "bloquear",
  "alvo": {
    "criterio_conhecimento": "vencido"  // ← Referência semântica
  },
  "texto": "Bloquear produtos vencidos em HPC"
}
```

**Vantagem:** Se a definição de "vencido" mudar na base de conhecimento, a regra se adapta semanticamente.

### **2. Sistema de Aprendizado (Futuro)**

Quando implementado, o aprendizado usará conhecimento para:
- Explicar sugestões de regras
- Referenciar conceitos nas regras criadas
- Contextualizar padrões detectados

Ver: [knowledge-learning-integration.md](../memory/knowledge-learning-integration.md)

### **3. Claude (Explicações)**

Claude usa conhecimento para:
- Responder perguntas do usuário
- Enriquecer análises com contexto
- Explicar resultados de otimização

---

## 📝 Estrutura da Tabela

```sql
CREATE TABLE ia_base_conhecimento (
    id UUID,

    -- Conceito
    termo VARCHAR(100),           -- 'excesso', 'vencido', etc

    -- Conhecimento (APENAS TEXTO)
    definicao TEXT,               -- O que é?
    porque_importa TEXT,          -- Por que relevante?
    relacoes TEXT,                -- Como se conecta?
    exemplos TEXT,                -- Casos práticos

    -- Metadata
    categoria VARCHAR(50),        -- 'metrica', 'indicador', 'processo'
    tags String,                  -- JSON array para busca
    tenant VARCHAR(36),           -- 'global' = universal

    -- Controle
    ativo BOOLEAN,
    criado_em TIMESTAMP,
    atualizado_em TIMESTAMP
)
```

---

## 🎯 Boas Práticas

### **✅ FAÇA**
- Definições claras e objetivas
- Exemplos práticos do varejo/farmácia
- Relacionamentos entre conceitos
- Linguagem acessível (não técnica demais)

### **❌ NÃO FAÇA**
- Incluir regras operacionais (>180 dias, etc) → Vão para `ia_regras_balanceamento`
- Incluir SQL ou código → Conhecimento é TEXTO PURO
- Criar conceitos muito técnicos → Foco no negócio
- Duplicar informação → Conceitos devem ser atômicos

---

## 🔍 Consultas Úteis

```sql
-- Listar todos os conceitos ativos
SELECT termo, categoria,
       substring(definicao, 1, 100) as resumo
FROM ia_base_conhecimento
WHERE ativo = true
ORDER BY categoria, termo;

-- Buscar por tag
SELECT termo, definicao
FROM ia_base_conhecimento
WHERE has(JSONExtract(tags, 'Array(String)'), 'ruptura')
  AND ativo = true;

-- Contar por categoria
SELECT categoria, COUNT(*) as total
FROM ia_base_conhecimento
WHERE ativo = true
GROUP BY categoria
ORDER BY total DESC;

-- Buscar termo específico
SELECT *
FROM ia_base_conhecimento
WHERE lower(termo) = lower('excesso')
  AND ativo = true;
```

---

## 📊 Status Atual

| Item | Status | Descrição |
|------|--------|-----------|
| Tabela ClickHouse | ✅ Pronta | `ia_base_conhecimento` |
| Conhecimento inicial | ✅ 14 conceitos | Métricas, processos, financeiro |
| Tool consulta | ✅ Implementada | `consultar_conhecimento` |
| Prompt core | ✅ Adicionado | Conceitos principais sempre disponíveis |
| Script setup | ✅ Criado | `npm run setup:knowledge` |
| Interface CRUD | ⏳ Futuro | Gerenciar via UI |
| Versionamento | ⏳ Futuro | Rastrear mudanças |
| Multi-idioma | ⏳ Futuro | i18n |

---

## 🚀 Próximos Passos

1. **Testar consultas:**
   - "O que é excesso?"
   - "Explique cobertura"
   - "Qual relação entre vencido e excesso?"

2. **Adicionar conceitos específicos** do negócio Myseer

3. **Integrar com Sistema de Aprendizado** quando implementado

4. **Criar interface CRUD** para manutenção

---

## 📚 Documentação Relacionada

- [learning-system-design.md](../memory/learning-system-design.md) - Sistema de Aprendizado
- [knowledge-learning-integration.md](../memory/knowledge-learning-integration.md) - Integração completa
- [balanceamento-ref.md](../memory/balanceamento-ref.md) - Arquitetura geral
