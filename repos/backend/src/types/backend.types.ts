import type { TDatabase } from '@tdsk/database'
import type { config } from '@TBE/configs/backend.config'
import type { EmailService } from '@TBE/services/email/email'
import type { TApp as TEApp, TRequest as TReq } from '@tdsk/domain'
import type { PaymentsService } from '@TBE/services/payments/payments'

export type { TResponse } from '@tdsk/domain'

export type TBEConfig = typeof config
export type TReqParams = Record<string, any>
export type TApp = TEApp<TBEConfig, TDatabase, PaymentsService, EmailService>

export type TRequest<
  ReqParams extends TReqParams = TReqParams,
  ReqBody = any,
  ResBody = any,
> = TReq<TApp, ReqParams, ResBody, ReqBody>
