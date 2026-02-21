import { ClickHouseService } from '../clickhouse/client';

export interface TrainingSession {
  conversationId: string;
  tenantId: string;
  userEmail: string;
  agentMode: 'rule_trainer' | 'iris';
  status: 0 | 1; // 0 = normal, 1 = treinamento
  startedAt: Date;
  endedAt?: Date;
  lastActivity: Date;
}

export class SessionManager {
  constructor(private clickhouse: ClickHouseService) {}

  /**
   * Busca a sessão ativa de uma conversa
   */
  async getActiveSession(conversationId: string): Promise<TrainingSession | null> {
    const query = `
      SELECT
        conversa_id as conversationId,
        tenant_id as tenantId,
        email_usuario as userEmail,
        modo_agente as agentMode,
        status,
        iniciado_em as startedAt,
        encerrado_em as endedAt,
        ultima_atividade as lastActivity
      FROM ia_sessoes_regras
      WHERE conversa_id = '${conversationId}'
      ORDER BY ultima_atividade DESC
      LIMIT 1
    `;

    const result = await this.clickhouse.query(query, { tenantId: '', userEmail: '' });

    if (result.length === 0) {
      return null;
    }

    return result[0] as unknown as TrainingSession;
  }

  /**
   * Inicia uma sessão de treinamento
   */
  async startTrainingSession(
    conversationId: string,
    tenantId: string,
    userEmail: string
  ): Promise<void> {
    const query = `
      INSERT INTO ia_sessoes_regras (
        conversa_id,
        tenant_id,
        email_usuario,
        modo_agente,
        status,
        iniciado_em
      ) VALUES (
        '${conversationId}',
        '${tenantId}',
        '${userEmail}',
        'rule_trainer',
        1,
        now()
      )
    `;

    await this.clickhouse.execute(query);
  }

  /**
   * Encerra uma sessão de treinamento e volta ao modo normal
   */
  async endTrainingSession(conversationId: string): Promise<void> {
    // Buscar dados da última sessão
    const session = await this.getActiveSession(conversationId);

    if (!session) {
      throw new Error(`Sessão não encontrada para conversa_id: ${conversationId}`);
    }

    const query = `
      INSERT INTO ia_sessoes_regras (
        conversa_id,
        tenant_id,
        email_usuario,
        modo_agente,
        status,
        iniciado_em,
        encerrado_em
      ) VALUES (
        '${conversationId}',
        '${session.tenantId}',
        '${session.userEmail}',
        'iris',
        0,
        '${new Date(session.startedAt).toISOString().slice(0, 19).replace('T', ' ')}',
        now()
      )
    `;

    await this.clickhouse.execute(query);
  }

  /**
   * Verifica se uma conversa está em modo de treinamento
   */
  async isInTrainingMode(conversationId: string): Promise<boolean> {
    const session = await this.getActiveSession(conversationId);
    return session?.status === 1 && session?.agentMode === 'rule_trainer';
  }
}
