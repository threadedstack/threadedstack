import type { TCtxCfg, TTaskActionArgs } from '@TSCL/types'

export type TPullCmd = TTaskActionArgs & {
  ctx: TCtxCfg
  env?: Record<string, string>
}

export const push = (props: TPullCmd) => {
  throw new Error(`Not implemented!`)
}
