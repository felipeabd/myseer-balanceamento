/**
 * Seeds the knowledge base with pharma inventory domain concepts.
 * Run with: npx ts-node scripts/seed-knowledge.ts
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

async function insertKnowledge(entry: {
  termo: string;
  definicao: string;
  porque_importa: string;
  relacoes: string;
  exemplos: string;
  categoria: string;
  tags: string;
}): Promise<void> {
  const sql = `INSERT INTO ia_base_conhecimento
    (termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant, ativo)
    VALUES (
      '${esc(entry.termo)}',
      '${esc(entry.definicao)}',
      '${esc(entry.porque_importa)}',
      '${esc(entry.relacoes)}',
      '${esc(entry.exemplos)}',
      '${esc(entry.categoria)}',
      '${esc(entry.tags)}',
      'global',
      true
    )`;
  await chQuery(sql);
  console.log(`✅ Inserido: ${entry.termo}`);
}

async function deleteTerm(termo: string): Promise<void> {
  await chQuery(`ALTER TABLE ia_base_conhecimento DELETE WHERE termo = '${esc(termo)}'`);
}

const entries = [
  {
    termo: 'curva_abc',
    definicao: 'Classificação dos produtos em 3 grupos por importância financeira no faturamento. Curva A: ~20% dos SKUs gerando 80% do faturamento — cobertura ideal 30 dias, reposição frequente. Curva B: ~30% dos SKUs, 15% do faturamento — cobertura ideal 60 dias. Curva C: ~50% dos SKUs, apenas 5% do faturamento — cobertura ideal 90 dias.',
    porque_importa: 'Define prioridade de gestão e cobertura ideal por produto. Produto A sem estoque é ruptura crítica com alto impacto financeiro. Produto C com excesso é capital parado desnecessário. A classificação pode mudar sazonalmente — um produto C no verão pode virar A no inverno.',
    relacoes: 'Relacionado a: cobertura, ruptura, excesso, sazonalidade. Produtos A exigem reposição diária e monitoramento constante. Curva C pode ter maior cobertura sem risco relevante.',
    exemplos: 'Acetilcisteína pode ser curva B no verão e curva A no inverno (gripes). Protetor solar é curva A no verão e curva C no inverno. Medicamentos de uso contínuo (hipertensão, diabetes) geralmente são curva A ou B permanentes.',
    categoria: 'inventario',
    tags: 'abc,classificação,curva,cobertura,prioridade,A,B,C',
  },
  {
    termo: 'sazonalidade',
    definicao: 'Variação previsível da demanda ao longo do ano. Em farmácias: inverno aumenta demanda de antigripais, antibióticos, antitussivos e vitamina C. Verão aumenta demanda de protetores solares, antidiarreicos e repositores de eletrólitos. Períodos escolares têm pico de antiparasitários.',
    porque_importa: 'Ignorar sazonalidade causa ruptura nos picos (produto vendendo muito sem estoque) ou excesso fora de época (produto parado por meses, risco de vencimento). Impacta diretamente a curva ABC — a classificação de um produto pode mudar temporariamente na alta temporada.',
    relacoes: 'Relacionado a: curva_abc, ruptura, excesso, cobertura, perda_por_vencimento. Sazonalidade é uma das principais justificativas para ajuste de parâmetros de compra.',
    exemplos: 'Vitamina C e antigripais: pico no inverno. Repelente e protetor solar: pico no verão e época de dengue. Antiparasitários: pico em períodos de volta às aulas. Vitamina D: crescimento durante pandemia e manteve demanda elevada.',
    categoria: 'inventario',
    tags: 'sazonalidade,sazonal,inverno,verão,demanda,pico,temporal',
  },
  {
    termo: 'item_morto',
    definicao: 'Produto com estoque > 0 mas sem nenhuma venda há um período prolongado (geralmente 90+ dias). Identificado por mediaf_un = 0 e dias_parado elevado. Diferente de excesso: o item morto não tem demanda em nenhuma filial da rede — não pode ser resolvido por balanceamento.',
    porque_importa: 'Representa risco real de perda total por vencimento ou obsolescência. Capital completamente imobilizado sem perspectiva de recuperação via transferência. Exige decisão comercial: promoção agressiva, devolução ao fornecedor ou baixa fiscal.',
    relacoes: 'Diferente de excesso (que tem demanda em outras lojas). Verificar se produto tem demanda em ALGUMA filial antes de classificar como morto. Ver: dias_parado, dias_sem_venda, mediaf_un, perda_por_vencimento.',
    exemplos: 'Produto de nicho comprado errado sem saída há 120 dias. Produto sazonal fora de época com estoque alto (protetor solar em julho). Produto descontinuado pelo fabricante ainda em estoque.',
    categoria: 'inventario',
    tags: 'item morto,estoque morto,parado,obsoleto,vencimento,zero venda,sem demanda',
  },
  {
    termo: 'capital_imobilizado',
    definicao: 'Valor financeiro total preso em estoque improdutivo — principalmente excesso e itens parados. Calculado como SUM(qtexcesso × vlr_custo) ou usando o campo excesso_valor. Representa dinheiro que poderia estar em caixa, pagando fornecedores ou investido em produtos de maior giro.',
    porque_importa: 'É o principal impacto financeiro do excesso. Uma rede com R$500k em excesso tem esse capital indisponível. Reduzir capital imobilizado via balanceamento melhora o capital de giro sem necessidade de compra adicional. Priorizar por vlr_custo alto identifica onde a liberação de capital é maior.',
    relacoes: 'Relacionado a: excesso, item_morto, giro_de_estoque, balanceamento, excesso_valor. Balanceamento é a forma mais rápida de liberar capital imobilizado quando há demanda em outras filiais.',
    exemplos: 'Produto A com 200un de excesso a R$15/un = R$3.000 imobilizados em uma loja. Rede com 15 lojas e R$800k em excesso: balancear pode liberar R$300-400k em caixa.',
    categoria: 'inventario',
    tags: 'capital,imobilizado,financeiro,excesso,caixa,giro,capital de giro',
  },
  {
    termo: 'giro_de_estoque',
    definicao: 'Indica quantas vezes o estoque é renovado em um período. Calculado por: vendas_periodo / estoque_medio. Nos dados disponíveis, mediaf_un é a proxy de giro — produto com mediaf_un = 0 tem giro zero. Alto giro com cobertura adequada é o cenário ideal.',
    porque_importa: 'Giro baixo indica produto parado, capital imobilizado e risco de vencimento. Em farmácias, um produto de alto custo com giro baixo tem impacto financeiro desproporcional. Giro muito alto com cobertura baixa indica risco de ruptura — produto vendendo bem mas mal abastecido.',
    relacoes: 'Relacionado a: cobertura, excesso, item_morto, mediaf_un, ruptura. mediaf_un = 0 significa giro zero — candidato a item_morto. Alta mediaf_un com baixo qtestoque = risco de ruptura iminente.',
    exemplos: 'Produto vendendo 30un/mês com estoque de 60un: cobertura de 2 meses, giro adequado. Produto com 120un e mediaf_un de 5un/mês: cobertura de 24 meses, giro baixo — candidato a excesso ou item morto.',
    categoria: 'giro',
    tags: 'giro,turnover,rotatividade,renovação,mediaf_un,cobertura',
  },
  {
    termo: 'ruptura_cronica',
    definicao: 'Produto que entra em ruptura repetidamente, mesmo após reposição. Diferente da ruptura pontual, a ruptura crônica indica problema estrutural de compra ou fornecimento. Identificada por dias_falta elevado + mediaf_un > 0 + qtestoque baixo recorrente. O comprador do produto precisa ser alertado.',
    porque_importa: 'Ruptura crônica causa perda sistemática de vendas e migração permanente de clientes para concorrentes. Em produtos de uso contínuo (hipertensos, diabéticos), o cliente que não encontra migra e não volta. É o problema de maior impacto na fidelização do cliente.',
    relacoes: 'Relacionado a: ruptura, dias_falta, ponto_de_pedido, comprador. Campo comprador identifica o responsável que precisa revisar parâmetros. Campo dias_falta alto é o principal indicador.',
    exemplos: 'Medicamento de uso contínuo (anti-hipertensivo) em ruptura crônica: cliente fidelizado vai para o concorrente permanentemente. Antibiótico em ruptura crônica no inverno: perde vendas justamente na alta temporada.',
    categoria: 'ruptura',
    tags: 'ruptura crônica,ruptura,falta,dias_falta,comprador,ponto de pedido,estrutural',
  },
  {
    termo: 'excesso_redistribuivel',
    definicao: 'Excesso que pode ser transferido de uma filial doadora (qtexcesso > 0) para uma receptora com necessidade do mesmo produto (qtnecessidade > 0). Oportunidade real quando para o mesmo cdprod há SUM(qtexcesso) > 0 E SUM(qtnecessidade) > 0 na rede. Quantidade transferível = MIN(total_excesso, total_necessidade).',
    porque_importa: 'Diferente do item morto, o excesso redistribuível tem demanda em outras lojas. O balanceamento resolve dois problemas simultaneamente: libera capital na doadora e previne ruptura na receptora. É a ação de maior impacto financeiro sem custo adicional de compra.',
    relacoes: 'Contrastar com item_morto (sem demanda em nenhuma loja). Atenção: medicamentos controlados têm restrições de transferência. Ver: balanceamento, excesso, necessidade, qt_transferivel.',
    exemplos: 'Produto com 50un de excesso na filial A e 30un de necessidade na filial B: transferir 30un libera R$450 e previne ruptura. Este é o cenário ideal de balanceamento.',
    categoria: 'balanceamento',
    tags: 'excesso,redistribuível,transferência,balanceamento,doadora,receptora,oportunidade',
  },
  {
    termo: 'medicamento_controlado',
    definicao: 'Medicamento sujeito a controle especial pela ANVISA (Portaria SVS/MS 344/98). Inclui psicotrópicos, entorpecentes, anorexígenos e outros. Exigem receita especial (notificação de receita), registros no SNGPC e controles rigorosos. A transferência entre filiais pode ter restrições legais e operacionais.',
    porque_importa: 'Ao sugerir balanceamento envolvendo controlados, alertar sobre possíveis restrições de transferência. Ruptura em controlados de uso contínuo (Ritalina, Rivotril) causa impacto grave ao paciente. Capital imobilizado em controlados tem menor flexibilidade de resolução.',
    relacoes: 'Relacionado a: ruptura (prioridade máxima), balanceamento (com restrição), excesso. Identificar controlados pelo nome: buscar Metilfenidato, Clonazepam, Diazepam, Alprazolam, entre outros no campo principioativo ou descricao.',
    exemplos: 'Metilfenidato (Ritalina), Clonazepam (Rivotril), Diazepam, Alprazolam são exemplos de controlados comuns em farmácia. Ruptura em Ritalina prejudica pacientes com TDAH que dependem de uso contínuo.',
    categoria: 'balanceamento',
    tags: 'controlado,ANVISA,psicotrópico,portaria 344,SNGPC,receita especial,restrição,legal',
  },
  {
    termo: 'ponto_de_pedido',
    definicao: 'Nível de estoque que dispara a necessidade de reposição. Calculado como: (Demanda diária × Lead time do fornecedor) + Estoque de segurança. Nos dados, o campo qt_seguranca representa o estoque mínimo de segurança — quando qtestoque < qt_seguranca, o produto está abaixo do ponto de pedido.',
    porque_importa: 'Produto sistematicamente com qtestoque < qt_seguranca tem parâmetros de compra incorretos ou problema de fornecimento. O comprador responsável deve ser alertado para revisar o ponto de pedido ou negociar com fornecedor. É a raiz da ruptura crônica.',
    relacoes: 'Relacionado a: qt_seguranca, ruptura, ruptura_cronica, comprador. qt_seguranca nos dados É o ponto de pedido já calibrado — abaixo dele é sinal de alerta.',
    exemplos: 'Produto com demanda de 10un/dia e lead time de 5 dias e segurança de 20un: ponto de pedido = 70un. Se qtestoque < 70 e não há pedido em andamento (qt_pendencia_entrada = 0): urgência de compra.',
    categoria: 'compra',
    tags: 'ponto de pedido,estoque mínimo,reposição,lead time,compra,segurança,qt_seguranca',
  },
  {
    termo: 'mix_de_produtos',
    definicao: 'Conjunto de produtos disponíveis em cada filial, adaptado ao perfil da região e clientela local. Uma farmácia de bairro com público idoso deve ter mix diferente de uma farmácia em shopping frequentada por jovens. Mix inadequado gera excesso de produtos sem saída local e ruptura de produtos com alta demanda regional.',
    porque_importa: 'Excesso crônico com mediaf_un = 0 em uma filial pode indicar produto do mix errado para aquela loja — não resolve com balanceamento, precisa de revisão de compra. Antes de sugerir transferência, verificar se produto tem demanda (mediaf_un > 0). Se zero em todas as filiais, é problema de mix/compra.',
    relacoes: 'Relacionado a: item_morto, excesso, sazonalidade, linha, categoria, comprador. Campos linha e categoria ajudam a identificar perfil inadequado. Nome_filial e supervisor ajudam a contextualizar o perfil da loja.',
    exemplos: 'Produto dermatológico premium sem saída em filial de bairro popular: mix inadequado. Antibiótico pediátrico com pouca saída em filial sem clientela infantil no entorno. Suplementos esportivos em farmácia sem academia próxima.',
    categoria: 'inventario',
    tags: 'mix,produto,filial,perfil,demanda local,sortimento,adequação,linha,categoria',
  },
  {
    termo: 'perda_por_vencimento',
    definicao: 'Medicamento que ultrapassa a data de validade em estoque sem ser vendido. Representa perda financeira total (custo + descarte). É obrigatório retirar produtos vencidos de circulação (ANVISA). Candidatos: produtos com dias_parado > 90 e vlr_custo alto e mediaf_un baixo ou zero.',
    porque_importa: 'É o pior cenário do estoque parado — perda irreversível. Ação preventiva é essencial: identificar produtos com alto risco 60-90 dias antes do vencimento para promoção, devolução ao fornecedor ou transferência para filial com demanda. Impacto não é só financeiro — farmácia pode ter autuação por produto vencido.',
    relacoes: 'Relacionado a: item_morto, dias_parado, dias_sem_venda, excesso, capital_imobilizado. Produto com dias_parado > 90 + mediaf_un = 0 + vlr_custo alto = alerta máximo de perda iminente.',
    exemplos: 'Produto comprado em excesso para promoção que não vendeu: ação imediata necessária. Item importado de alto custo com demanda caindo: intervenção urgente. Vitamina sazonal comprada em excesso fora da época.',
    categoria: 'inventario',
    tags: 'vencimento,validade,perda,obsoleto,descarte,ANVISA,farmacovigilância,dias_parado',
  },
  {
    termo: 'analise_por_comprador',
    definicao: 'Agrupamento de produtos pelo comprador responsável para identificar padrões sistemáticos de over-buying (excesso recorrente na categoria) ou under-buying (ruptura crônica na categoria). Permite direcionar gestão e treinamento por responsável.',
    porque_importa: 'Um comprador que gera excesso sistematicamente na sua categoria tem parâmetros descalibrados ou perfil conservador demais. Outro com ruptura crônica precisa revisar pontos de pedido. A análise por comprador transforma um problema difuso em ação direcionada a um responsável específico.',
    relacoes: 'Relacionado a: excesso, ruptura_cronica, ponto_de_pedido. O campo comprador nos dados identifica o responsável por cada produto. Combinar com análise por linha e categoria para diagnóstico mais preciso.',
    exemplos: 'Comprador de dermocosméticos com R$200k em excesso na sua categoria: perfil over-buyer. Comprador de OTC com ruptura crônica em antibióticos no inverno: sub-comprando na alta temporada. Análise revela onde focar gestão.',
    categoria: 'compra',
    tags: 'comprador,responsável,over-buying,under-buying,parâmetros,calibração,categoria,gestão',
  },
  {
    termo: 'cobertura',
    definicao: 'Número de dias que o estoque atual consegue atender à demanda sem reposição. Fórmula: (qtestoque / mediaf_un) × 30, onde mediaf_un é a média mensal. Cobertura ideal varia por curva ABC: A = 30 dias, B = 60 dias, C = 90 dias. Se mediaf_un = 0, cobertura é infinita (produto sem demanda).',
    porque_importa: 'Cobertura muito baixa = risco de ruptura. Cobertura muito alta = capital imobilizado e risco de vencimento. O objetivo do balanceamento é equalizar a cobertura entre filiais para um nível ideal baseado na curva do produto.',
    relacoes: 'Relacionado a: curva_abc, ruptura, excesso, balanceamento, mediaf_un. A tabela ia_agente_fato_estoque não tem coluna cobertura direta — calcular como (qtestoque / mediaf_un) * 30. A tabela ia_fato_balanceamento tem coluna cobertura pré-calculada.',
    exemplos: 'Produto A com cobertura de 5 dias: alerta de ruptura iminente. Produto C com cobertura de 180 dias: excesso excessivo, risco de vencimento. Cobertura ideal para produto A: entre 25 e 35 dias.',
    categoria: 'metrica',
    tags: 'cobertura,dias,estoque,demanda,ruptura,excesso,ideal,curva_abc',
  },
];

async function main() {
  console.log(`\n🌱 Iniciando seed da base de conhecimento farma (${entries.length} termos)\n`);

  // First delete terms that already exist to avoid duplicates
  const existingTerms = entries.map(e => e.termo);
  for (const termo of existingTerms) {
    try {
      await deleteTerm(termo);
    } catch (_) {
      // ignore - table may not support mutations
    }
  }

  // Insert all entries
  let success = 0;
  let fail = 0;
  for (const entry of entries) {
    try {
      await insertKnowledge(entry);
      success++;
    } catch (err) {
      console.error(`❌ Erro ao inserir "${entry.termo}":`, err);
      fail++;
    }
  }

  console.log(`\n✅ Seed concluído: ${success} inseridos, ${fail} falhas`);

  // Verify total
  const url = `${process.env.CLICKHOUSE_URL}/?user=${encodeURIComponent(CH_USER)}&password=${encodeURIComponent(CH_PASS)}&database=${encodeURIComponent(CH_DB)}`;
  const resp = await fetch(url, {
    method: 'POST',
    body: `SELECT COUNT() as total, groupArray(termo) as termos FROM ia_base_conhecimento WHERE ativo = true`,
  });
  const text = await resp.text();
  console.log('\n📊 Base de conhecimento atual:', text.trim());
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
