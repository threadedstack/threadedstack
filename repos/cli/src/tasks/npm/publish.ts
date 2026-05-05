import type { TTask, TTaskAction } from '@TSCL/types'

import path from 'node:path'
import { exec } from '@TSCL/utils/proc/exec'

const publishTsa: TTaskAction = async (args) => {
  const { config, params } = args
  const tsaDir = path.join(config.paths.repos, `tsa`)

  if (!params?.skipTests) {
    console.log(`Running type checks...`)
    exec({ cmd: `pnpm types`, cwd: tsaDir })

    console.log(`\nRunning tests...`)
    exec({ cmd: `pnpm test`, cwd: tsaDir })
  }

  if (params?.dryRun) {
    console.log(`\nCross-compiling for all platforms...`)
    exec({ cmd: `bun run build:publish`, cwd: tsaDir })

    console.log(`\nPackage contents:`)
    exec({ cmd: `npm pack --dry-run`, cwd: tsaDir })

    console.log(`\nDry run complete — skipping publish.`)
    return
  }

  const version = params?.version
  if (!version) {
    console.error(`--version is required for publishing (e.g. --version 0.2.0)`)
    process.exit(1)
  }

  console.log(`\nPublishing via TSA publish script...`)
  exec({ cmd: `bun run scripts/publish.ts --version ${version}`, cwd: tsaDir })

  console.log(`\nPublishing @tdsk/tsa...`)
  exec({ cmd: `npm publish --access public`, cwd: tsaDir })

  console.log(`\nPublished @tdsk/tsa v${version} successfully!`)
}

export const publish: TTask = {
  name: `publish`,
  alias: [`pub`],
  action: publishTsa,
  example: `tdsk npm publish --version 0.2.0`,
  description: `Build and publish @tdsk/tsa to npm`,
  options: {
    version: {
      alias: [`ver`, `v`],
      description: `Version to publish (required)`,
    },
    dryRun: {
      type: `boolean`,
      default: false,
      alias: [`dry`],
      description: `Build and pack without publishing`,
    },
    skipTests: {
      type: `boolean`,
      default: false,
      alias: [`notest`],
      description: `Skip test and type-check steps`,
    },
  },
}
