import { createInterface } from 'node:readline'
import type { LocalAgentExecutor } from '@TRL/executor'
import type { Renderer } from '@TRL/display'
import { bold, cyan, dim, gray } from '@TRL/display/colors'

type TAgentContext = {
  orgId: string
  orgName: string
  agentId: string
  agentName: string
  threadId: string | null
  userId: string
}

export class AgentRepl {
  #executor: LocalAgentExecutor
  #renderer: Renderer
  #ctx: TAgentContext | null = null

  constructor(executor: LocalAgentExecutor, renderer: Renderer) {
    this.#executor = executor
    this.#renderer = renderer
  }

  async start(opts?: {
    orgId?: string
    agentId?: string
    threadId?: string
  }): Promise<void> {
    const client = this.#executor.client

    const orgId = opts?.orgId || (await this.#selectOrg())
    if (!orgId) return

    const org = (await client.getOrg(orgId)) as { id: string; name: string }

    const agentId = opts?.agentId || (await this.#selectAgent(orgId))
    if (!agentId) return

    const agent = (await client.getAgent(orgId, agentId)) as {
      id: string
      name: string
    }

    this.#ctx = {
      orgId,
      orgName: org.name || orgId,
      agentId,
      agentName: agent.name || agentId,
      threadId: opts?.threadId || null,
      userId: `repl-user`,
    }

    this.#renderer.renderWelcome(this.#ctx.agentName, this.#ctx.threadId || undefined)

    if (this.#ctx.threadId) {
      await this.#showHistory()
    }

    await this.#loop()
  }

  async #loop(): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${cyan(`>`)} `,
    })

    rl.prompt()

    for await (const line of rl) {
      const input = line.trim()
      if (!input) {
        rl.prompt()
        continue
      }

      if (input.startsWith(`/`)) {
        const shouldContinue = await this.#handleCommand(input, rl)
        if (!shouldContinue) break
        rl.prompt()
        continue
      }

      await this.#sendMessage(input)
      rl.prompt()
    }

    rl.close()
  }

  async #sendMessage(prompt: string): Promise<void> {
    if (!this.#ctx) return

    this.#renderer.clear()
    process.stdout.write(`\n`)

    try {
      const result = await this.#executor.run({
        orgId: this.#ctx.orgId,
        agentId: this.#ctx.agentId,
        prompt,
        userId: this.#ctx.userId,
        threadId: this.#ctx.threadId || undefined,
        onEvent: (event) => this.#renderer.renderEvent(event),
      })

      if (result.threadId && !this.#ctx.threadId) {
        this.#ctx.threadId = result.threadId
      }

      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Request failed`
      this.#renderer.renderEvent({ type: `error`, error: msg })
    }
  }

  async #handleCommand(
    input: string,
    rl: ReturnType<typeof createInterface>
  ): Promise<boolean> {
    const [cmd, ...args] = input.split(/\s+/)

    switch (cmd) {
      case `/exit`:
      case `/quit`:
      case `/q`:
        this.#renderer.renderInfo(`Goodbye!`)
        return false

      case `/help`:
      case `/h`:
        this.#printHelp()
        return true

      case `/new`:
        if (this.#ctx) {
          this.#ctx.threadId = null
          this.#renderer.renderSuccess(`Started new thread`)
        }
        return true

      case `/threads`:
        await this.#listThreads()
        return true

      case `/switch`:
        if (args[0] && this.#ctx) {
          this.#ctx.threadId = args[0]
          this.#renderer.renderSuccess(`Switched to thread ${args[0]}`)
          await this.#showHistory()
        } else {
          this.#renderer.renderWarning(`Usage: /switch <thread-id>`)
        }
        return true

      case `/history`:
        await this.#showHistory()
        return true

      case `/agent`:
        await this.#switchAgent()
        return true

      case `/info`:
        this.#printInfo()
        return true

      default:
        this.#renderer.renderWarning(`Unknown command: ${cmd}. Type /help for commands.`)
        return true
    }
  }

  #printHelp(): void {
    const cmds = [
      [`/help, /h`, `Show this help`],
      [`/new`, `Start a new thread`],
      [`/threads`, `List conversation threads`],
      [`/switch <id>`, `Switch to a different thread`],
      [`/history`, `Show messages in current thread`],
      [`/agent`, `Switch to a different agent`],
      [`/info`, `Show current session info`],
      [`/exit, /quit, /q`, `Exit the REPL`],
    ]

    process.stdout.write(`\n${bold(`Commands:`)}\n`)
    for (const [cmd, desc] of cmds) {
      process.stdout.write(`  ${cyan(cmd.padEnd(20))} ${dim(desc)}\n`)
    }
    process.stdout.write(`\n`)
  }

  #printInfo(): void {
    if (!this.#ctx) return
    process.stdout.write(`\n${bold(`Session Info:`)}\n`)
    process.stdout.write(
      `  ${gray(`Org:`)}    ${this.#ctx.orgName} ${dim(`(${this.#ctx.orgId})`)}\n`
    )
    process.stdout.write(
      `  ${gray(`Agent:`)}  ${this.#ctx.agentName} ${dim(`(${this.#ctx.agentId})`)}\n`
    )
    process.stdout.write(
      `  ${gray(`Thread:`)} ${this.#ctx.threadId || dim(`(new — will be created on first message)`)}\n`
    )
    process.stdout.write(`\n`)
  }

  async #listThreads(): Promise<void> {
    if (!this.#ctx) return

    try {
      const threads = (await this.#executor.client.listThreads(
        this.#ctx.orgId,
        this.#ctx.agentId
      )) as { id: string; name?: string; createdAt?: string }[]

      if (!threads.length) {
        this.#renderer.renderInfo(`No threads found`)
        return
      }

      process.stdout.write(`\n${bold(`Threads:`)}\n`)
      for (const t of threads) {
        const active = t.id === this.#ctx.threadId ? cyan(` ◀`) : ``
        const name = t.name || dim(`untitled`)
        process.stdout.write(`  ${dim(t.id.slice(0, 8))} ${name}${active}\n`)
      }
      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list threads`
      this.#renderer.renderWarning(msg)
    }
  }

  async #showHistory(): Promise<void> {
    if (!this.#ctx?.threadId) {
      this.#renderer.renderInfo(`No active thread`)
      return
    }

    try {
      const messages = (await this.#executor.client.listMessages(
        this.#ctx.orgId,
        this.#ctx.agentId,
        this.#ctx.threadId
      )) as { role: string; content: unknown[] }[]

      if (!messages.length) {
        this.#renderer.renderInfo(`No messages in thread`)
        return
      }

      process.stdout.write(`\n${dim(`─── History ───`)}\n\n`)
      for (const msg of messages) {
        const role = msg.role === `user` ? cyan(bold(`You`)) : bold(`Agent`)
        const textParts = (msg.content as { type: string; text?: string }[])
          .filter((c) => c.type === `text` && c.text)
          .map((c) => c.text)
          .join(``)

        if (textParts) {
          process.stdout.write(`${role}: ${textParts}\n\n`)
        }
      }
      process.stdout.write(`${dim(`─── End ───`)}\n\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to load history`
      this.#renderer.renderWarning(msg)
    }
  }

  async #switchAgent(): Promise<void> {
    if (!this.#ctx) return

    const agentId = await this.#selectAgent(this.#ctx.orgId)
    if (!agentId) return

    const agent = (await this.#executor.client.getAgent(this.#ctx.orgId, agentId)) as {
      id: string
      name: string
    }

    this.#ctx.agentId = agentId
    this.#ctx.agentName = agent.name || agentId
    this.#ctx.threadId = null

    this.#renderer.renderSuccess(`Switched to agent: ${this.#ctx.agentName}`)
  }

  async #selectOrg(): Promise<string | null> {
    try {
      const orgs = (await this.#executor.client.listOrgs()) as {
        id: string
        name: string
      }[]

      if (!orgs.length) {
        this.#renderer.renderWarning(`No organizations found`)
        return null
      }

      if (orgs.length === 1) return orgs[0].id

      process.stdout.write(`\n${bold(`Select organization:`)}\n`)
      for (let i = 0; i < orgs.length; i++) {
        process.stdout.write(`  ${cyan(`${i + 1}`)} ${orgs[i].name}\n`)
      }

      const choice = await this.#prompt(`Choice (1-${orgs.length}): `)
      const idx = Number.parseInt(choice, 10) - 1

      if (idx >= 0 && idx < orgs.length) return orgs[idx].id

      this.#renderer.renderWarning(`Invalid choice`)
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list orgs`
      this.#renderer.renderWarning(msg)
      return null
    }
  }

  async #selectAgent(orgId: string): Promise<string | null> {
    try {
      const agents = (await this.#executor.client.listAgents(orgId)) as {
        id: string
        name: string
        model?: string
      }[]

      if (!agents.length) {
        this.#renderer.renderWarning(`No agents found in this organization`)
        return null
      }

      if (agents.length === 1) return agents[0].id

      process.stdout.write(`\n${bold(`Select agent:`)}\n`)
      for (let i = 0; i < agents.length; i++) {
        const model = agents[i].model ? dim(` (${agents[i].model})`) : ``
        process.stdout.write(`  ${cyan(`${i + 1}`)} ${agents[i].name}${model}\n`)
      }

      const choice = await this.#prompt(`Choice (1-${agents.length}): `)
      const idx = Number.parseInt(choice, 10) - 1

      if (idx >= 0 && idx < agents.length) return agents[idx].id

      this.#renderer.renderWarning(`Invalid choice`)
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list agents`
      this.#renderer.renderWarning(msg)
      return null
    }
  }

  #prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }
}
