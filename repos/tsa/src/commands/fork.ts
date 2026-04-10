import type { TSlashCommand } from '@TSA/types'

export const forkCommand: TSlashCommand = {
  name: `fork`,
  aliases: [`br`],
  description: `Branch current thread at a message (usage: /fork [messageId])`,
  handler: async (args, ctx) => {
    const threadId = ctx.threadId
    if (!threadId) {
      ctx.output(`No active thread. Send a message first to create one.`)
      return
    }

    const messageId = args.trim()

    if (!messageId) {
      if (!ctx.messages.length) {
        ctx.output(`No messages in current thread. Cannot determine branch point.`)
        return
      }
      ctx.output(`Usage: /fork <messageId>\nProvide the ID of the message to branch at.`)
      return
    }

    try {
      const result = await ctx.branchThread(threadId, messageId)
      ctx.output(
        `Branched thread at message ${messageId}\n` +
          `New thread: ${result.name || result.id} [${result.id}]\n` +
          `Use /switch ${result.id} to switch to the new branch.`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      ctx.output(`Error branching thread: ${msg}`)
    }
  },
}
