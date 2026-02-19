import { marked } from 'marked'
import { markedTerminal } from 'marked-terminal'

marked.use(markedTerminal() as any)

export function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

export class StreamingMarkdownBuffer {
  #buffer = ''
  #rendered = ''

  append(token: string): void {
    this.#buffer += token
  }

  flush(): string {
    const blockEnd = this.#buffer.lastIndexOf('\n\n')
    if (blockEnd === -1) return ''

    const toRender = this.#buffer.slice(0, blockEnd + 2)
    this.#buffer = this.#buffer.slice(blockEnd + 2)
    const rendered = renderMarkdown(toRender)
    this.#rendered += rendered
    return rendered
  }

  flushAll(): string {
    if (!this.#buffer) return ''
    const rendered = renderMarkdown(this.#buffer)
    this.#buffer = ''
    this.#rendered += rendered
    return rendered
  }

  get fullText(): string {
    return this.#rendered
  }
}
