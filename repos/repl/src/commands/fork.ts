import type { TSlashCommand } from '@TRL/types'

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

    let messageId = args.trim()

    // If no messageId provided, use the last message in the conversation
    if (!messageId) {
      const messages = ctx.messages
      if (!messages.length) {
        ctx.output(`No messages in current thread. Cannot determine branch point.`)
        return
      }

      // We need to get actual message IDs from the backend
      // The ctx.messages only has display messages without IDs
      // So we require the user to provide a messageId
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
