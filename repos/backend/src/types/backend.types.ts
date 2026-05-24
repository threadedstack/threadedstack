import type { TDatabase } from '@tdsk/database'
import type { KubeClient } from '@tdsk/sandbox'
import type { config } from '@TBE/configs/backend.config'
import type { EmailService } from '@TBE/services/email/email'
import type { SandboxService } from '@TBE/services/sandboxes/sandbox'
import type { PaymentsService } from '@TBE/services/payments/payments'
import type { TApp as TEApp, TRequest as TReq, TAuthHeaderObj } from '@tdsk/domain'

export type { TResponse } from '@tdsk/domain'

export type TBEConfig = typeof config
export type TReqParams = Record<string, any>
export type TApp = TEApp<
  TBEConfig,
  TDatabase,
  PaymentsService,
  EmailService,
  TAuthHeaderObj,
  KubeClient,
  SandboxService
>

export type TQuotaResource =
  | `projects`
  | `compute`
  | `threads`
  | `messages`
  | `endpoints`
  | `secrets`
export type TQuotaIncremented = {
  orgId: string
  period: string
  resource: TQuotaResource
}

export type TRequest<
  ReqParams extends TReqParams = any,
  ReqBody = any,
  ResBody = any,
> = TReq<TApp, ReqParams, ResBody, ReqBody> & {
  quotaIncremented?: TQuotaIncremented
}
