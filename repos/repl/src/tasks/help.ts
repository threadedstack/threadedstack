import type { TTask, TTasks } from '@TRL/types'

import { Version } from '@TRL/constants'
import { themed } from '@TRL/theme'

export const help: TTask = {
  name: `help`,
  alias: [`--help`, `-h`],
  description: `Show available commands`,
  example: `tdsk-agent help`,
  action: async ({ tasks }) => {
    process.stdout.write(
      `\n${themed('bold', themed('primary', `tdsk-agent`))} ${themed('muted', `v${Version}`)} — ThreadedStack AI Agent REPL\n\n`
    )
    process.stdout.write(`${themed('bold', `Commands:`)}\n`)

    for (const task of Object.values(tasks) as TTask[]) {
      if (task.example) {
        process.stdout.write(`  ${task.example}\n`)
      }
    }

    process.stdout.write(`\n`)
  },
}
