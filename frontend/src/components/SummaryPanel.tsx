interface SummaryPanelProps {
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-3 pb-1 border-b border-gray-200" style={{ color: '#272154' }}>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-gray-700">
        {children}
      </div>
    </div>
  );
}

function Example({ type, text }: { type: 'good' | 'bad'; text: string }) {
  return (
    <div className={`flex gap-2 rounded-lg px-3 py-2 ${type === 'good' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <span className="flex-shrink-0 font-bold text-sm">{type === 'good' ? '✅' : '❌'}</span>
      <p className="italic text-gray-600 text-xs leading-relaxed">"{text}"</p>
    </div>
  );
}

function ChatBubble({ role, text }: { role: 'user' | 'iris'; text: string }) {
  return (
    <div className={`flex gap-2 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {role === 'iris' && (
        <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-white text-[9px] font-bold"
          style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}>
          I
        </div>
      )}
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
        role === 'user'
          ? 'text-white'
          : 'bg-white border border-gray-200 text-gray-700'
      }`}
        style={role === 'user' ? { background: 'linear-gradient(135deg, #2A81B8 0%, #494495 100%)' } : {}}
      >
        {text}
      </div>
      {role === 'user' && (
        <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 bg-gray-300 flex items-center justify-center text-gray-600 text-[9px] font-bold">
          U
        </div>
      )}
    </div>
  );
}

function ConversationDemo({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
      {children}
    </div>
  );
}

export function SummaryPanel({ onClose }: SummaryPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: '#272154' }}>Guia de Boas Práticas</h1>
            <p className="text-xs text-gray-500 mt-0.5">Como aproveitar ao máximo a Iris</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Intro */}
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            A Iris é uma IA especializada nos dados da sua rede. Para obter respostas mais precisas e usar menos créditos, siga as orientações abaixo. Cada seção traz exemplos práticos e simulações de conversa.
          </p>

          {/* 1 */}
          <Section title="1. Seja específico nas suas perguntas">
            <p className="text-gray-600 leading-relaxed">
              A Iris trabalha com dados reais da sua rede. Quanto mais contexto você fornecer — filial, produto, período — mais precisa e útil será a resposta.
            </p>
            <div className="space-y-2 mt-2">
              <Example type="bad" text="Mostre o estoque" />
              <Example type="good" text="Quais produtos da filial 5 estão com cobertura abaixo de 7 dias?" />
              <Example type="bad" text="Como estão as vendas?" />
              <Example type="good" text="Compare o faturamento de janeiro e fevereiro de 2026 por filial. Destaque as que cresceram menos de 5%." />
            </div>
          </Section>

          {/* 2 */}
          <Section title="2. Uma pergunta por vez">
            <p className="text-gray-600 leading-relaxed">
              Perguntas compostas geram respostas mais longas, mais lentas e com maior consumo de tokens. Divida suas análises em mensagens separadas.
            </p>
            <div className="space-y-2 mt-2">
              <Example type="bad" text="Quais produtos estão em risco de ruptura? E os com excesso? E qual o capital imobilizado total?" />
              <Example type="good" text="Quais produtos estão em risco de ruptura?" />
              <p className="text-xs text-gray-400 pl-2">→ Depois, em uma nova mensagem: "Agora mostre os com excesso."</p>
            </div>
          </Section>

          {/* 3 */}
          <Section title="3. Use os cards de ação rápida como ponto de partida">
            <p className="text-gray-600 leading-relaxed">
              Cada agente possui 4 análises pré-configuradas com prompts otimizados. Clique em um card e refine a análise com perguntas de acompanhamento na sequência.
            </p>
            <p className="text-xs font-medium text-gray-500 mt-3 mb-2">Exemplo de conversa eficiente:</p>
            <ConversationDemo>
              <ChatBubble role="user" text="[Clica no card 'Risco de Ruptura']" />
              <ChatBubble role="iris" text="Encontrei 12 produtos com risco de ruptura nos próximos 15 dias. Os mais críticos: Dipirona 500mg (filial 3, cobertura 2 dias), Omeprazol 20mg (filial 7, cobertura 3 dias)..." />
              <ChatBubble role="user" text="Me dê mais detalhes sobre a Dipirona 500mg. Quais filiais têm excesso para transferência?" />
              <ChatBubble role="iris" text="A filial 2 possui 340 unidades em excesso e a filial 9 possui 210 unidades. Ambas estão a menos de 50km da filial 3 e podem suprir a demanda por 18 dias." />
            </ConversationDemo>
          </Section>

          {/* 4 */}
          <Section title="4. Itere: construa a análise aos poucos">
            <p className="text-gray-600 leading-relaxed">
              A Iris mantém o contexto da conversa. Você não precisa repetir informações já mencionadas — basta continuar de onde parou.
            </p>
            <p className="text-xs font-medium text-gray-500 mt-3 mb-2">Exemplo de iteração:</p>
            <ConversationDemo>
              <ChatBubble role="user" text="Quais são os produtos da curva A com capital imobilizado acima de R$ 10.000?" />
              <ChatBubble role="iris" text="São 8 produtos. O maior é Losartana 50mg com R$ 45.000 imobilizados na filial 6." />
              <ChatBubble role="user" text="Desses 8, quais têm filiais receptoras disponíveis para transferência?" />
              <ChatBubble role="iris" text="5 dos 8 possuem filiais receptoras com necessidade confirmada. Recomendo priorizar Losartana 50mg e Atenolol 25mg..." />
            </ConversationDemo>
          </Section>

          {/* 5 */}
          <Section title="5. Peça resumos e recortes, não listagens completas">
            <p className="text-gray-600 leading-relaxed">
              Solicitar todos os registros gera respostas enormes e consome muito mais tokens. Prefira pedir os casos mais críticos ou os mais relevantes.
            </p>
            <div className="space-y-2 mt-2">
              <Example type="bad" text="Mostre todos os produtos vencidos" />
              <Example type="good" text="Quais os 10 produtos com maior valor em estoque vencido? Ordene pelo prejuízo estimado." />
              <Example type="bad" text="Liste todos os produtos com estoque negativo de todas as filiais" />
              <Example type="good" text="Mostre os 5 casos mais críticos de estoque negativo com maior impacto financeiro." />
            </div>
          </Section>

          {/* 6 */}
          <Section title="6. Use o CSV para análises detalhadas">
            <p className="text-gray-600 leading-relaxed">
              Quando a resposta contiver muitos registros, a Iris oferece um botão para baixar os dados em CSV. Use-o para análises no Excel sem precisar pedir tudo pelo chat — isso economiza créditos e é mais eficiente.
            </p>
            <p className="text-xs font-medium text-gray-500 mt-3 mb-2">Exemplo:</p>
            <ConversationDemo>
              <ChatBubble role="user" text="Me dê a lista completa de oportunidades de balanceamento com filial de origem, destino e quantidade sugerida." />
              <ChatBubble role="iris" text="Encontrei 143 oportunidades. Aqui estão os 10 casos mais críticos... Para a lista completa, use o botão abaixo: [Baixar CSV]" />
            </ConversationDemo>
          </Section>

          {/* 7 */}
          <Section title="7. Como economizar créditos">
            <div className="space-y-4">

              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <p className="font-medium text-blue-800 text-sm">Inicie uma nova conversa para cada assunto</p>
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  O histórico completo é reenviado a cada mensagem. Conversas longas consomem muito mais créditos. Ao mudar de assunto, clique em <strong>+ Nova Conversa</strong>.
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <p className="font-medium text-blue-800 text-sm">Não repita contexto já fornecido</p>
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  Dentro da mesma conversa, a Iris já sabe o que foi discutido. Não é necessário repetir produto, filial ou período em cada mensagem.
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <p className="font-medium text-blue-800 text-sm">Evite confirmações desnecessárias</p>
                <div className="space-y-1 mt-2">
                  <Example type="bad" text="Você entendeu minha pergunta? Pode me responder sobre estoque negativo da filial 3?" />
                  <Example type="good" text="Quais produtos têm estoque negativo na filial 3?" />
                </div>
              </div>

            </div>
          </Section>

          {/* 8 */}
          <Section title="8. Exemplos por agente">
            <div className="space-y-4">

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gestor de Estoque</p>
                <ul className="space-y-1.5">
                  {[
                    'Filial 4: quais produtos têm cobertura abaixo de 10 dias e demanda histórica acima de 50 unidades/mês?',
                    'Mostre os 5 produtos com maior MAPE na filial 2 nos últimos 3 meses.',
                    'Quais produtos têm excesso superior a 90 dias de cobertura e podem ser redistribuídos?',
                    'Qual o valor total de capital imobilizado em produtos da curva A parados há mais de 60 dias?',
                  ].map((ex, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-600">
                      <span className="text-gray-400 flex-shrink-0">→</span>
                      <span className="italic">"{ex}"</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gestor de Vendas</p>
                <ul className="space-y-1.5">
                  {[
                    'Compare a margem de Dipirona 500mg entre as filiais. Alguma está vendendo abaixo do custo?',
                    'Quais produtos são comprados juntos com Amoxicilina 500mg em mais de 30% dos cupons?',
                    'Filiais com queda de faturamento superior a 10% em relação ao mês anterior — quais são?',
                    'Qual o percentual de meta atingida por filial até hoje? Quais estão abaixo de 70%?',
                  ].map((ex, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-600">
                      <span className="text-gray-400 flex-shrink-0">→</span>
                      <span className="italic">"{ex}"</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gestor de Prevenção</p>
                <ul className="space-y-1.5">
                  {[
                    'Quais produtos vencem nos próximos 30 dias com mais de 50 unidades em estoque?',
                    'Mostre as filiais com maior volume de avarias registradas nos últimos 60 dias.',
                    'Quais produtos têm estoque negativo com movimentação de saída recente?',
                    'Qual o valor total de prejuízo estimado com produtos vencidos neste mês?',
                  ].map((ex, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-600">
                      <span className="text-gray-400 flex-shrink-0">→</span>
                      <span className="italic">"{ex}"</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
