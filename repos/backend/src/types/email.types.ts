export enum EEmailTemplate {
  invitation = `invitation`,
  member = `member-notification`,
}

export enum EEmailType {
  resend = `resend`,
  mailgun = `mailgun`,
  console = `console`,
}

export type TEmailType = `${EEmailType}`

/**
 * Email Service Configuration
 */
export type TEmailConfig = {
  /**
   * Email provider type - determines which strategy to use
   * - console: Log emails to console (development)
   * - resend: Use Resend.com API
   * - mailgun: Use Mailgun via SMTP
   */
  type: TEmailType

  /**
   * Default "from" email address
   */
  from: string

  /**
   * API key for Resend
   */
  apiKey?: string

  /**
   * SMTP configuration for Mailgun
   */
  smtp?: {
    host: string
    port: number
    user: string
    pass: string
    secure?: boolean
  }
}

/**
 * Email send options
 */
export type TSendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
}

/**
 * Email send result
 */
export type TEmailResult = {
  success: boolean
  messageId?: string
  error?: Error
}

/**
 * Email provider strategy interface
 */
export interface IEmailStrategy {
  send(options: TSendEmailOptions): Promise<TEmailResult>
}

/**
 * Template data types
 */
export type TInvitationEmailData = {
  email: string
  orgName: string
  roleType: string
  inviterName: string
  invitationUrl: string
  expiresInDays: number
}

export type TMemberNotificationData = {
  email: string
  orgUrl: string
  orgName: string
  roleType: string
  inviterName: string
}
