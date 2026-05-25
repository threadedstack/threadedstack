import type {
  TEmailConfig,
  TEmailResult,
  IEmailStrategy,
  TSendEmailOptions,
  TInvitationEmailData,
  TMemberNotificationData,
  TWaitlistNotificationData,
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
  private service: IEmailStrategy

  constructor(config: TEmailConfig) {
    this.service = this.setup(config)
    const type = config.type || `console`
    logger.info(`[EMAIL SERVICE] Initialized with provider type "${type}"`)
  }

  /**
   * Create the appropriate email strategy based on configuration
   */
  private setup(config: TEmailConfig): IEmailStrategy {
    switch (config.type) {
      case `resend`:
        if (!config.api?.key)
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
    return this.service.send(options)
  }

  /**
   * Send organization invitation email to new users
   * Uses Handlebars template: templates/invitation.html
   */
  async invitation(data: TInvitationEmailData): Promise<boolean> {
    try {
      const html = await templates.render(`${EEmailTemplate.invitation}.html`, data)
      const text = await templates.render(`${EEmailTemplate.invitation}.txt`, data)

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
   * Send waitlist notification email to new users during alpha/beta
   * Uses Handlebars template: templates/waitlist-notification.html
   */
  async waitlistNotification(data: TWaitlistNotificationData): Promise<boolean> {
    try {
      const html = await templates.render(
        `${EEmailTemplate.waitlistNotification}.html`,
        data
      )
      const text = await templates.render(
        `${EEmailTemplate.waitlistNotification}.txt`,
        data
      )

      const result = await this.send({
        to: data.email,
        subject: `Welcome to Threaded Stack - You're on the waitlist`,
        html,
        text,
      })

      return result.success
    } catch (error: any) {
      logger.error(`[EMAIL SERVICE] Failed to send waitlist notification email:`, error)
      return false
    }
  }

  /**
   * Send notification email to existing users added to org
   * Uses Handlebars template: templates/member-notification.html
   */
  async sendMemberNotification(data: TMemberNotificationData): Promise<boolean> {
    try {
      const html = await templates.render(`${EEmailTemplate.member}.html`, data)
      const text = await templates.render(`${EEmailTemplate.member}.txt`, data)

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
}
