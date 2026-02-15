import { AuthManager } from '@TRL/auth'
import { ApiClient } from '@TRL/api'
import { LocalAgentExecutor } from '@TRL/executor'
import { Renderer } from '@TRL/display'
import { AgentRepl } from '@TRL/repl'
import { bold, cyan, dim, red } from '@TRL/display/colors'

export const Version = `0.1.0`

export type TParsedArgs = {
  command: string
  positional: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): TParsedArgs {
  const args = argv.slice(2)
  const command = args[0] || ``
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith(`--`)) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith(`--`)) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }

  return { command, positional, flags }
}

export function printUsage(): void {
  process.stdout.write(
    `\n${bold(cyan(`tdsk-agent`))} ${dim(`v${Version}`)} — ThreadedStack AI Agent REPL\n\n`
  )
  process.stdout.write(`${bold(`Usage:`)}\n`)
  process.stdout.write(`  tdsk-agent login <api-key> [--url <proxy-url>] [--insecure]\n`)
  process.stdout.write(`  tdsk-agent logout\n`)
  process.stdout.write(`  tdsk-agent chat [--org <id>] [--agent <id>] [--thread <id>]\n`)
  process.stdout.write(`  tdsk-agent agents [--org <id>]\n`)
  process.stdout.write(`  tdsk-agent threads <agent-id> [--org <id>]\n`)
  process.stdout.write(`  tdsk-agent status\n`)
  process.stdout.write(`  tdsk-agent help\n`)
  process.stdout.write(`\n`)
}

export async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv)
  const auth = new AuthManager()
  const renderer = new Renderer()

  // Apply insecure mode from stored credentials (for all post-login commands)
  const storedCreds = auth.getCredentials()
  if (storedCreds?.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

  switch (command) {
    case `login`: {
      const apiKey = positional[0]
      if (!apiKey) {
        renderer.renderWarning(
          `Usage: tdsk-agent login <api-key> [--url <proxy-url>] [--insecure]`
        )
        process.exit(1)
      }

      const spinner = renderer.spinner(`Validating API key...`)
      try {
        await auth.login(apiKey, flags.url as string | undefined, flags.insecure === true)
        spinner.stop()
        renderer.renderSuccess(`Logged in successfully`)
      } catch (err) {
        spinner.stop()
        const msg = err instanceof Error ? err.message : `Login failed`
        process.stdout.write(`${red(bold(`Error:`))} ${msg}\n`)
        process.exit(1)
      }
      break
    }

    case `logout`: {
      auth.logout()
      renderer.renderSuccess(`Logged out`)
      break
    }

    case `status`: {
      const creds = auth.getCredentials()
      if (creds) {
        process.stdout.write(`\n${bold(`Status:`)} ${cyan(`logged in`)}\n`)
        process.stdout.write(`  ${dim(`Proxy:`)} ${creds.proxyUrl}\n`)
        process.stdout.write(
          `  ${dim(`Key:`)}   ${creds.apiKey.slice(0, 8)}${'*'.repeat(8)}\n\n`
        )
      } else {
        process.stdout.write(`\n${bold(`Status:`)} ${dim(`not logged in`)}\n\n`)
      }
      break
    }

    case `agents`: {
      if (!auth.isLoggedIn()) {
        process.stdout.write(
          `${red(`Not logged in.`)} Run ${cyan(`tdsk-agent login <api-key>`)} first.\n`
        )
        process.exit(1)
      }

      const client = new ApiClient(auth)

      try {
        let orgId = flags.org as string | undefined
        if (!orgId) {
          const orgs = (await client.listOrgs()) as { id: string; name: string }[]
          if (orgs.length === 1) {
            orgId = orgs[0].id
          } else {
            process.stdout.write(`\n${bold(`Organizations:`)}\n`)
            for (const org of orgs) {
              process.stdout.write(`  ${dim(org.id)} ${org.name}\n`)
            }
            process.stdout.write(
              `\n${dim(`Use --org <id> to list agents for a specific org`)}\n\n`
            )
            return
          }
        }

        const agents = (await client.listAgents(orgId)) as {
          id: string
          name: string
          model?: string
        }[]

        if (!agents.length) {
          renderer.renderInfo(`No agents found`)
          return
        }

        process.stdout.write(`\n${bold(`Agents:`)}\n`)
        for (const agent of agents) {
          const model = agent.model ? dim(` (${agent.model})`) : ``
          process.stdout.write(`  ${dim(agent.id)} ${agent.name}${model}\n`)
        }
        process.stdout.write(`\n`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to list agents`
        process.stdout.write(`${red(bold(`Error:`))} ${msg}\n`)
        process.exit(1)
      }
      break
    }

    case `threads`: {
      if (!auth.isLoggedIn()) {
        process.stdout.write(
          `${red(`Not logged in.`)} Run ${cyan(`tdsk-agent login <api-key>`)} first.\n`
        )
        process.exit(1)
      }

      const agentId = positional[0]
      if (!agentId) {
        renderer.renderWarning(`Usage: tdsk-agent threads <agent-id> [--org <id>]`)
        process.exit(1)
      }

      const client = new ApiClient(auth)

      try {
        let orgId = flags.org as string | undefined
        if (!orgId) {
          const orgs = (await client.listOrgs()) as { id: string }[]
          if (orgs.length === 1) {
            orgId = orgs[0].id
          } else {
            renderer.renderWarning(`Multiple orgs found. Use --org <id> to specify.`)
            process.exit(1)
          }
        }

        const threads = (await client.listThreads(orgId, agentId)) as {
          id: string
          name?: string
          createdAt?: string
        }[]

        if (!threads.length) {
          renderer.renderInfo(`No threads found`)
          return
        }

        process.stdout.write(`\n${bold(`Threads:`)}\n`)
        for (const t of threads) {
          const name = t.name || dim(`untitled`)
          process.stdout.write(`  ${dim(t.id)} ${name}\n`)
        }
        process.stdout.write(`\n`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to list threads`
        process.stdout.write(`${red(bold(`Error:`))} ${msg}\n`)
        process.exit(1)
      }
      break
    }

    case `help`:
    case `--help`:
    case `-h`: {
      printUsage()
      break
    }

    case `--version`:
    case `-v`: {
      process.stdout.write(`tdsk-agent v${Version}\n`)
      break
    }
    case `chat`:
    case ``: {
      if (!auth.isLoggedIn()) {
        process.stdout.write(
          `${red(`Not logged in.`)} Run ${cyan(`tdsk-agent login <api-key>`)} first.\n`
        )
        process.exit(1)
      }

      const client = new ApiClient(auth)
      const executor = new LocalAgentExecutor(client)
      const repl = new AgentRepl(executor, renderer)

      await repl.start({
        orgId: flags.org as string | undefined,
        agentId: flags.agent as string | undefined,
        threadId: flags.thread as string | undefined,
      })
      break
    }

    default: {
      process.stdout.write(`${red(`Unknown command:`)} ${command}\n`)
      printUsage()
      process.exit(1)
    }
  }
}
