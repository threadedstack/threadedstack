import type { BashOptions } from 'just-bash'

export const DefBashOpts: BashOptions = {
  files: {},
  env: {},
  cwd: `/home`,
  executionLimits: {},
  network: {
    dangerouslyAllowFullInternetAccess: true,
  },
}
