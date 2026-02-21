# 📚 Sistema de Regras - Iris

## ✅ Implementação Concluída

O sistema de aprendizado por regras foi totalmente implementado e está rodando.

---

## 🏗️ Componentes Implementados

### 1. Tabelas ClickHouse

#### `ia_sessoes_regras`
Controla o modo de operação do agente (normal ou treinamento):
- `status = 1` → Modo treinamento ativo
- `status = 0` → Modo chat normal

#### `ia_regras_balanceamento`
Armazena as regras criadas:
- Suporta regras por tenant ou globais (`tenant = 'null'`)
- Tipos: bloqueio, limite, prioridade, exceção
- Prioridade: 1-9 (crítico), 10-19 (limite), 20-29 (prioridade), 30-39 (heurística)

### 2. Services

- **SessionManager** (`src/rules/session-manager.ts`)
  - Gerencia sessões de treinamento
  - Controla transição entre modos

- **RuleTrainerAgent** (`src/agent/rule-trainer.ts`)
  - Agente especializado em criar regras
  - Tools: SalvarRegra, AtualizarSessao
  - Usa Claude Haiku 4.5 para reduzir custos

- **LoadRulesSkill** (`src/rules/load-rules-skill.ts`)
  - Carrega regras ativas (tenant + globais)
  - Formata para injeção no prompt do Iris

### 3. Integração no Iris Agent

O Iris agora:
1. Detecta `regras:` ou `/regras` e ativa modo treinamento
2. Verifica se conversa está em treinamento e redireciona
3. Em modo normal, carrega regras e injeta no prompt

---

## 🎯 Como Usar

### Criar uma Regra

```
👤: regras: produtos de curva AA nunca podem ser doadores

🤖: Entendi. Você quer criar uma regra de BLOQUEIO para produtos curva AA.

Regra proposta:
{
  "tipo": "bloqueio",
  "prioridade": 2,
  "alvo": {"curva": "AA"},
  "condicao": {},
  "acao": {"bloquear_doadora": true},
  "texto": "Produtos de curva AA nunca podem ser doadores"
}

Para confirmar essa regra, digite: confirma

👤: confirma

🤖: ✅ Regra salva com sucesso! (ID: abc-123)

Deseja realizar mais algum treinamento?
1 - Sim
2 - Não

👤: 2

🤖: Sessão de treinamento encerrada. Voltando ao modo Análise.
```

### Usar Regras no Chat Normal

```
👤: me sugira transferências para balancear o estoque

🤖: [Carrega regras ativas automaticamente]
     [Aplica regras nas sugestões]

     Analisando estoque...

     ❌ Não posso sugerir Produto X (curva AA) como doador
     Motivo: Regra #1 - Produtos de curva AA não podem ser doadores

     ✅ Sugestão: Produto Y (curva B) de Loja A para Loja B (200 un)
```

---

## 📋 Estrutura de uma Regra

```json
{
  "tenant": "UUID ou null",      // null = regra global
  "escopo": "balanceamento",
  "tipo": "bloqueio | limite | prioridade | excecao",
  "status": "ativo | inativo",
  "prioridade": 1-39,            // Menor = mais importante
  "alvo": {                      // Quem a regra afeta
    "curva": "AA",
    "cdFilial": "123",
    "linha": "Bebidas"
  },
  "condicao": {                  // Quando aplica
    "qtexcesso": "> 100"
  },
  "acao": {                      // O que fazer
    "bloquear_doadora": true,
    "percentual_max_excesso": 0.8
  },
  "texto": "Descrição clara da regra"
}
```

---

## 🔧 Comandos

### Setup
```bash
npm run setup:rules    # Cria as tabelas (já executado)
```

### Desenvolvimento
```bash
npm run dev           # Servidor já rodando na porta 3030
```

---

## 🧪 Testes

### 1. Testar Criação de Regra

Via curl ou frontend:
```bash
curl -X POST http://localhost:3030/api/iris/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "regras: nunca transferir mais de 500 unidades de perecíveis",
    "context": {
      "tenantId": "33F6E320-F59E-4E43-99C2-2D6748A64B04",
      "userEmail": "teste@myseer.com.br"
    }
  }'
```

### 2. Verificar Regras no ClickHouse

```sql
SELECT * FROM ia_regras_balanceamento
WHERE tenant = '33F6E320-F59E-4E43-99C2-2D6748A64B04'
  AND status = 'ativo'
ORDER BY prioridade ASC;
```

### 3. Verificar Sessões

```sql
SELECT * FROM ia_sessoes_regras
ORDER BY last_activity DESC
LIMIT 10;
```

### 4. Testar Aplicação de Regras

Após criar regras, fazer pergunta normal:
```
"me sugira transferências"
```

O Iris deve respeitar as regras criadas.

---

## 📊 Tipos de Regra e Prioridades

### BLOQUEIO (1-9) - Mais Crítico
```
Exemplo: "Nunca transferir curva AA"
Prioridade: 1-9
Ação: bloqueia completamente a operação
```

### LIMITE (10-19) - Operacional
```
Exemplo: "Máximo 80% do excesso pode ser transferido"
Prioridade: 10-19
Ação: limita quantidade
```

### PRIORIDADE (20-29) - Negócio
```
Exemplo: "Priorizar lojas com cobertura negativa"
Prioridade: 20-29
Ação: ordena/prioriza sugestões
```

### HEURÍSTICA (30-39) - Desempate
```
Exemplo: "Em caso de empate, escolher loja mais próxima"
Prioridade: 30-39
Ação: critério de desempate
```

---

## 🔍 Campos Disponíveis para Regras

```
tenant, cdprod, cdFilial, nomefabricante, linha, curva,
qtnecessidade, qtexcesso, qtestoque, cobertura, mediaf_un,
dias_parado, dias_falta, filialdeposito
```

---

## 📈 Próximos Passos

1. ✅ Sistema implementado e funcionando
2. 🔄 Testar criação de regras via frontend
3. 🔄 Testar aplicação de regras em sugestões
4. 📊 Criar interface de gerenciamento de regras (opcional)
5. 🎯 Adicionar métricas de uso de regras (contador `vezes_aplicada`)

---

## 🐛 Troubleshooting

### Servidor não inicia
```bash
# Verificar porta em uso
netstat -ano | findstr :3030

# Matar processo
taskkill //F //PID <PID>

# Reiniciar
npm run dev
```

### Tabelas não encontradas
```bash
npm run setup:rules
```

### Sessão travada em modo treinamento
```sql
-- Forçar encerramento no ClickHouse
INSERT INTO ia_sessoes_regras
(conversation_id, tenant_id, user_email, agent_mode, status, started_at, ended_at)
VALUES ('conv-id', 'tenant-id', 'email', 'iris', 0, now(), now());
```

---

## 📞 Status Atual

✅ Tabelas criadas
✅ Services implementados
✅ Integração com Iris completa
✅ Servidor rodando (porta 3030)
🔄 Pronto para testes!
