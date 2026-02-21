import type { TSlashCommand } from '@TRL/types'

export const listThreadsCommand: TSlashCommand = {
  name: 'threads',
  aliases: ['t'],
  description: 'List conversation threads',
  handler: async (_args, ctx) => {
    try {
      const threads = await ctx.listThreads()
      if (!threads.length) {
        ctx.output('No threads found.')
        return
      }
      const lines = threads.map((t) => `  ${t.id}${t.name ? ` — ${t.name}` : ''}`)
      ctx.output(`Threads:\n${lines.join('\n')}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      ctx.output(`Error listing threads: ${msg}`)
    }
  },
}
