import type { TStreamEvent } from '@tdsk/domain'
import type { TToolCallAccumulator } from '@TRL/types'

import { bold, cyan, dim, gray, green, red, yellow } from './colors'

const SpinnerFrames = [`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`]

export class Renderer {
  #toolCalls = new Map<string, TToolCallAccumulator>()
  #textBuffer = ``

  renderEvent(event: TStreamEvent): void {
    switch (event.type) {
      case `text`:
        this.#renderText(event.text)
        break
      case `tool_call_start`:
        this.#renderToolCallStart(event.id, event.name)
        break
      case `tool_call_args`:
        this.#renderToolCallArgs(event.id, event.args)
        break
      case `tool_result`:
        this.#renderToolResult(event.toolUseId, event.content, event.isError)
        break
      case `error`:
        this.#renderError(event.error)
        break
      case `done`:
        this.#renderDone()
        break
    }
  }

  #renderText(text: string): void {
    this.#textBuffer += text
    process.stdout.write(text)
  }

  #renderToolCallStart(id: string, name: string): void {
    if (this.#textBuffer) {
      process.stdout.write(`\n`)
      this.#textBuffer = ``
    }

    this.#toolCalls.set(id, { id, name, args: `` })
    process.stdout.write(`\n${dim(`┌`)} ${cyan(bold(name))} ${dim(`...`)}\n`)
  }

  #renderToolCallArgs(id: string, args: string): void {
    const tc = this.#toolCalls.get(id)
    if (tc) tc.args += args
  }

  #renderToolResult(toolUseId: string, content: string, isError?: boolean): void {
    const tc = this.#toolCalls.get(toolUseId)
    if (tc) {
      tc.result = content
      tc.isError = isError
    }

    if (tc?.args) {
      try {
        const parsed = JSON.parse(tc.args)
        const summary = Object.entries(parsed)
          .map(([k, v]) => {
            const val = typeof v === `string` ? v : JSON.stringify(v)
            const truncated = val.length > 80 ? `${val.slice(0, 77)}...` : val
            return `${dim(`│`)} ${gray(k)}: ${truncated}`
          })
          .join(`\n`)
        if (summary) process.stdout.write(`${summary}\n`)
      } catch {
        if (tc.args.length > 0) {
          const truncated = tc.args.length > 200 ? `${tc.args.slice(0, 197)}...` : tc.args
          process.stdout.write(`${dim(`│`)} ${gray(truncated)}\n`)
        }
      }
    }

    const color = isError ? red : green
    const prefix = isError ? `✗` : `✓`
    const truncated = content.length > 500 ? `${content.slice(0, 497)}...` : content

    const lines = truncated.split(`\n`)
    if (lines.length === 1) {
      process.stdout.write(`${dim(`└`)} ${color(prefix)} ${lines[0]}\n`)
    } else {
      process.stdout.write(`${dim(`├`)} ${color(prefix)}\n`)
      for (const line of lines) {
        process.stdout.write(`${dim(`│`)} ${line}\n`)
      }
      process.stdout.write(`${dim(`└`)}\n`)
    }
  }

  #renderError(error: string): void {
    if (this.#textBuffer) {
      process.stdout.write(`\n`)
      this.#textBuffer = ``
    }
    process.stdout.write(`\n${red(bold(`Error:`))} ${error}\n`)
  }

  #renderDone(): void {
    if (this.#textBuffer) {
      process.stdout.write(`\n`)
    }
    this.#textBuffer = ``
  }

  renderWelcome(agentName: string, threadId?: string): void {
    process.stdout.write(`\n${bold(cyan(`tdsk-agent`))} ${dim(`·`)} ${agentName}\n`)
    if (threadId) {
      process.stdout.write(`${dim(`Thread:`)} ${threadId}\n`)
    }
    process.stdout.write(
      `${dim(`Type your message and press Enter. Commands: /help`)}\n\n`
    )
  }

  renderInfo(message: string): void {
    process.stdout.write(`${dim(message)}\n`)
  }

  renderSuccess(message: string): void {
    process.stdout.write(`${green(message)}\n`)
  }

  renderWarning(message: string): void {
    process.stdout.write(`${yellow(message)}\n`)
  }

  spinner(message: string): { stop: () => void } {
    let frame = 0
    const interval = setInterval(() => {
      const spinner = SpinnerFrames[frame % SpinnerFrames.length]
      process.stdout.write(`\r${cyan(spinner)} ${dim(message)}`)
      frame++
    }, 80)

    return {
      stop: () => {
        clearInterval(interval)
        process.stdout.write(`\r${` `.repeat(message.length + 4)}\r`)
      },
    }
  }

  clear(): void {
    this.#toolCalls.clear()
    this.#textBuffer = ``
  }
}
