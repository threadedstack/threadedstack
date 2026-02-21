import type { TSlashCommand } from '@TRL/types'

export const contextCommand: TSlashCommand = {
  name: `context`,
  aliases: [`ctx`],
  description: `List loaded context files`,
  handler: async (_args, ctx) => {
    if (!ctx.contextFiles.length) {
      ctx.output(`No context files loaded.`)
      return
    }

    const lines = ctx.contextFiles.map(
      (f, i) => `  ${i + 1}. ${f.name} (${f.path}, ${f.sizeBytes} bytes)`
    )
    ctx.output(`Context files:\n${lines.join('\n')}`)
  },
}
