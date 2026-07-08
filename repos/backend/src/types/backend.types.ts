import type { TDatabase } from '@tdsk/database'
import type { KubeClient } from '@tdsk/sandbox'
import type { config } from '@TBE/configs/backend.config'
import type { EmailService } from '@TBE/services/email/email'
import type { SandboxService } from '@TBE/services/sandboxes/sandbox'
import type { PaymentsService } from '@TBE/services/payments/payments'
import type { S3Service } from '@TBE/services/s3/s3'
import type { TScheduleExecutor } from '@TBE/services/scheduler'
import type { TResidentWatchdog } from '@TBE/services/resident/watchdog'
import type { EmbeddingService } from '@TBE/services/embeddings/embedding'
import type {
  TApp as TEApp,
  TAppLocals,
  TRequest as TReq,
  TAuthHeaderObj,
} from '@tdsk/domain'

export type { TResponse } from '@tdsk/domain'

export type TBEConfig = typeof config
export type TReqParams = Record<string, any>

type TBELocals = TAppLocals<
  TBEConfig,
  TDatabase,
  PaymentsService,
  EmailService,
  TAuthHeaderObj,
  KubeClient,
  SandboxService
> & {
  s3: S3Service
  embeddings: EmbeddingService
  scheduleExecutor?: TScheduleExecutor
  residentWatchdog?: TResidentWatchdog
}

export type TApp = TEApp<
  TBEConfig,
  TDatabase,
  PaymentsService,
  EmailService,
  TAuthHeaderObj,
  KubeClient,
  SandboxService,
  TBELocals
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
