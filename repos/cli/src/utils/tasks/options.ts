import type { TTaskOptions } from '@TSCL/types'
import { ETSApps } from '@TSCL/types'


export type TSharedOpts = Record<string, TTaskOptions>

export const sharedOpts:TSharedOpts = {
  shared: {
    context: {
      type: `array`,
      example: `--context proxy`,
      alias: [`ctx`, `name`, `type`],
      allowed: Object.values(ETSApps),
      description: `The context or name of the app or apps associated with the command.`,
    },
    envs: {
      type: `object`,
      alias: [`e`],
      example: `CUSTOM_ENV:custom-value,OTHER_ENV:other-value`,
      description: `Key/Value pairs of ENVs used by the command`,
    },
    log: {
      type: `boolean`,
      description: `Log sub-commands before they are executed`,
    },
  },
  devspace: {
    namespace: {
      alias: [`ns`],
      type: `string`,
      description: `Kubernetes namespace to use for command`,
    },
    kubeContext: {
      type: `string`,
      alias: [`kctx`, `kc`],
      description: `Kubernetes context to use for command`,
    },
    debug: {
      type: `boolean`,
      description: `Runs the devspace command in debug mode`,
    },
    follow: {
      type: `boolean`,
      description: `Pass the '--follow' argument to the devspace command`,
    },
    use: {
      type: `boolean`,
      description: `Call the devspace use before other tasks`,
    },
    cmd: {
      alias: [`command`],
      example: `/bin/bash`,
      default: `/bin/bash`,
      description: `Executions the passed in command`,
    },
    args: {
      type: `array`,
      example: `--debug,--skip-push`,
      alias: [`params`, `arg`, `param` ],
      description: `Extra arguments to pass on to the devspace command`,
    },
  }
}
