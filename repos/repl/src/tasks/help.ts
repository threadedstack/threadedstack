import type { TTask, TTaskAction } from '@TRL/types'

import { themed } from '@TRL/theme'
import { Version } from '@TRL/constants/version'

const action: TTaskAction = async ({ tasks }) => {
  process.stdout.write(
    `\n${themed(`bold`, themed(`primary`, `tsa`))} ${themed(`muted`, `v${Version}`)} — ThreadedStack AI Agent REPL\n\n`
  )
  process.stdout.write(`${themed(`bold`, `Commands:`)}\n`)

  for (const task of Object.values(tasks) as TTask[])
    task.example && process.stdout.write(`  ${task.example}\n`)

  process.stdout.write(`\n`)
}

export const help: TTask = {
  action,
  name: `help`,
  example: `tsa help`,
  alias: [`--help`, `-h`],
  description: `Show available commands`,
}
