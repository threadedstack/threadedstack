import type { FromSchema } from 'json-schema-to-ts'
import type { TToolDefGroup } from '@TAG/types'

export type TExecData = FromSchema<typeof ExecParams>
export const ExecParams = {
  type: `object`,
  properties: {
    command: {
      type: `string`,
      description: `The command to execute (e.g., "ls", "git", "npm")`,
    },
    args: {
      type: `array`,
      items: { type: `string` },
      description: `Command arguments as an array (e.g., ["status"], ["-la"])`,
    },
  },
  required: [`command`, `args`],
} as const

export const ShellTools: TToolDefGroup = {
  shellExec: {
    type: `function`,
    function: {
      name: `shellExec`,
      description: `Execute a shell command in the project directory. Use this to run commands like ls, cat, mkdir, git, npm, etc.`,
      parameters: ExecParams,
    },
  },
}
