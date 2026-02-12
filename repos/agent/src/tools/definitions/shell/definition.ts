import type { TLLMToolDef } from '@tdsk/domain'

export const shellTools: TLLMToolDef[] = [
  {
    name: `shellExec`,
    description: `Execute a shell command. Returns stdout, stderr, and exit code.`,
    inputSchema: {
      type: `object`,
      properties: {
        command: { type: `string`, description: `The command to execute` },
        args: {
          type: `array`,
          description: `Optional command arguments`,
          items: { type: `string` },
        },
      },
      required: [`command`],
    },
  },
]
