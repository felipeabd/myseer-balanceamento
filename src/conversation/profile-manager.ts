import Anthropic from '@anthropic-ai/sdk';
import { ClickHouseService } from '../clickhouse/client';
import { ChatMessage, MessageContent, TextContent } from '../types';

/** Escape single quotes for ClickHouse SQL */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Extract plain text from MessageContent */
function contentToText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  const textBlock = content.find(b => b.type === 'text') as TextContent | undefined;
  return textBlock?.text ?? '';
}

const UPDATE_PROFILE_PROMPT = `Voce recebeu o perfil atual de um usuario e uma nova conversa.
Atualize o perfil incorporando novos padroes, preferencias e contexto revelados nesta conversa.

Perfil atual (pode estar vazio para novos usuarios):
{PERFIL_ATUAL}

Nova conversa:
{CONVERSA}

Gere um perfil atualizado e consolidado. Foque em:
1. Cargo e responsabilidades do usuario (ex: comprador, gestor, analista)
2. Areas de interesse recorrentes (ex: filiais especificas, linhas de produto, fabricantes)
3. Preferencias de analise (ex: prefere resumos executivos, gosta de detalhes por filial)
4. Padroes de uso (ex: foca em rupturas, monitora excesso, acompanha balanceamento)
5. Contexto de negocio relevante (ex: rede com 30 filiais, foco em curva A)

Responda APENAS com o perfil em texto corrido, 3-6 frases concisas. Nao use JSON. Nao use topicos numerados.`;

/**
 * Manages persistent user profiles for personalized agent responses.
 * Profiles are generated from conversation history and stored in ClickHouse.
 */
export class ProfileManager {
  private clickhouse: ClickHouseService;
  private anthropic: Anthropic;
  private tablesReady = false;
  private initPromise: Promise<void>;

  constructor(clickhouse: ClickHouseService, anthropic: Anthropic) {
    this.clickhouse = clickhouse;
    this.anthropic = anthropic;
    this.initPromise = this.initTable();
  }

  // ── Table Init ─────────────────────────────────────────

  private async initTable(): Promise<void> {
    try {
      await this.clickhouse.execute(`
        CREATE TABLE IF NOT EXISTS ia_perfil_usuario (
          tenant_id String,
          email_usuario String,
          agent_slug String,
          perfil String DEFAULT '',
          atualizado_em DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(atualizado_em)
        ORDER BY (tenant_id, email_usuario, agent_slug)
      `);
      this.tablesReady = true;
      console.log('[ProfileManager] ClickHouse table ready');
    } catch (err) {
      console.error('[ProfileManager] Failed to init table:', err);
    }
  }

  private async ensureReady(): Promise<boolean> {
    if (this.tablesReady) return true;
    await this.initPromise;
    return this.tablesReady;
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Fetch the current profile for a user+agent combination.
   * Returns empty string if no profile exists.
   */
  async getProfile(tenantId: string, userEmail: string, agentSlug: string): Promise<string> {
    if (!(await this.ensureReady())) return '';

    try {
      const rows = await this.clickhouse.rawQuery(`
        SELECT perfil
        FROM ia_perfil_usuario FINAL
        WHERE tenant_id = '${esc(tenantId)}'
          AND email_usuario = '${esc(userEmail)}'
          AND agent_slug = '${esc(agentSlug)}'
        LIMIT 1
      `);

      if (rows.length === 0) return '';
      return (rows[0].perfil as string) || '';
    } catch (err) {
      console.error('[ProfileManager] Failed to fetch profile:', err);
      return '';
    }
  }

  /**
   * Update the user profile based on a new conversation.
   * Reads current profile, sends to LLM to merge with new conversation, stores result.
   * Safe to call as fire-and-forget.
   */
  async updateProfile(
    tenantId: string,
    userEmail: string,
    agentSlug: string,
    messages: ChatMessage[]
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    // Need at least one exchange to build a profile
    const userMsgs = messages.filter(m => m.role === 'user');
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    if (userMsgs.length < 1 || assistantMsgs.length < 1) return;

    try {
      const currentProfile = await this.getProfile(tenantId, userEmail, agentSlug);

      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'Usuario' : 'Agente'}: ${contentToText(m.content).substring(0, 400)}`)
        .join('\n');

      const prompt = UPDATE_PROFILE_PROMPT
        .replace('{PERFIL_ATUAL}', currentProfile || '(sem perfil ainda)')
        .replace('{CONVERSA}', conversationText);

      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const newProfile = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim();

      if (!newProfile) return;

      await this.clickhouse.execute(`
        INSERT INTO ia_perfil_usuario (tenant_id, email_usuario, agent_slug, perfil, atualizado_em)
        VALUES (
          '${esc(tenantId)}',
          '${esc(userEmail)}',
          '${esc(agentSlug)}',
          '${esc(newProfile)}',
          now()
        )
      `);

      console.log(`[ProfileManager] Profile updated for ${userEmail}@${agentSlug}`);
    } catch (err) {
      console.error('[ProfileManager] Failed to update profile:', err);
    }
  }
}

/**
 * Format a user profile for injection into the system prompt.
 */
export function formatProfileForPrompt(profile: string): string {
  if (!profile) return '';

  return `## PERFIL DO USUARIO
Com base em interacoes anteriores, voce ja conhece este usuario:

${profile}

Use este perfil para personalizar suas respostas: adapte o nivel de detalhe, antecipe suas areas de interesse e mantenha consistencia com o contexto de negocio ja estabelecido.`;
}
