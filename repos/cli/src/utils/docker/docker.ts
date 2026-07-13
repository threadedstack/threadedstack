import type { TUtilArgs, TTaskActionArgs } from '@TSCL/types'
import type { TSpawn } from '@TSCL/utils/proc/spawn'

import type { TDockerRunArgs } from '@TSCL/utils/docker/run'

import { run } from '@TSCL/utils/docker/run'
import { pull } from '@TSCL/utils/docker/pull'
import { push } from '@TSCL/utils/docker/push'
import { auth } from '@TSCL/utils/docker/auth'
import { exec } from '@TSCL/utils/docker/exec'
import { spawn } from '@TSCL/utils/proc/spawn'
import { build } from '@TSCL/utils/docker/build'
import { login } from '@TSCL/utils/docker/login'

const cmd = async (opts: Omit<TSpawn, `cmd`>) => await spawn({ cmd: `docker`, ...opts })

const cmdOpts = (props: { params?: Record<string, any> }) => ({
  log: props?.params?.log,
  envs: props?.params?.envs,
  output: props?.params?.log,
})

export const docker = {
  // The password is piped through stdin (`docker login --password-stdin`),
  // never placed in argv — login(props) already strips it from the built
  // args; this is where the actual secret value is threaded to spawn.
  login: async (props: TTaskActionArgs) =>
    await cmd({ args: login(props), stdin: auth(props).password, ...cmdOpts(props) }),
  build: async (props: TUtilArgs) => await cmd({ args: build(props), ...cmdOpts(props) }),
  run: async (props: TUtilArgs<TDockerRunArgs>) =>
    await cmd({ args: run(props), ...cmdOpts(props) }),
  exec: async (props: TUtilArgs) => await cmd({ args: exec(props), ...cmdOpts(props) }),
  pull: async (props: TUtilArgs) => await cmd({ args: pull(props), ...cmdOpts(props) }),
  push: async (props: TUtilArgs) => await cmd({ args: push(props), ...cmdOpts(props) }),
}
