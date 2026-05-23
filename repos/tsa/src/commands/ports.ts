import type { TSlashCommand } from '@TSA/types'

export const portsCommand: TSlashCommand = {
  name: `ports`,
  aliases: [`po`],
  description: `Manage exposed ports — /ports [list|add <port>|remove <port>|open <port>]`,
  handler: async (args, ctx) => {
    const parts = args.trim().split(/\s+/)
    const sub = parts[0] || `list`
    const portStr = parts[1]

    if (sub === `list` || sub === `ls`) {
      ctx.output(`Use ${`tsa ports list`} from the CLI to list ports.`)
      return
    }

    if (sub === `add` || sub === `expose`) {
      if (!portStr || !/^\d+$/.test(portStr)) {
        return `Usage: /ports add <port>`
      }
      ctx.output(
        `Use \`tsa ports add ${portStr}\` from the CLI to expose port ${portStr}.`
      )
      return
    }

    if (sub === `remove` || sub === `rm`) {
      if (!portStr || !/^\d+$/.test(portStr)) {
        return `Usage: /ports remove <port>`
      }
      ctx.output(
        `Use \`tsa ports remove ${portStr}\` from the CLI to remove port ${portStr}.`
      )
      return
    }

    if (sub === `open`) {
      if (!portStr || !/^\d+$/.test(portStr)) {
        return `Usage: /ports open <port>`
      }
      ctx.output(`Use \`tsa ports open ${portStr}\` from the CLI to get the port URL.`)
      return
    }

    return `Usage: /ports [list|add <port>|remove <port>|open <port>]`
  },
}
