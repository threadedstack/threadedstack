import type { TApp } from '@tdsk/domain'
import type { TProxyConfig } from '@TPX/types/config.types'

/**
 * Proxy-specific Express app type.
 * Inherits phantom DB/Payments/Email generics from TApp — accepted as a monorepo tradeoff.
 * The proxy uses app.locals.db (for domain validation) but not payments or email.
 */
export type TProxyApp = TApp<TProxyConfig>
