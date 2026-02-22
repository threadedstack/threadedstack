import type { TSlashCommand } from '@TRL/types'

export const listThreadsCommand: TSlashCommand = {
  name: `threads`,
  aliases: [`t`],
  description: `List and select conversation threads`,
  handler: async (_args, ctx) => {
    try {
      const threads = await ctx.listThreads()
      if (!threads.length) {
        ctx.output(`No threads found.`)
        return
      }

      const items = threads.map((t) => ({
        id: t.id,
        label: t.name || t.id.slice(0, 8),
        description: t.createdAt ? `created ${t.createdAt}` : undefined,
      }))

      ctx.showMenu(
        `Select a thread (Ctrl+D to delete):`,
        items,
        (item) => {
          ctx.setThreadId(item.id)
          ctx.clearMessages()
          ctx.loadThreadMessages(item.id).then(() => {
            ctx.output(`Loaded thread ${item.label}`)
          })
        },
        {
          onAction: (item) => {
            ctx.showMenu(
              `Delete thread "${item.label}"?`,
              [
                { id: `yes`, label: `Yes, delete` },
                { id: `no`, label: `Cancel` },
              ],
              async (confirm) => {
                if (confirm.id === `yes`) {
                  await ctx.deleteThread(item.id)
                  ctx.output(`Deleted thread ${item.label}`)
                  // Re-trigger to refresh the list
                  await listThreadsCommand.handler(``, ctx)
                }
              }
            )
          },
        }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      ctx.output(`Error listing threads: ${msg}`)
    }
  },
}
