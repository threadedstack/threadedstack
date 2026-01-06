import type { TCtxCfg, TTaskActionArgs } from '@TSCL/types'

export type TRunCmd = TTaskActionArgs & {
  ctx: TCtxCfg
  env?: Record<string, string>
}

export const run = (props: TRunCmd) => {
  console.log(`Not implemented!`)
  process.exit(1)

  return [`run`]
}
