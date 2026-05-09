import type { config } from '@TSCL/configs/cli.config'
import type { TValueOf } from '@TSCL/types/helpers.types'

export type TCliCfg = typeof config
export type TCtxCfgs = TCliCfg[`contexts`]
export type TCtxCfg = TValueOf<TCtxCfgs>

export enum ECtxMap {
  ad = `admin`,
  admin = `admin`,
  be = `backend`,
  backend = `backend`,
  cd = `caddy`,
  caddy = `caddy`,
  it = `init`,
  init = `init`,
  px = `proxy`,
  proxy = `proxy`,
  sb = `sandbox`,
  sandbox = `sandbox`,
}
