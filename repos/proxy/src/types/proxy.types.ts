import type { TApp, TAuthHeaderObj } from '@tdsk/domain'
import type { Auth } from '@TPX/services/auth'
import type { TDatabase } from '@tdsk/database'
import type { TProxyConfig } from '@TPX/types/config.types'
/**
 * Proxy-specific Express app type.
 * Inherits phantom DB/Payments/Email generics from TApp — accepted as a monorepo tradeoff.
 * The proxy uses app.locals.db (for domain validation) but not payments or email.
 */
export type TProxyApp = TApp<TProxyConfig, TDatabase, any, any, Auth>
