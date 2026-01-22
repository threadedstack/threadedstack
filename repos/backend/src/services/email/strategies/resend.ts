import type { TEmailConfig, TEmailResult, TSendEmailOptions } from '@TBE/types'

import { API } from '@TBE/services/api'
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
  #api: API

  constructor(config: TEmailConfig) {
    super(config.from)

    this.#api = new API({
      url: config?.apiHost || `https://api.resend.com/emails`,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        [`Content-Type`]: `application/json`,
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
        return {
          success: false,
          error: new Error(`Resend API error: ${error.message}`),
        }
      }

      logger.info(`[RESEND STRATEGY] Email sent successfully:`, {
        from,
        to: options.to,
        messageId: data.id,
        subject: options.subject,
      })

      return {
        success: true,
        messageId: data.id,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }
}
