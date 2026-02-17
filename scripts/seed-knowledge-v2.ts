/**
 * Seeds knowledge base with additional pharma domain concepts from research.
 * Run with: npx ts-node scripts/seed-knowledge-v2.ts
 */
import 'dotenv/config';

const CH_URL = process.env.CLICKHOUSE_URL!;
const CH_USER = process.env.CLICKHOUSE_USER ?? 'default';
const CH_PASS = process.env.CLICKHOUSE_PASSWORD ?? '';
const CH_DB = process.env.CLICKHOUSE_DATABASE ?? 'default';

async function chQuery(sql: string): Promise<void> {
  const url = `${CH_URL}/?user=${encodeURIComponent(CH_USER)}&password=${encodeURIComponent(CH_PASS)}&database=${encodeURIComponent(CH_DB)}`;
  const resp = await fetch(url, { method: 'POST', body: sql });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickHouse error: ${resp.status} - ${text}`);
  }
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

async function ins(e: {
  termo: string; definicao: string; porque_importa: string;
  relacoes: string; exemplos: string; categoria: string; tags: string;
}): Promise<void> {
  const sql = `INSERT INTO ia_base_conhecimento
    (termo,definicao,porque_importa,relacoes,exemplos,categoria,tags,tenant,ativo) VALUES (
    '${esc(e.termo)}','${esc(e.definicao)}','${esc(e.porque_importa)}',
    '${esc(e.relacoes)}','${esc(e.exemplos)}','${esc(e.categoria)}','${esc(e.tags)}',
    'global',true)`;
  await chQuery(sql);
  console.log(`✅ ${e.termo}`);
}

const entries = [
  {
    termo: 'ruptura_benchmark',
    definicao: 'Referenciais de desempenho para taxa de ruptura no varejo farmacêutico brasileiro. Excelente: abaixo de 3%. Aceitável: 3% a 7%. Crítico: acima de 10%. Redes Abrafarma: tipicamente 4% a 8%. Farmácias independentes: frequentemente acima de 12%.',
    porque_importa: 'Contextualiza a situação: ruptura de 8% está aceitável mas próxima do crítico. Transforma número absoluto em diagnóstico contextualizado com referência do setor.',
    relacoes: 'Relacionado a: ruptura, ruptura_cronica, nivel_servico. Nível de serviço = 1 - taxa de ruptura. Meta ideal: ruptura abaixo de 3%, nível de serviço acima de 97%.',
    exemplos: 'Rede com taxa de ruptura de 6%: aceitável com espaço de melhoria. Taxa de 12%: crítica, ação imediata. Grandes redes (Raia Drogasil, Pague Menos) operam com 3-5%.',
    categoria: 'ruptura',
    tags: 'benchmark,ruptura,abrafarma,taxa,meta,kpi,nível de serviço,referência',
  },
  {
    termo: 'validade_medicamento',
    definicao: 'Dimensão crítica e exclusiva do setor farmacêutico. Produto vencido deve ser retirado de circulação (ANVISA). Alertas: >12 meses = gestão normal. 6-12 meses = não comprar mais, priorizar saída. 3-6 meses = ação imediata (transferência, devolução, promoção). <3 meses = emergência. <30 dias = planejar descarte.',
    porque_importa: 'Transforma excesso em perda total. Produto com 90 dias de validade e 180 dias de cobertura é garantia de descarte. A validade deve ser considerada antes de qualquer recomendação de balanceamento ou compra.',
    relacoes: 'Relacionado a: item_morto, perda_por_vencimento, dias_parado, excesso. Proxy sem coluna de validade: dias_parado > 90 + mediaf_un baixo = candidato a risco de vencimento.',
    exemplos: 'Antibiótico com validade em 45 dias e 200un em estoque: ação urgente — devolução ao fornecedor ou promoção agressiva. Vitamina sazonal com validade em 8 meses e cobertura de 12 meses: transferir para filial com maior demanda.',
    categoria: 'inventario',
    tags: 'validade,vencimento,prazo,descarte,ANVISA,perda,emergência,farmácia',
  },
  {
    termo: 'nivel_servico',
    definicao: 'Percentual de itens demandados efetivamente fornecidos sem ruptura. Fórmula: 1 - taxa de ruptura. Meta ideal: acima de 95% (ruptura < 5%). Redes de alto desempenho: acima de 97%. Indica diretamente a experiência do cliente na loja.',
    porque_importa: 'Conecta gestão de estoque com experiência do cliente. Nível de 90% significa que 10% das demandas não são atendidas — clientes vão para o concorrente. Em medicamentos crônicos, essa perda é permanente e acumulativa.',
    relacoes: 'Oposto de ruptura. Relacionado a: ruptura_benchmark, ruptura_cronica, cobertura, ponto_de_pedido. Melhorar requer calibrar ponto de pedido e estoque de segurança.',
    exemplos: 'Filial com nível de serviço de 88%: 12% dos clientes não encontraram o produto — em 500 vendas/dia, 60 clientes por dia com necessidade não atendida.',
    categoria: 'ruptura',
    tags: 'nível de serviço,fill rate,disponibilidade,atendimento,ruptura,benchmark,kpi',
  },
  {
    termo: 'gmroi',
    definicao: 'GMROI (Gross Margin Return on Inventory Investment): retorno da margem bruta sobre o investimento em estoque. Fórmula: Margem Bruta / Estoque Médio em R$. Benchmark varejo farma: acima de 1.5x é saudável; redes eficientes atingem 2.5x a 4.0x.',
    porque_importa: 'Revela se o capital em estoque gera retorno proporcional. GMROI baixo indica mix inadequado, excesso de itens de baixa margem ou capital imobilizado excessivo. Permite comparar categorias independentemente do volume.',
    relacoes: 'Relacionado a: capital_imobilizado, giro_de_estoque, mix_de_produtos. GMROI alto + giro alto = produto ideal. GMROI baixo + excesso = candidato a redução.',
    exemplos: 'Dermocosméticos com GMROI 3.5x: retorno excelente, ampliar mix. Genéricos com GMROI 1.2x: margens pressionadas pelo CMED, revisar estratégia de portfolio.',
    categoria: 'giro',
    tags: 'gmroi,margem,retorno,investimento,estoque,eficiência,KPI,financeiro',
  },
  {
    termo: 'hierarquia_alertas',
    definicao: 'Framework de priorização de ações em gestão de estoque farma. CRÍTICO (ação imediata): item curva A em ruptura há +1 dia, produto com validade < 30 dias com estoque relevante, ruptura geral > 10%. ALTO (24-48h): curva A com cobertura < 7 dias, validade < 90 dias com cobertura > 60 dias, transferência urgente identificada. MÉDIO (semanal): curva B em ruptura, excesso > 3x cobertura ideal. BAIXO (mensal): curva C sem venda há 90 dias, mix com +25% de itens inativos.',
    porque_importa: 'Evita sobrecarga de alertas — não adianta 500 alertas iguais. Garante que o gestor saiba O QUE fazer PRIMEIRO para maximizar impacto. Organiza o diagnóstico da IA de forma acionável.',
    relacoes: 'Relacionado a: ruptura, ruptura_benchmark, cobertura, curva_abc, validade_medicamento. Use esta hierarquia ao apresentar resultados de diagnóstico geral.',
    exemplos: 'Diagnóstico mostra: curva A em ruptura (CRÍTICO → agir hoje), excesso em 10 itens curva B (MÉDIO → essa semana), itens curva C sem venda 120 dias (BAIXO → avaliar no mês). Apresentar exatamente nesta ordem de prioridade.',
    categoria: 'diagnostico',
    tags: 'hierarquia,alertas,prioridade,crítico,urgência,framework,gestão,diagnóstico',
  },
  {
    termo: 'controlados_restricoes_transferencia',
    definicao: 'Medicamentos de listas C1, A1, A2, A3 (psicotrópicos, entorpecentes) têm restrições severas para transferência entre filiais. Exigem NF específica (CFOP 5152) e atualização simultânea do SNGPC em ambas as unidades. Operacionalmente complexo — a maioria das redes prefere reequilibrar via compras futuras ao invés de transferir fisicamente.',
    porque_importa: 'Ao sugerir balanceamento de produto controlado, alertar que a transferência pode ser inviável operacionalmente. Recomendar alternativa: reduzir pedido na filial com excesso + aumentar pedido na filial com necessidade no próximo ciclo de compra.',
    relacoes: 'Relacionado a: medicamento_controlado, balanceamento, excesso_redistribuivel. Identificar por principioativo ou descricao: Metilfenidato, Clonazepam, Diazepam, Alprazolam, Ritalina, Rivotril são exemplos de C1.',
    exemplos: 'Excesso de Clonazepam 2mg na filial A + necessidade na filial B: NÃO sugerir transferência direta. Recomendar: reduzir próximo pedido da filial A e aumentar da filial B. Documentar situação para o comprador.',
    categoria: 'balanceamento',
    tags: 'controlado,C1,A1,SNGPC,transferência,restrição,psicotrópico,ANVISA,NF',
  },
  {
    termo: 'otif_fornecedor',
    definicao: 'OTIF (On Time In Full): percentual de pedidos entregues pelo fornecedor no prazo E completos. Fórmula: pedidos completos e no prazo / total de pedidos × 100. Benchmark mínimo: acima de 85%. Fornecedor com OTIF < 85% é causa identificada de ruptura que NÃO depende da gestão da farmácia.',
    porque_importa: 'Quando ruptura crônica de um produto coincide com fornecedor específico de baixo OTIF, o problema é o fornecedor, não o parâmetro de compra. Diagnóstico correto evita ajuste errado de estoque de segurança.',
    relacoes: 'Relacionado a: ruptura_cronica, ponto_de_pedido, comprador. Campo nomefabricante nos dados pode ajudar a identificar padrão por fornecedor.',
    exemplos: 'Antibiótico em ruptura crônica: comprador verificou que o distribuidor tem OTIF de 70% — problema externo, não de parâmetro. Ação: aumentar estoque de segurança E trocar de distribuidor.',
    categoria: 'compra',
    tags: 'OTIF,fornecedor,entrega,prazo,qualidade,distribuidor,ruptura,externo',
  },
];

async function main() {
  console.log(`\n🌱 Seed v2 — ${entries.length} termos adicionais\n`);
  let ok = 0, fail = 0;
  for (const e of entries) {
    try { await ins(e); ok++; } catch(err) { console.error(`❌ ${e.termo}:`, err); fail++; }
  }
  const r = await fetch(
    `${CH_URL}/?user=${encodeURIComponent(CH_USER)}&password=${encodeURIComponent(CH_PASS)}&database=${encodeURIComponent(CH_DB)}`,
    { method: 'POST', body: 'SELECT COUNT() as total FROM ia_base_conhecimento WHERE ativo = true' }
  );
  console.log(`\n✅ ${ok} inseridos, ${fail} falhas`);
  console.log('Total na base:', (await r.text()).trim());
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
