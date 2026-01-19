import type { TDatabase } from '@tdsk/database'
import type { TApp as TEApp } from '@tdsk/domain'
import type { TRequest as TReq } from '@tdsk/domain'
import type { config } from '@TBE/configs/backend.config'
import type { PolarService } from '@TBE/services/payments/polar'

export type { TResponse } from '@tdsk/domain'

export type TBEConfig = typeof config
export type TReqParams = Record<string, any>
export type TApp = TEApp<TBEConfig, TDatabase, PolarService>

export type TRequest<ReqParams extends TReqParams = TReqParams> = TReq<TApp, ReqParams>
