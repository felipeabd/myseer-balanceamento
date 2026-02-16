-- =====================================================
-- Popularização: Base de Conhecimento Inicial
-- Descrição: Conhecimentos CONCEITUAIS de negócio
-- IMPORTANTE: Apenas definições e explicações (SEM regras operacionais)
-- =====================================================

-- ============= CONCEITOS DE ESTOQUE =============

INSERT INTO default.ia_base_conhecimento
(termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant) VALUES

('excesso',
 'Quantidade de estoque acima da quantidade máxima ideal definida para o produto.',
 'Excesso representa capital parado (custo de oportunidade) e aumenta significativamente o risco de perdas por vencimento, obsolescência ou mudança de mix.',
 'Quanto mais produtos em excesso, maior a chance de ter perdas por vencidos. Produtos em excesso devem ser redistribuídos para lojas com necessidade para evitar desperdício de capital.',
 'Exemplo: Loja tem estoque para 120 dias mas o ideal seria 30 dias. Os 90 dias a mais representam excesso que poderia estar gerando vendas em outra filial.',
 'metrica',
 '["estoque", "cobertura", "capital_parado", "vencido"]',
 'global'),

('necessidade',
 'Quantidade de produto faltante para atingir a cobertura mínima de estoque.',
 'Lojas com necessidade estão em risco iminente de ruptura, o que causa perda de vendas, insatisfação do cliente e migração para concorrentes.',
 'Necessidade indica urgência de reposição. Produtos em excesso em outras lojas devem ser transferidos para suprir necessidades e evitar rupturas.',
 'Exemplo: Loja vende 10 unidades/dia mas tem estoque para apenas 3 dias. Precisa de mais 4 dias de estoque (40 unidades) para atingir mínimo de 7 dias.',
 'metrica',
 '["estoque", "cobertura", "ruptura", "reposicao"]',
 'global'),

('cobertura',
 'Número de dias que o estoque atual consegue atender a demanda, considerando a média de vendas diária do produto. Calculada como: estoque atual ÷ média de vendas por dia.',
 'É o principal indicador para identificar excessos e necessidades. Permite comparar produtos diferentes na mesma métrica (dias).',
 'Cobertura baixa (<7 dias) indica necessidade/ruptura. Cobertura alta (>90 dias) indica excesso. Cobertura ideal varia por produto mas geralmente fica entre 15-45 dias.',
 'Exemplo: Produto com 100 unidades em estoque e vende 5 unidades/dia = cobertura de 20 dias (situação saudável).',
 'metrica',
 '["estoque", "demanda", "dias", "planejamento"]',
 'global'),

('vencido',
 'Produto que está parado em estoque há muito tempo sem movimentação de vendas.',
 'Produtos vencidos têm altíssimo risco de se tornarem perda total por validade expirada, obsolescência tecnológica ou saída do mix de vendas. Prioridade máxima de redistribuição.',
 'Produtos em excesso por muito tempo viram vencidos. Quanto maior o tempo parado, maior urgência de transferir para lojas que consigam vendê-lo antes de virar perda definitiva.',
 'Exemplo: Medicamento parado há 8 meses sem vender nenhuma unidade. Precisa urgentemente ir para loja com demanda ou será descartado quando vencer a validade.',
 'indicador',
 '["perda", "obsolescencia", "tempo_parado", "urgencia"]',
 'global'),

('ruptura',
 'Situação onde o cliente vai até a loja procurar um produto mas não encontra na prateleira por falta de estoque.',
 'Ruptura causa perda de venda imediata, insatisfação do cliente e risco de migração definitiva para concorrente. Impacto direto e mensurável no faturamento.',
 'Ruptura acontece quando necessidade não é atendida a tempo. Produtos com cobertura muito baixa estão em risco de ruptura e devem receber transferências prioritariamente.',
 'Exemplo: Cliente procura shampoo específico mas prateleira está vazia. Cliente compra marca concorrente ou vai em outra farmácia. Venda perdida + cliente insatisfeito.',
 'indicador',
 '["venda_perdida", "cliente", "disponibilidade", "servico"]',
 'global');

-- ============= CONCEITOS DE CLASSIFICAÇÃO =============

INSERT INTO default.ia_base_conhecimento
(termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant) VALUES

('curva_abc',
 'Classificação de produtos baseada no Princípio de Pareto: Curva A = 20% dos produtos que geram 80% do faturamento; Curva B = 30% que geram 15%; Curva C = 50% que geram 5%.',
 'Permite priorizar esforços nos produtos de maior impacto financeiro. Produtos Curva A exigem atenção máxima para evitar rupturas, enquanto Curva C podem ter cobertura mais flexível.',
 'No balanceamento, produtos Curva A devem ser priorizados pois ruptura deles causa maior impacto no faturamento. Curva C podem ser balanceados com menor urgência.',
 'Exemplo: Loja tem 1000 SKUs. 200 deles (Curva A) respondem por 80% das vendas. Se faltar paracetamol (Curva A) o impacto é muito maior que faltar band-aid importado (Curva C).',
 'conceito',
 '["classificacao", "faturamento", "priorizacao", "pareto"]',
 'global'),

('linha',
 'Agrupamento de produtos por categoria ou departamento (ex: Medicamentos, Perfumaria, Dermocosméticos, HPC).',
 'Permite análises e balanceamentos segmentados. Produtos da mesma linha geralmente têm comportamento de demanda similar e compartilham expertise de compradores.',
 'Linhas diferentes podem ter estratégias de cobertura diferentes. Medicamentos de alta rotação vs perfumaria de nicho têm dinâmicas completamente distintas.',
 'Exemplo: Linha HPC (Higiene Pessoal e Cosméticos) inclui shampoos, sabonetes, desodorantes. Comportamento sazonal diferente de Medicamentos.',
 'conceito',
 '["categoria", "departamento", "segmentacao", "agrupamento"]',
 'global');

-- ============= PROCESSOS E ESTRATÉGIAS =============

INSERT INTO default.ia_base_conhecimento
(termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant) VALUES

('balanceamento',
 'Processo de redistribuir produtos entre lojas para equalizar níveis de estoque, transferindo excesso de uma filial para suprir necessidade de outra.',
 'Otimiza capital de giro, reduz perdas por vencimento, evita rupturas e melhora nível de serviço ao cliente sem precisar comprar mais produtos.',
 'Balanceamento eficaz identifica excesso e necessidade simultaneamente, priorizando produtos críticos (Curva A, vencidos, rupturas) e rotas viáveis.',
 'Exemplo: Filial A tem 200 unidades de produto X (excesso de 150) enquanto Filial B está sem estoque (necessidade de 100). Transferir 100 unidades resolve ambos os problemas.',
 'processo',
 '["transferencia", "redistribuicao", "otimizacao", "logistica"]',
 'global'),

('equalizacao_cobertura',
 'Algoritmo que busca equilibrar dias de cobertura entre lojas, priorizando mover produtos de lojas com muitos dias de estoque para lojas com poucos dias.',
 'Garante distribuição justa de estoque pela rede, maximizando vendas totais e minimizando perdas. Lojas não ficam nem desabastecidas nem superestocadas.',
 'Equalização considera a demanda específica de cada loja (média de vendas) ao invés de apenas quantidade física, tornando comparações justas entre lojas de tamanhos diferentes.',
 'Exemplo: Loja grande vende 50 unidades/dia e tem 500 em estoque (10 dias). Loja pequena vende 5/dia e tem 10 em estoque (2 dias). Apesar de ter menos unidades, a pequena está em situação mais crítica.',
 'processo',
 '["algoritmo", "otimizacao", "distribuicao", "cobertura"]',
 'global');

-- ============= INDICADORES FINANCEIROS =============

INSERT INTO default.ia_base_conhecimento
(termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant) VALUES

('capital_parado',
 'Valor financeiro investido em estoque que não está gerando retorno por estar parado (excesso) ou mal distribuído.',
 'Capital parado poderia estar investido em produtos com mais giro, gerando mais vendas e lucro. É um custo de oportunidade direto.',
 'Excesso representa capital parado. Quanto maior a cobertura acima do ideal, maior o capital que poderia estar sendo usado de forma mais produtiva.',
 'Exemplo: R$ 50.000 em produtos com cobertura de 200 dias. Se reduzir para 30 dias, libera R$ 42.500 para investir em produtos com mais demanda.',
 'indicador',
 '["financeiro", "custo_oportunidade", "investimento", "giro"]',
 'global'),

('valor_transferivel',
 'Valor financeiro total que pode ser movimentado através de transferências de balanceamento.',
 'Representa o impacto financeiro e priorização da operação de balanceamento. Transferências de maior valor geralmente têm maior retorno.',
 'Produtos Curva A tendem a ter maior valor transferível pois têm maior giro e maior valor unitário. Priorizar por valor otimiza o retorno do esforço logístico.',
 'Exemplo: Transferir R$ 10.000 em produtos de alta demanda é mais impactante que transferir R$ 500 em produtos de baixo giro.',
 'indicador',
 '["financeiro", "priorizacao", "impacto", "retorno"]',
 'global');

-- ============= METADADOS =============

INSERT INTO default.ia_base_conhecimento
(termo, definicao, porque_importa, relacoes, exemplos, categoria, tags, tenant) VALUES

('versao_conhecimento',
 'Versão 1.0.0 da base de conhecimento de negócio',
 'Controle de versionamento para rastreabilidade de mudanças',
 'Atualizado conforme evolução do entendimento de negócio',
 'Primeira versão criada em 2026-02-16',
 'metadado',
 '["sistema", "versao", "controle"]',
 'global');
