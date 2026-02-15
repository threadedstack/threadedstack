import type { TTask, TTasks } from '@TRL/types'

import { Version } from '@TRL/constants'
import { bold, cyan, dim } from '@TRL/display/colors'

export const help: TTask = {
  name: `help`,
  alias: [`--help`, `-h`],
  description: `Show available commands`,
  example: `tdsk-agent help`,
  action: async ({ tasks }) => {
    process.stdout.write(
      `\n${bold(cyan(`tdsk-agent`))} ${dim(`v${Version}`)} — ThreadedStack AI Agent REPL\n\n`
    )
    process.stdout.write(`${bold(`Commands:`)}\n`)

    for (const task of Object.values(tasks) as TTask[]) {
      if (task.example) {
        process.stdout.write(`  ${task.example}\n`)
      }
    }

    process.stdout.write(`\n`)
  },
}
