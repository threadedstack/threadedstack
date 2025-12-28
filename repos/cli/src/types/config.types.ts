import type { config } from '@TSCL/configs/cli.config'
import type { TValueOf } from '@TSCL/types/helpers.types'

export type TCliCfg = typeof config
export type TCtxCfgs = TCliCfg[`contexts`]
export type TCtxCfg = TValueOf<TCtxCfgs>

export enum ECtxMap {
  api=`api`,
  web=`web`,
  px=`proxy`,
  proxy=`proxy`,
}
