import type { TSendEmailOptions, TEmailResult } from '@TBE/types/email.types'

import { logger } from '@TBE/utils/logger'
import { BaseEmailStrategy } from '@TBE/services/email/strategies/base'

/**
 * Console Email Strategy
 *
 * Development-only strategy that logs emails to the console instead of sending them.
 * Useful for local development and testing without requiring email service credentials.
 */
export class ConsoleStrategy extends BaseEmailStrategy {
  async send(options: TSendEmailOptions): Promise<TEmailResult> {
    const to = this.to(options.to)
    const from = this.from(options.from)

    logger.info(`[CONSOLE STRATEGY] Email would be sent:`, {
      to,
      from,
      subject: options.subject,
    })

    logger.debug(`[EMAIL CONTENT]`, {
      html: options.html.substring(0, 200) + `...`,
      text: options.text ? `${options.text.substring(0, 200)}...` : `N/A`,
    })

    return {
      success: true,
      messageId: `console-${Date.now()}`,
    }
  }
}
