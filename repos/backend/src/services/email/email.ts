import type {
  TEmailConfig,
  TEmailResult,
  IEmailStrategy,
  TSendEmailOptions,
  TInvitationEmailData,
  TMemberNotificationData,
} from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { EEmailTemplate } from '@TBE/types'
import { templates } from '@TBE/services/email/templates'
import { ResendStrategy } from '@TBE/services/email/strategies/resend'
import { MailgunStrategy } from '@TBE/services/email/strategies/mailgun'
import { ConsoleStrategy } from '@TBE/services/email/strategies/console'

/**
 * Email Service
 *
 * Provider-agnostic email service using the Strategy Pattern.
 * Switches between Resend, Mailgun, or Console logging based on configuration.
 *
 * Supported Providers:
 * - Resend (via REST API)
 * - Mailgun (via SMTP/nodemailer)
 * - Console (development logging)
 */
export class EmailService {
  private strategy: IEmailStrategy

  constructor(config: TEmailConfig) {
    this.strategy = this.createStrategy(config)
    const type = config.type || `console`
    logger.info(`[EMAIL SERVICE] Initialized with provider type "${type}"`)
  }

  /**
   * Create the appropriate email strategy based on configuration
   */
  private createStrategy(config: TEmailConfig): IEmailStrategy {
    switch (config.type) {
      case `resend`:
        if (!config.apiKey)
          throw new Error(`Resend API key is required when using resend provider`)
        return new ResendStrategy(config)

      case `mailgun`:
        if (!config.smtp)
          throw new Error(`SMTP configuration is required when using mailgun provider`)
        return new MailgunStrategy(config.smtp, config.from)

      case `console`:
        return new ConsoleStrategy(config.from)

      default:
        logger.warn(
          `[EMAIL SERVICE] Unknown provider '${config.type}', falling back to console`
        )
        return new ConsoleStrategy(config.from)
    }
  }

  /**
   * Send email via configured provider strategy
   */
  async send(options: TSendEmailOptions): Promise<TEmailResult> {
    return this.strategy.send(options)
  }

  /**
   * Send organization invitation email to new users
   * Uses Handlebars template: templates/invitation.html
   */
  async invitation(data: TInvitationEmailData): Promise<boolean> {
    try {
      const html = await templates.render(EEmailTemplate.invitation, data)
      const text = this.buildInvitationEmailText(data)

      const result = await this.send({
        to: data.email,
        subject: `Invitation to join ${data.orgName} on Threaded Stack`,
        html,
        text,
      })

      return result.success
    } catch (error: any) {
      logger.error(`[EMAIL SERVICE] Failed to send invitation email:`, error)
      return false
    }
  }

  /**
   * Send notification email to existing users added to org
   * Uses Handlebars template: templates/member-notification.html
   */
  async sendMemberNotification(data: TMemberNotificationData): Promise<boolean> {
    try {
      const html = await templates.render(EEmailTemplate.member, data)
      const text = this.buildMemberNotificationText(data)

      const result = await this.send({
        to: data.email,
        subject: `You've been added to ${data.orgName} on Threaded Stack`,
        html,
        text,
      })

      return result.success
    } catch (error: any) {
      logger.error(`[EMAIL SERVICE] Failed to send member notification email:`, error)
      return false
    }
  }

  /**
   * Build invitation email plain text fallback
   */
  private buildInvitationEmailText(data: TInvitationEmailData): string {
    return `
You've been invited to join ${data.orgName}

${data.inviterName} has invited you to join ${data.orgName} on Threaded Stack with the role of ${data.roleType}.

To accept this invitation, visit:
${data.invitationUrl}

This invitation will expire in ${data.expiresInDays} days.

If you don't have a Threaded Stack account yet, clicking the link above will guide you through creating one and joining the organization.

---
This is an automated email from Threaded Stack. Please do not reply to this message.
If you didn't expect this invitation, you can safely ignore this email.
    `.trim()
  }

  /**
   * Build member notification email plain text fallback
   */
  private buildMemberNotificationText(data: TMemberNotificationData): string {
    return `
You've been added to ${data.orgName}

${data.inviterName} has added you to ${data.orgName} on Threaded Stack with the role of ${data.roleType}.

View the organization: ${data.orgUrl}

---
This is an automated email from Threaded Stack. Please do not reply to this message.
    `.trim()
  }
}
