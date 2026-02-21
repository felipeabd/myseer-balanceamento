import 'dotenv/config';
import { ClickHouseService } from '../src/clickhouse/client';
import { AgentRegistry } from '../src/builder/agent-registry';

/**
 * Seed script: Creates all default agents in the database.
 * - Gestor de Estoque (publicado) — fully configured
 * - Gestor de Vendas (publicado) — visual shell + starter prompts
 * - Gestor de Prevenção (publicado) — visual shell + starter prompts
 * - Gestor de Mercado (testando) — shows as "Em breve"
 *
 * Run: npx tsx scripts/seed-estoque-agent.ts
 */

async function seedAgents() {
  console.log('🌱 Seeding default agents...\n');

  const clickhouse = new ClickHouseService({
    url: process.env.CLICKHOUSE_URL!,
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  });

  const registry = new AgentRegistry(clickhouse);

  try {
    await registry.ensureTables();

    // ── 1. Gestor de Estoque ──────────────────────────────────
    const existingEstoque = await registry.getAgentBySlug('estoque');
    if (existingEstoque) {
      // Ensure published + correct order
      await registry.updateAgent(existingEstoque.id, { status: 'publicado', ordem: 1 });
      console.log('📦 Gestor de Estoque — updated (ordem: 1) ✅');
    } else {
      const agent = await registry.createAgent({
        slug: 'estoque',
        nome: 'Gestor de Estoque',
        descricao: 'Consultora especialista em análise de estoque para o varejo farmacêutico. Identifica rupturas, excessos, oportunidades de balanceamento e capital imobilizado.',
        icone: '📦',
        cor: '#28B8CE',
        saudacao: 'Olá! Sou a Iris, sua consultora de estoque. Analiso rupturas, excessos, oportunidades de balanceamento e capital imobilizado. Como posso ajudar hoje?',
        placeholderInput: 'Pergunte sobre estoque, rupturas, balanceamento...',
        criadoPor: 'system',

        prompt: {
          personalidade: `Você é a Iris, consultora especialista em análise de estoque para o varejo farmacêutico.

Você atua como uma consultora sênior de dados: não apenas reporta números — **interpreta, diagnostica causas e recomenda ações com impacto financeiro claro**. Seu raciocínio segue sempre esta lógica:

**Dados → Padrão → Diagnóstico → Causa Raiz → Ação com Impacto**

Você não é apenas uma ferramenta de balanceamento. Você é uma analista que:
- Transforma dados em diagnóstico de negócio com linguagem executiva
- Identifica padrões além do óbvio: excesso em uma filial pode ser ruptura iminente em outra
- Cruza múltiplas dimensões: produto × filial × tempo × curva × comprador
- Quantifica o impacto financeiro de cada problema E de cada ação proposta
- Usa a base de conhecimento para enriquecer análises com contexto farma

O balanceamento de estoque é **uma das ações possíveis** — não o único output.`,

          tom: `Linguagem de negócio sempre. Concisa e objetiva.
Diagnóstico sempre antes da recomendação.
Nunca exponha nomes de tabelas, colunas ou mensagens de erro ao usuário.
Nunca invente dados não sustentados pela análise.`,

          restricoes: `## REGRAS ANTI-ALUCINAÇÃO — CRÍTICO

**NUNCA faça afirmações sobre processos, sistemas ou ações que NÃO estejam explicitamente nos dados consultados.**

### PROIBIDO deduzir sem dados:
- "Nenhum pedido foi disparado automaticamente" → você NÃO tem dados de pedidos automáticos
- "O comprador não revisou os parâmetros" → você NÃO tem dados de ações do comprador
- "O sistema de reposição falhou" → você NÃO tem dados do sistema de reposição
- "A transferência não foi executada" → você NÃO tem dados de execução de transferências

### PERMITIDO deduzir SOMENTE com base em dados concretos:
- "Há excesso de 150 unidades na filial X" → vem de qtexcesso = 150
- "Produto está há 90 dias sem venda" → vem de dias_parado = 90
- "Capital de R$ 10.000 imobilizado" → cálculo direto: qtexcesso × vlrcusto

### Regra de ouro:
**Se você NÃO consultou dados sobre algo → NÃO faça afirmações sobre isso.**

## CÁLCULOS FINANCEIROS - NUNCA MISTURAR NOME COM FÓRMULA ERRADA!

### Fórmulas EXATAS:
- **Valor Estoque Total** = qtestoque × vlrcusto
- **Valor Excesso** = qtexcesso × vlrcusto
- **Valor Necessidade** = qtnecessidade × vlrcusto

### CHECKLIST ANTES DE FALAR VALORES:
1. Qual campo SQL usei? (qtestoque / qtexcesso / qtnecessidade)
2. Use o nome correspondente EXATO
3. Adicione a fórmula entre parênteses
4. Confirme: nome bate com fórmula?`,

          exemplos: `Não diga: "O produto X tem qtexcesso = 150 e vlr_custo = 12.50"
Diga: "**[Nome do produto]** tem **150 unidades em excesso** na filial Y, representando **R$ 1.875 imobilizados**. A filial Z está com necessidade do mesmo produto — balancear elimina o excesso e previne ruptura com transferência de **80 unidades**."

Quando listar produtos, SEMPRE informar POR ITEM:
- Nome e código do produto
- Quantidade transferível ou volume do problema
- Excesso e/ou necessidade em unidades
- Lojas envolvidas
- Valor financeiro impactado`,

          fluxo: `## ESTRATÉGIA DE ANÁLISE

Identifique o tipo de solicitação e aja conforme:

### DIAGNÓSTICO GERAL
1. Buscar MAX(dtcarga) — alertar se dados desatualizados
2. Query ampla capturando rupturas, capital imobilizado, itens mortos
3. Query adicional para aprofundar no maior problema encontrado
4. Apresentar como diagnóstico executivo com impacto financeiro
5. Encerrar perguntando qual ponto aprofundar

### ANÁLISE DE PRODUTO ESPECÍFICO
1. Buscar MAX(dtcarga)
2. Buscar detalhamento por filial
3. Diagnosticar: quais filiais têm problemas? de que tipo?
4. Propor ações: balanceamento, alerta, etc.

### OPORTUNIDADES DE BALANCEAMENTO
1. Buscar MAX(dtcarga)
2. Buscar produtos com excesso E necessidade simultâneos
3. Apresentar como oportunidades rankeadas por valor transferível

### OTIMIZAÇÃO EM GRUPO
- Usar DIRETAMENTE a tool optimize_batch (NÃO fazer clickhouse_query antes)
- Apresentar resumo executivo do resultado otimizado

### PERGUNTAS EXPLORATÓRIAS
- Query agregada para responder a pergunta específica
- Aprofundar no padrão mais interessante encontrado
- Retornar: hipótese → evidência → conclusão → recomendação

## PRIORIZAÇÃO POR IMPACTO
1. **Ruptura ativa** (qtestoque = 0, mediaf_un > 0) — perda de venda AGORA
2. **Risco de ruptura** (qtestoque < qt_seguranca) — faltará em dias
3. **Item morto alto custo** (mediaf_un = 0, dias_parado > 90) — risco de perda total
4. **Excesso redistribuível** (qtexcesso > 0, demanda em outra filial)
5. **Excesso não redistribuível** (qtexcesso > 0, sem demanda na rede)`,
        },

        tabelas: [
          {
            tabela: 'default.ia_agente_fato_estoque',
            alias: 'Diagnóstico amplo de estoque — excessos, rupturas, capital imobilizado, produtos parados',
            colunas: [
              'tenant', 'dtcarga', 'cdFilial', 'nome_filial', 'supervisor', 'filialdeposito',
              'flagnaopartindic', 'cdprod', 'descricao', 'nomefabricante', 'curva', 'linha',
              'comprador', 'departamento', 'categoria', 'principioativo', 'tipocompra',
              'marcapropria', 'flaganaliseexcobprod', 'flaganalisefaltasprod',
              'flagnaopartindicadoreslinha', 'qtestoque', 'vlr_custo', 'mediaf_un',
              'qtexcesso', 'qtnecessidade', 'qt_seguranca', 'qt_maxima',
              'estoque_valor', 'excesso_valor', 'mediaf_valor', 'faltavlr',
              'qt_pendencia_entrada', 'qt_pendencia_saida',
              'dias_parado', 'dias_falta', 'dias_sem_estoque', 'dias_sem_venda',
              'dias_sem_entrada', 'qt_faceamento', 'qt_financiado', 'percent_vlr',
            ],
            filtroObrigatorio: "filialdeposito = 0 AND tenant = '{tenantId}'",
          },
          {
            tabela: 'default.ia_fato_balanceamento',
            alias: 'Oportunidades de balanceamento entre filiais (excesso em A + necessidade em B)',
            colunas: [
              'tenant', 'dtcarga', 'cdprod', 'cdFilial', 'descricao', 'curva',
              'nomefabricante', 'qtnecessidade', 'qtexcesso', 'qtestoque',
              'cobertura', 'mediaf_un', 'vlrcusto', 'dias_parado', 'dias_falta',
              'filialdeposito',
            ],
            filtroObrigatorio: "filialdeposito = 0 AND tenant = '{tenantId}'",
          },
        ],

        skills: {
          consulta_sql: true,
          gerar_csv: true,
          knowledge_base: true,
          otimizador: true,
        },

        regraAnalise: `## TIPOS DE PROBLEMA (Diagnóstico)

| Problema | Indicadores | Ação | CSV? |
|---|---|---|---|
| **Ruptura ativa** | qtestoque = 0 + mediaf_un > 0 | Compra emergencial ou balanceamento urgente | Sim, se 5+ itens |
| **Risco de ruptura** | qtestoque < qt_seguranca + mediaf_un > 0 | Balanceamento preventivo | Sim, se 5+ itens |
| **Excesso redistribuível** | qtexcesso > 0 + outra filial com necessidade | Balanceamento | Sim, sempre |
| **Item morto / parado** | mediaf_un = 0 + dias_parado > 90 + qtestoque > 0 | Devolução ou promoção | Sim, se 5+ itens |
| **Excesso não redistribuível** | qtexcesso > 0 + sem demanda na rede | Reduzir próximo pedido | Sim, se 5+ itens |
| **Capital imobilizado** | SUM(excesso_valor) alto | Redistribuição em lote | Sim, sempre |

## MÉTRICAS E CÁLCULOS

### Cobertura
- **Fórmula**: (qtestoque / mediaf_un) × 30
- **Ideal por curva**: A = 30 dias, B = 60 dias, C = 90 dias
- **Alertas**: Abaixo de 15 dias (curva A) = risco iminente; Acima de 60 dias (curva A) = excesso crítico

### Flags (lógica invertida: 0 = PARTICIPA, 1 = NÃO PARTICIPA)
- Excesso: AND flaganaliseexcobprod = 0 AND filialdeposito = 0
- Falta/Ruptura: AND flaganalisefaltasprod = 0 AND filialdeposito = 0
- Geral: AND filialdeposito = 0
- Indicadores filial: AND flagnaopartindic = 0

### ATENÇÃO: ia_agente_fato_estoque
- NÃO existe coluna "cobertura" → calcular: (qtestoque / mediaf_un) * 30
- NÃO existe coluna "vlrcusto" → usar vlr_custo (com underscore)

## PLANO DE TRANSFERÊNCIAS (Produto Único)

**Passo 1: Separar lojas**
- Doadoras: qtexcesso > 0 (mediaf_un = 0 primeiro, depois cobertura DESC)
- Receptoras COM demanda: qtnecessidade > 0 E mediaf_un > 0 (mediaf_un DESC)
- Receptoras SEM demanda: ficam por ÚLTIMO

**Passo 2: Cobertura-alvo**
- cobertura_alvo = (SUM(qtestoque) / SUM(mediaf_un)) * 30 (apenas lojas com mediaf_un > 0)

**Passo 3: Montar pares**
- Percorrer receptoras com demanda, alocar de doadoras
- Doadora com mediaf_un > 0 NUNCA fica abaixo da cobertura_alvo
- Doadora com mediaf_un = 0 pode doar TODO o excesso
- Transferências em unidades INTEIRAS`,

        perguntasRapidas: [
          { icon: '⚠️', title: 'Risco de Ruptura', prompt: 'Quais produtos estão com risco de ruptura nas próximas semanas?' },
          { icon: '⚖️', title: 'Oportunidade de Balanceamento', prompt: 'Quais produtos têm excesso em algumas filiais e falta em outras?' },
          { icon: '📉', title: 'MAPE', prompt: 'Quais produtos têm maior erro entre previsão e demanda real? Mostre por filial os itens com pior precisão de forecast.' },
          { icon: '💰', title: 'Capital Imobilizado', prompt: 'Quais produtos estão imobilizando mais capital em excesso de estoque?' },
        ],

        modeloPadrao: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.2,
        maxToolCalls: 5,
        status: 'publicado',
        custoMensalBrl: 0,
        ordem: 1,
      });
      console.log(`📦 Gestor de Estoque — created (id: ${agent.id}) ✅`);
    }

    // ── 2. Gestor de Vendas ───────────────────────────────────
    const existingVendas = await registry.getAgentBySlug('vendas');
    if (existingVendas) {
      await registry.updateAgent(existingVendas.id, { ordem: 2 });
      console.log('📊 Gestor de Vendas — updated (ordem: 2) ✅');
    } else {
      const agent = await registry.createAgent({
        slug: 'vendas',
        nome: 'Gestor de Vendas',
        descricao: 'Analista de vendas, margem, metas e comportamento de compra.',
        icone: '📊',
        cor: '#28B8CE',
        saudacao: 'Como posso ajudar com suas vendas hoje?',
        placeholderInput: 'Pergunte sobre vendas, margem, metas...',
        criadoPor: 'system',

        prompt: {
          personalidade: 'Você é a Iris, analista especialista em vendas para o varejo farmacêutico.',
          tom: 'Linguagem de negócio. Concisa e objetiva.',
          restricoes: '',
          exemplos: '',
          fluxo: '',
        },

        tabelas: [],
        skills: { consulta_sql: true, gerar_csv: true, knowledge_base: false, otimizador: false },
        regraAnalise: '',

        perguntasRapidas: [
          { icon: '📊', title: 'Margem', prompt: 'Quais produtos ou filiais estão com margem abaixo do esperado?' },
          { icon: '🛒', title: 'Carrinho de Compras', prompt: 'Quais produtos são vendidos juntos com mais frequência em um mesmo cupom? Mostre as principais combinações por filial.' },
          { icon: '📈', title: 'EPD', prompt: 'Analise a elasticidade, preço e demanda dos principais produtos: como variações de preço impactam o volume vendido?' },
          { icon: '🎯', title: 'Metas', prompt: 'Qual o percentual de meta atingida por filial e quais estão em risco de não bater?' },
        ],

        modeloPadrao: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.2,
        maxToolCalls: 5,
        status: 'publicado',
        custoMensalBrl: 0,
        ordem: 2,
      });
      console.log(`📊 Gestor de Vendas — created (id: ${agent.id}) ✅`);
    }

    // ── 3. Gestor de Prevenção ────────────────────────────────
    const existingPrevencao = await registry.getAgentBySlug('prevencao');
    if (existingPrevencao) {
      await registry.updateAgent(existingPrevencao.id, { ordem: 3 });
      console.log('🛡️ Gestor de Prevenção — updated (ordem: 3) ✅');
    } else {
      const agent = await registry.createAgent({
        slug: 'prevencao',
        nome: 'Gestor de Prevenção',
        descricao: 'Analista de prevenção de perdas: vencidos, avarias, estoque negativo.',
        icone: '🛡️',
        cor: '#28B8CE',
        saudacao: 'Como posso ajudar com a prevenção de perdas hoje?',
        placeholderInput: 'Pergunte sobre vencidos, avarias, estoque negativo...',
        criadoPor: 'system',

        prompt: {
          personalidade: 'Você é a Iris, analista especialista em prevenção de perdas para o varejo farmacêutico.',
          tom: 'Linguagem de negócio. Concisa e objetiva.',
          restricoes: '',
          exemplos: '',
          fluxo: '',
        },

        tabelas: [],
        skills: { consulta_sql: true, gerar_csv: true, knowledge_base: false, otimizador: false },
        regraAnalise: '',

        perguntasRapidas: [
          { icon: '📅', title: 'Vencidos', prompt: 'Quais produtos com validade vencida ainda constam em estoque? Mostre por filial e valor estimado de prejuízo.' },
          { icon: '⏳', title: 'Prevencidos', prompt: 'Quais produtos estão próximos ao vencimento e precisam de ação urgente? Mostre dias restantes e quantidades por filial.' },
          { icon: '🔻', title: 'Estoque Negativo', prompt: 'Quais produtos apresentam quantidade negativa no sistema?' },
          { icon: '💥', title: 'Avaria', prompt: 'Quais produtos registraram avaria ou perda? Mostre o impacto por filial e o valor total de perdas.' },
        ],

        modeloPadrao: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.2,
        maxToolCalls: 5,
        status: 'publicado',
        custoMensalBrl: 0,
        ordem: 3,
      });
      console.log(`🛡️ Gestor de Prevenção — created (id: ${agent.id}) ✅`);
    }

    // ── 4. Gestor de Mercado (Em breve) ───────────────────────
    const existingMercado = await registry.getAgentBySlug('mercado');
    if (existingMercado) {
      await registry.updateAgent(existingMercado.id, { ordem: 4 });
      console.log('🌐 Gestor de Mercado — updated (ordem: 4) ✅');
    } else {
      const agent = await registry.createAgent({
        slug: 'mercado',
        nome: 'Gestor de Mercado',
        descricao: 'Analista de mercado e inteligência competitiva.',
        icone: '🌐',
        cor: '#28B8CE',
        saudacao: 'Como posso ajudar com análise de mercado hoje?',
        placeholderInput: 'Pergunte sobre mercado, concorrência, tendências...',
        criadoPor: 'system',

        prompt: {
          personalidade: '',
          tom: '',
          restricoes: '',
          exemplos: '',
          fluxo: '',
        },

        tabelas: [],
        skills: { consulta_sql: false, gerar_csv: false, knowledge_base: false, otimizador: false },
        regraAnalise: '',
        perguntasRapidas: [],

        modeloPadrao: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.2,
        maxToolCalls: 3,
        // 'testando' → shows as "Em breve" for consumers
        status: 'testando',
        ordem: 4,
        custoMensalBrl: 0,
      });
      console.log(`🌐 Gestor de Mercado — created as "Em breve" (id: ${agent.id}) ✅`);
    }

    console.log('\n✅ All agents seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding agents:', error);
    process.exit(1);
  }

  await clickhouse.close();
}

seedAgents();
