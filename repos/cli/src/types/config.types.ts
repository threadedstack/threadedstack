import type { config } from '@TSCL/configs/cli.config'
import type { TValueOf } from '@TSCL/types/helpers.types'

export type TCliCfg = typeof config
export type TCtxCfgs = TCliCfg[`contexts`]
export type TCtxCfg = TValueOf<TCtxCfgs>

export enum ECtxMap {
  backend = `backend`,
  be = `backend`,
  cd = `caddy`,
  caddy = `caddy`,
  admin = `admin`,
  ad = `admin`,
  px = `proxy`,
  proxy = `proxy`,
}
