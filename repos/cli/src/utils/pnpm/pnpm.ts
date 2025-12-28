import type { TTaskActionArgs } from '@TSCL/types'
import type { TSpawn } from '@TSCL/utils/proc/spawn'

import { spawn } from '@TSCL/utils/proc/spawn'

export type TRunCmd = TTaskActionArgs & {
  env?:Record<string, string>
}

const cmd = async (opts:Omit<TSpawn, `cmd`>) => await spawn({cmd: `pnpm`, ...opts})

export const pnpm = {
  run: async (props:TRunCmd) => await cmd({
    envs: props?.env,
    log: props?.params?.log,
    cwd: props?.params?.cwd,
    output: props?.params?.log,
    args: [props.params?.cmd, ...(props.params?.args || [])].filter(Boolean),
  })
}
