import type { TEmailConfig, TEmailResult, TSendEmailOptions } from '@TBE/types'

import { ApiService } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { BaseEmailStrategy } from '@TBE/services/email/strategies/base'

/**
 * Resend.com Email Strategy
 *
 * Sends emails via the Resend.com API using their REST endpoint.
 * Requires API key authentication.
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
export class ResendStrategy extends BaseEmailStrategy {
  #api: ApiService

  constructor(config: TEmailConfig) {
    super(config.from)

    this.#api = new ApiService({
      url: config?.api?.host || `https://api.resend.com/emails`,
      headers: {
        [`Content-Type`]: `application/json`,
        Authorization: `Bearer ${config?.api?.key}`,
      },
    })
  }

  async send(options: TSendEmailOptions): Promise<TEmailResult> {
    try {
      const to = this.to(options.to)
      const from = this.from(options.from)

      const payload = {
        to,
        from,
        html: options.html,
        subject: options.subject,
        ...(options.text && { text: options.text }),
      }

      const { data, error } = await this.#api.post({ data: payload })

      if (error) {
        logger.error(`[RESEND ERROR]`, {
          from,
          error,
          to: options.to,
        })
        return {
          success: false,
          error: new Error(`Resend API error: ${error.message}`),
        }
      }

      logger.info(`[RESEND STRATEGY] Email sent successfully:`, {
        from,
        to: options.to,
        messageId: data?.id,
        subject: options.subject,
      })

      return {
        success: true,
        messageId: data?.id,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }
}
