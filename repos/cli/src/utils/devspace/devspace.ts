import type { TTaskActionArgs } from '@TSCL/types'
import type { TSpawn } from '@TSCL/utils/proc/spawn'

import { spawn } from '@TSCL/utils/proc/spawn'
import { start } from '@TSCL/utils/devspace/start'
import { purge } from '@TSCL/utils/devspace/purge'
import { clean } from '@TSCL/utils/devspace/clean'
import { selector } from '@TSCL/utils/devspace/selector'
import { dsdefaults } from '@TSCL/utils/devspace/dsdefaults'
import { namespace, context } from '@TSCL/utils/devspace/use'

const cmd = async (opts: Omit<TSpawn, `cmd`>) => await spawn({ cmd: `devspace`, ...opts })

const cmdOpts = (props: TTaskActionArgs) => ({
  log: props?.params?.log,
  envs: props?.params?.envs,
  output: props?.params?.log,
})

export const devspace = {
  start: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), ...start(props)],
      }),
    {
      debug: `--debug`,
      purge: `--force-purge`,
      deploy: `--force-deploy`,
    }
  ),
  render: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), `deploy`, `--render`, `--skip-build`],
      })
  ),
  deploy: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [
          ...(props?.params?.dsargs || []),
          `deploy`,
          ...(props?.params?.args || []),
        ],
      }),
    {
      build: `--force-build`,
    }
  ),
  logs: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), `logs`, ...selector(props)],
      }),
    {
      follow: `--follow`,
    }
  ),
  attach: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), `attach`, ...selector(props)],
      })
  ),
  enter: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [
          ...(props?.params?.dsargs || []),
          `enter`,
          props.params.cmd || ``,
          ...selector(props),
        ],
      })
  ),
  purge: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), ...purge(props)],
      })
  ),
  clean: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), ...clean(props)],
      })
  ),
  use: dsdefaults(async (props: TTaskActionArgs) => {
    const opts = cmdOpts(props)
    await cmd({ ...opts, args: namespace(props, true) })
    await cmd({ ...opts, args: context(props, true) })
  }),
}
