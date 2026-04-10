import type { TTask, TTaskAction } from '@TSA/types'

import { themed } from '@TSA/theme'
import { Version } from '@TSA/constants/version'

const action: TTaskAction = async ({ tasks }) => {
  process.stdout.write(
    `\n${themed(`bold`, themed(`primary`, `tsa`))} ${themed(`muted`, `v${Version}`)} — Threaded Stack Agent (TSA)\n\n`
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
