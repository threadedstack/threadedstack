import type { TTaskActionArgs } from '@TSCL/types'
import type { TSpawn } from '@TSCL/utils/proc/spawn'
import type { TRunCmd } from '@TSCL/utils/docker/run'
import type { TPullCmd } from '@TSCL/utils/docker/pull'
import type { TPushCmd } from '@TSCL/utils/docker/push'
import type { TExecCmd } from '@TSCL/utils/docker/exec'
import type { TBuildCmd } from '@TSCL/utils/docker/build'

import { run } from '@TSCL/utils/docker/run'
import { pull } from '@TSCL/utils/docker/pull'
import { push } from '@TSCL/utils/docker/push'
import { exec } from '@TSCL/utils/docker/exec'
import { spawn } from '@TSCL/utils/proc/spawn'
import { build } from '@TSCL/utils/docker/build'
import { login } from '@TSCL/utils/docker/login'

const cmd = async (opts: Omit<TSpawn, `cmd`>) => await spawn({ cmd: `docker`, ...opts })

export const docker = {
  login: async (props: TTaskActionArgs) =>
    await cmd({
      args: login(props),
      log: props?.params?.log,
      output: props?.params?.log,
    }),
  build: async (props: TBuildCmd) =>
    await cmd({
      args: build(props),
      log: props?.params?.log,
      envs: props?.params?.envs,
      output: props?.params?.log,
    }),
  run: async (props: TRunCmd) =>
    await cmd({
      args: run(props),
      log: props?.params?.log,
      envs: props?.params?.envs,
      output: props?.params?.log,
    }),
  exec: async (props: TExecCmd) =>
    await cmd({
      args: exec(props),
      log: props?.params?.log,
      envs: props?.params?.envs,
      output: props?.params?.log,
    }),
  pull: async (props: TPullCmd) =>
    await cmd({
      args: pull(props),
      log: props?.params?.log,
      envs: props?.params?.envs,
      output: props?.params?.log,
    }),
  push: async (props: TPushCmd) =>
    await cmd({
      args: push(props),
      log: props?.params?.log,
      envs: props?.params?.envs,
      output: props?.params?.log,
    }),
}
