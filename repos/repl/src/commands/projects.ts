import type { TSlashCommand } from '@TRL/types'

export const projectsCommand: TSlashCommand = {
  name: `projects`,
  aliases: [`proj`],
  description: `Switch project`,
  handler: async (_args, ctx) => {
    const items = await ctx.listProjects()
    if (!items.length) return ctx.output(`No projects found.`)

    ctx.showMenu(`Select a project:`, items, (item) => {
      ctx.setProjectId(item.id)
      ctx.output(`Switched to project ${item.label}`)
    })
  },
}
