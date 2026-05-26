import type { Component, MarkdownTheme } from '@earendil-works/pi-tui'
import type { TDisplayMessage } from '@TSA/renderers/chatLogic'
import type { TToolCall } from '@TSA/types'

import chalk from 'chalk'
import { Markdown } from '@earendil-works/pi-tui'
import { themed } from '@TSA/theme'
import { wrapTextWithAnsi } from '@earendil-works/pi-tui'

/**
 * Default markdown theme for assistant messages.
 */
const mdTheme: MarkdownTheme = {
  heading: (t) => chalk.bold.cyan(t),
  link: (t) => chalk.cyan.underline(t),
  linkUrl: (t) => chalk.dim(t),
  code: (t) => chalk.yellow(t),
  codeBlock: (t) => chalk.white(t),
  codeBlockBorder: (t) => chalk.dim(t),
  quote: (t) => chalk.italic.gray(t),
  quoteBorder: (t) => chalk.dim(t),
  hr: (t) => chalk.dim(t),
  listBullet: (t) => chalk.cyan(t),
  bold: (t) => chalk.bold(t),
  italic: (t) => chalk.italic(t),
  strikethrough: (t) => chalk.strikethrough(t),
  underline: (t) => chalk.underline(t),
}

/**
 * PiTuiChat — renders the chat message history, streaming text,
 * and tool activity indicators.
 */
export class PiTuiChat implements Component {
  #messages: TDisplayMessage[] = []
  #streamText = ``
  #toolCalls: TToolCall[] = []
  #welcomeName = ``
  #welcomeDescription = ``
  #welcomeContextCount = 0
  #showWelcome = false
  #cachedWidth: number | null = null
  #cachedLines: string[] | null = null
  #dirty = true

  setMessages(messages: TDisplayMessage[]): void {
    this.#messages = messages
    this.#dirty = true
  }

  setStreaming(text: string, toolCalls: TToolCall[]): void {
    this.#streamText = text
    this.#toolCalls = toolCalls
    this.#dirty = true
  }

  setWelcome(name: string, description: string, contextCount: number): void {
    this.#welcomeName = name
    this.#welcomeDescription = description
    this.#welcomeContextCount = contextCount
    this.#showWelcome = true
    this.#dirty = true
  }

  invalidate(): void {
    this.#dirty = true
    this.#cachedLines = null
    this.#cachedWidth = null
  }

  render(width: number): string[] {
    if (!this.#dirty && this.#cachedWidth === width && this.#cachedLines) {
      return this.#cachedLines
    }

    const lines: string[] = []
    const contentWidth = Math.max(width - 2, 20)

    // Welcome box
    if (this.#showWelcome) {
      lines.push(...this.#renderWelcome(contentWidth))
      lines.push(``)
    }

    // Message history
    for (const msg of this.#messages) {
      lines.push(...this.#renderMessage(msg, contentWidth))
    }

    // Streaming text
    if (this.#streamText) {
      lines.push(...this.#renderStreamingText(contentWidth))
    }

    // Tool call indicators
    if (this.#toolCalls.length > 0) {
      lines.push(...this.#renderToolCalls())
    }

    this.#cachedWidth = width
    this.#cachedLines = lines
    this.#dirty = false

    return lines
  }

  // ----------------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------------

  #renderWelcome(width: number): string[] {
    const lines: string[] = []
    const border = themed(`border`, `\u2500`.repeat(width))

    lines.push(border)
    lines.push(` ${themed(`bold`, this.#welcomeName)}`)

    if (this.#welcomeDescription) {
      const wrapped = wrapTextWithAnsi(this.#welcomeDescription, width - 2)
      for (const line of wrapped) {
        lines.push(` ${themed(`muted`, line)}`)
      }
    }

    if (this.#welcomeContextCount > 0) {
      lines.push(
        ` ${themed(`muted`, `Context files: ${themed(`primary`, String(this.#welcomeContextCount))}`)}`
      )
    }

    lines.push(border)

    return lines
  }

  #renderMessage(msg: TDisplayMessage, width: number): string[] {
    const lines: string[] = []

    switch (msg.type) {
      case `user`: {
        lines.push(``)
        const prefix = chalk.blue.bold(`you: `)
        const wrapped = wrapTextWithAnsi(msg.content, width - 6)
        if (wrapped.length > 0) {
          lines.push(` ${prefix}${wrapped[0]}`)
          for (let i = 1; i < wrapped.length; i++) {
            lines.push(`      ${wrapped[i]}`)
          }
        } else {
          lines.push(` ${prefix}`)
        }
        break
      }

      case `assistant`: {
        lines.push(``)
        // Use Markdown component for rendering, then extract its lines
        const md = new Markdown(msg.content || ``, 1, 0, mdTheme)
        const rendered = md.render(width)
        lines.push(...rendered)
        break
      }

      case `system`: {
        lines.push(``)
        const wrapped = wrapTextWithAnsi(msg.content, width - 4)
        for (const line of wrapped) {
          lines.push(` ${chalk.yellow(line)}`)
        }
        break
      }

      case `error`: {
        lines.push(``)
        const wrapped = wrapTextWithAnsi(msg.content, width - 4)
        for (const line of wrapped) {
          lines.push(` ${chalk.red(line)}`)
        }
        break
      }

      default: {
        lines.push(``)
        const wrapped = wrapTextWithAnsi(msg.content, width - 2)
        for (const line of wrapped) {
          lines.push(` ${line}`)
        }
        break
      }
    }

    return lines
  }

  #renderStreamingText(width: number): string[] {
    const lines: string[] = []
    lines.push(``)

    // Render partial streaming text as markdown
    const md = new Markdown(this.#streamText, 1, 0, mdTheme)
    const rendered = md.render(width)
    lines.push(...rendered)

    // Streaming indicator
    lines.push(` ${chalk.dim(`\u2588`)}`)

    return lines
  }

  #renderToolCalls(): string[] {
    const lines: string[] = []

    for (const tool of this.#toolCalls) {
      const statusIcon =
        tool.status === `running`
          ? chalk.yellow(`\u25CB`)
          : tool.status === `success`
            ? chalk.green(`\u2713`)
            : chalk.red(`\u2717`)

      lines.push(` ${statusIcon} ${chalk.dim(tool.summary || tool.name)}`)
    }

    return lines
  }
}
