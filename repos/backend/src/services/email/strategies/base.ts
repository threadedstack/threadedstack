import type {
  TEmailResult,
  IEmailStrategy,
  TSendEmailOptions,
} from '@TBE/types/email.types'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

/**
 * Base Email Strategy
 *
 * Abstract base class that all email provider strategies must extend.
 * Provides common functionality and enforces the strategy interface.
 */
export abstract class BaseEmailStrategy implements IEmailStrategy {
  _from: string

  constructor(from: string) {
    this._from = from
  }

  /**
   * Send email - must be implemented by concrete strategies
   */
  abstract send(options: TSendEmailOptions): Promise<TEmailResult>

  /**
   * Get the "from" address, with fallback to default
   */
  protected from(from?: string): string {
    return from || this._from
  }

  /**
   * Get normalized recipient(s) as an array
   */
  protected to(to: string | string[]): string[] {
    return ensureArr(to)
  }
}
