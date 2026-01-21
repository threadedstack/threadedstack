import type { Transporter } from 'nodemailer'
import type { TSendEmailOptions, TEmailResult } from '@TBE/types'

import * as nodemailer from 'nodemailer'
import { logger } from '@TBE/utils/logger'
import { BaseEmailStrategy } from '@TBE/services/email/strategies/base'

export type TMGStrategy = {
  host: string
  port: number
  user: string
  pass: string
}

/**
 * Mailgun Email Strategy
 *
 * Sends emails via Mailgun's SMTP service using nodemailer.
 * Requires SMTP credentials (host, port, user, password).
 *
 * @see https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp
 */
export class MailgunStrategy extends BaseEmailStrategy {
  private transporter: Transporter

  constructor(smtp: TMGStrategy, from: string) {
    super(from)

    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      // Use TLS for port 465
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    })

    logger.info(`[MAILGUN STRATEGY] Initialized with SMTP transport:`, {
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
    })
  }

  async send(options: TSendEmailOptions): Promise<TEmailResult> {
    try {
      const to = this.to(options.to)
      const from = this.from(options.from)

      const info = await this.transporter.sendMail({
        from,
        to: to.join(`, `),
        html: options.html,
        text: options.text,
        subject: options.subject,
      })

      logger.info(`[MAILGUN STRATEGY] Email sent successfully:`, {
        from,
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      })

      return {
        success: true,
        messageId: info.messageId,
      }
    } catch (error: any) {
      logger.error(`[MAILGUN STRATEGY] Failed to send email:`, error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(error.message),
      }
    }
  }
}
