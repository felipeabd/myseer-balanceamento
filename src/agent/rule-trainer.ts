import Anthropic from '@anthropic-ai/sdk';
import { ClickHouseService } from '../clickhouse/client';
import { SessionManager } from '../rules/session-manager';
import { ConversationManager } from '../conversation/manager';
import { v4 as uuidv4 } from 'uuid';

export interface TenantContext {
  tenantId: string;
  userEmail: string;
}

export class RuleTrainerAgent {
  private anthropic: Anthropic;
  private clickhouse: ClickHouseService;
  private sessionManager: SessionManager;
  private conversations: ConversationManager;
  private model = 'claude-haiku-4-5';

  constructor(clickhouse: ClickHouseService, sessionManager: SessionManager, conversations: ConversationManager) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.clickhouse = clickhouse;
    this.sessionManager = sessionManager;
    this.conversations = conversations;
  }

  private getSystemPrompt(): string {
    return `# 🧠 IRIS — AGENTE DE TREINAMENTO DE REGRAS (BALANCEAMENTO)

## PAPEL
Você é o agente responsável por TREINAR e CADASTRAR regras de balanceamento de estoque.
Você NÃO executa análises de estoque.
Você NÃO sugere transferências.
Seu único objetivo é transformar orientações do usuário em regras estruturadas e salvá-las.

## MODO ATUAL
TREINAMENTO (sessão já ativa)

## CONTROLE DE SESSÃO (OBRIGATÓRIO)
A sessão de treinamento JÁ ESTÁ ATIVA ao entrar neste agente.
Você NÃO deve ativar sessão.
Você NÃO deve alterar o status da sessão no início.
Você SOMENTE pode ENCERRAR a sessão quando o usuário solicitar finalizar.

## MISSÃO
1) Interpretar mensagens do usuário relacionadas a regras de balanceamento.
2) Converter essas mensagens em uma REGRA DECLARATIVA compatível com a tabela ia_regras_balanceamento.
3) Apresentar a regra para validação do usuário.
4) Salvar a regra somente após confirmação explícita ("confirma").

## CONTEXTO DO NEGÓCIO
O balanceamento redistribui produtos entre lojas para:
- Reduzir rupturas
- Diminuir estoque parado
- Equalizar cobertura de estoque

Conceitos usados nas regras:
- Doadora → qtexcesso > 0
- Receptora → qtnecessidade > 0
- Cobertura → dias de estoque baseado em mediaf_un
- Curva AA → regra crítica: nunca pode ser doadora (salvo exceção explícita)

## CAMPOS DISPONÍVEIS PARA REGRAS
Você pode usar SOMENTE estes campos nos JSONs:

tenant, cdprod, cdFilial, nomefabricante, linha, curva,
qtnecessidade, qtexcesso, qtestoque, cobertura, mediaf_un,
dias_parado, dias_falta, filialdeposito

Sempre considere filialdeposito <> 1 como padrão.

## ESTRUTURA DA REGRA (OBRIGATÓRIA)
Você SEMPRE deve gerar regras neste formato:

{
  "tenant": "UUID ou null",
  "escopo": "balanceamento",
  "tipo": "bloqueio | limite | prioridade | excecao",
  "status": "ativo",
  "prioridade": 0,
  "alvo": { },
  "condicao": { },
  "acao": { },
  "texto": "descrição clara em linguagem de negócio",
  "criado_por": "usuario"
}

## CLASSIFICAÇÃO DE PRIORIDADE (OBRIGATÓRIA)

A prioridade define a ordem de aplicação da regra.
Quanto MENOR o número, MAIOR a prioridade.

Use EXATAMENTE estes intervalos:

- BLOQUEIO CRÍTICO → prioridade 1 a 9
- LIMITE OPERACIONAL → prioridade 10 a 19
- PRIORIDADE DE NEGÓCIO → prioridade 20 a 29
- HEURÍSTICA / DESEMPATE → prioridade 30 a 39

É PROIBIDO:
- inventar prioridades fora desses intervalos
- usar valores como 50, 100, 999 etc.
- alterar prioridade sem justificativa clara

Se houver dúvida sobre a classificação, pergunte ao usuário antes de gerar a regra.

## SIGNIFICADO DOS BLOCOS
- alvo → quem a regra afeta (produto, filial, fabricante, curva)
- condicao → quando a regra se aplica
- acao → efeito da regra no balanceamento
- texto → explicação humana, simples e objetiva

## TIPOS DE REGRA

### BLOQUEIO
Exemplo:
{
  "tipo": "bloqueio",
  "prioridade": 1,
  "acao": { "bloquear_doadora": true }
}

### LIMITE
Exemplo:
{
  "tipo": "limite",
  "prioridade": 10,
  "acao": { "percentual_max_excesso": 0.8 }
}

### PRIORIDADE
Exemplo:
{
  "tipo": "prioridade",
  "prioridade": 20,
  "acao": { "priorizar": "cobertura_negativa" }
}

### EXCEÇÃO
Exemplo:
{
  "tipo": "excecao",
  "prioridade": 5,
  "acao": { "permitir_doadora": true }
}

Se uma exceção conflitar com regra crítica, você DEVE alertar o usuário antes de prosseguir.

## FLUXO OBRIGATÓRIO

### 1. Interpretação
- Entenda exatamente o que o usuário deseja.
- Se faltar informação essencial, faça UMA pergunta objetiva.

### 2. Proposta de regra
Responda SEMPRE com:
1) Um resumo curto do entendimento
2) A REGRA PROPOSTA (JSON completo)
3) A frase:
   "Para confirmar essa regra, digite: confirma"

### 3. Confirmação
Quando o usuário responder "confirma":
- Use a tool SalvarRegra
- Envie exatamente o JSON proposto
- Confirme que a regra foi salva

### 4. Continuidade ou Encerramento
Pergunte:
Deseja realizar mais algum treinamento?
1 - Sim
2 - Não

Se a resposta for 2:
- Use a tool AtualizarSessao com status = 0
- A sessão será encerrada automaticamente
- Informe que voltou ao modo Análise de Balanceamento

## REGRAS DE COMPORTAMENTO
- Uma regra por vez
- Uma pergunta por vez
- Nunca inventar campos
- Nunca executar análise de estoque
- Linguagem de negócio, não técnica
- Se o usuário pedir análise:
  "Estou em modo treinamento. Para analisar o balanceamento, finalize o treinamento."
- O campo "acao" NUNCA pode ser null (use ao menos {})
- "prioridade" deve respeitar os intervalos definidos
- Se "alvo" ou "condicao" não forem necessários, envie {}
- Nunca envie campos fora da estrutura definida
`;
  }

  async chat(
    userMessage: string,
    conversationId: string,
    tenant: TenantContext
  ): Promise<string> {
    const tools: Anthropic.Tool[] = [
      {
        name: 'SalvarRegra',
        description: 'Salva uma nova regra de balanceamento no banco de dados',
        input_schema: {
          type: 'object',
          properties: {
            tenant: {
              type: 'string',
              description: 'UUID do tenant ou "null" para regra global',
            },
            escopo: {
              type: 'string',
              enum: ['balanceamento'],
              description: 'Escopo da regra',
            },
            tipo: {
              type: 'string',
              enum: ['bloqueio', 'limite', 'prioridade', 'excecao'],
              description: 'Tipo da regra',
            },
            status: {
              type: 'string',
              enum: ['ativo', 'inativo'],
              description: 'Status da regra',
            },
            prioridade: {
              type: 'integer',
              description: '1-9: crítico, 10-19: limite, 20-29: prioridade, 30-39: heurística',
            },
            alvo: {
              type: 'object',
              description: 'JSON com quem a regra afeta',
            },
            condicao: {
              type: 'object',
              description: 'JSON com quando a regra se aplica',
            },
            acao: {
              type: 'object',
              description: 'JSON com efeito da regra',
            },
            texto: {
              type: 'string',
              description: 'Descrição em linguagem de negócio',
            },
            criado_por: {
              type: 'string',
              description: 'Email do usuário',
            },
          },
          required: ['tipo', 'prioridade', 'alvo', 'condicao', 'acao', 'texto', 'criado_por'],
        },
      },
      {
        name: 'AtualizarSessao',
        description: 'Atualiza o status da sessão de treinamento. Use status=0 para encerrar o treinamento.',
        input_schema: {
          type: 'object',
          properties: {
            status: {
              type: 'integer',
              enum: [0, 1],
              description: '0 = encerrar treinamento, 1 = manter ativo',
            },
          },
          required: ['status'],
        },
      },
    ];

    // Get or create conversation and add user message
    const conv = this.conversations.getOrCreate(conversationId, tenant);
    this.conversations.addMessage(conv.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Build messages from conversation history
    const messages = this.buildAnthropicMessages(conv.messages);

    let iterations = 0;
    const maxIterations = 15;
    let finalResponse = '';

    while (iterations < maxIterations) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages,
        tools,
      });

      // Se terminou sem usar tool
      if (response.stop_reason === 'end_turn') {
        const textBlocks = response.content.filter((c) => c.type === 'text');
        finalResponse = textBlocks.map((b: any) => b.text).join('\n');
        break;
      }

      // Se usou tools
      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            let result: any;

            if (block.name === 'SalvarRegra') {
              result = await this.salvarRegra(block.input as any, tenant);
            } else if (block.name === 'AtualizarSessao') {
              result = await this.atualizarSessao(block.input as any, conversationId);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
      }

      iterations++;
    }

    if (iterations >= maxIterations) {
      finalResponse = 'Limite de iterações atingido. Por favor, tente novamente.';
    }

    // Save assistant response to conversation history
    this.conversations.addMessage(conv.id, {
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date(),
    });

    return finalResponse;
  }

  private buildAnthropicMessages(conversationMessages: any[]): Anthropic.MessageParam[] {
    return conversationMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
  }

  private async salvarRegra(input: any, tenant: TenantContext): Promise<any> {
    const id = uuidv4();

    // Determinar tenant: usar 'null' para global, senão usar o tenant fixo
    const tenantId =
      input.tenant === 'null' || input.tenant === null ? 'null' : tenant.tenantId;

    // Escape de strings
    const escape = (str: string) => str.replace(/'/g, "\\'");

    const query = `
      INSERT INTO ia_regras_balanceamento (
        id, tenant, escopo, tipo, status, prioridade,
        alvo, condicao, acao, texto, criado_por
      ) VALUES (
        '${id}',
        '${tenantId}',
        '${input.escopo || 'balanceamento'}',
        '${input.tipo}',
        '${input.status || 'ativo'}',
        ${input.prioridade},
        '${escape(JSON.stringify(input.alvo))}',
        '${escape(JSON.stringify(input.condicao))}',
        '${escape(JSON.stringify(input.acao))}',
        '${escape(input.texto)}',
        '${escape(input.criado_por)}'
      )
    `;

    try {
      await this.clickhouse.execute(query);
      return {
        success: true,
        id,
        message: 'Regra salva com sucesso',
      };
    } catch (error: any) {
      console.error('[RuleTrainer] Erro ao salvar regra:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async atualizarSessao(input: any, conversationId: string): Promise<any> {
    try {
      if (input.status === 0) {
        await this.sessionManager.endTrainingSession(conversationId);
        return {
          success: true,
          message: 'Sessão de treinamento encerrada',
        };
      } else {
        return {
          success: true,
          message: 'Sessão continua ativa',
        };
      }
    } catch (error: any) {
      console.error('[RuleTrainer] Erro ao atualizar sessão:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
