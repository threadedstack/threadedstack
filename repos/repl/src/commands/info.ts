import type { TSlashCommand } from '@TRL/types'

export const infoCommand: TSlashCommand = {
  name: 'info',
  aliases: ['i'],
  description: 'Show current session info',
  handler: async (_args, ctx) => {
    const lines = [
      `Organization: ${ctx.orgId || `none`}`,
      `Agent: ${ctx.agentId || `none`}`,
      `Thread: ${ctx.threadId || `none`}`,
      `Connection: ${ctx.connection}`,
      `Context files: ${ctx.contextFiles.length}`,
      `Messages: ${ctx.messages.length}`,
      `Verbose: ${ctx.verbose}`,
    ]
    ctx.output(lines.join(`\n`))
  },
}
