import type { TSlashCommand } from '@TSA/types'

export const historyCommand: TSlashCommand = {
  name: `history`,
  aliases: [`hist`],
  description: `Show conversation history`,
  handler: async (_args, ctx) => {
    if (!ctx.messages.length) {
      ctx.output(`No messages in this session.`)
      return
    }
    const lines = ctx.messages.map((m) => {
      const prefix = m.type === `user` ? `> ` : m.type === `assistant` ? `  ` : `# `
      const content = m.content.length > 120 ? `${m.content.slice(0, 120)}...` : m.content
      return `${prefix}${content}`
    })
    ctx.output(lines.join(`\n`))
  },
}
