import type { TSlashCommand } from '@TRL/types'

export const switchAgentCommand: TSlashCommand = {
  name: `agent`,
  aliases: [`a`],
  description: `Switch to a different agent`,
  handler: async (args, ctx) => {
    if (args) {
      ctx.setAgentId(args.trim())
      ctx.setThreadId(null)
      ctx.clearMessages()
      ctx.output(`Switched to agent ${args.trim()}`)
      return
    }

    const items = await ctx.listAgents()
    if (!items.length) return ctx.output(`No agents found.`)

    const prompt = ctx.projectId
      ? `Select an agent (project: ${ctx.projectId}):`
      : `Select an agent:`

    ctx.showMenu(prompt, items, (item) => {
      ctx.setAgentId(item.id)
      ctx.setThreadId(null)
      ctx.clearMessages()
      ctx.output(`Switched to agent ${item.label}`)
    })
  },
}
