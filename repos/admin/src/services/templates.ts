type TTemplateRegex = {
  open: string
  close: string
  check: RegExp
  match: RegExp
  extract: RegExp
  extractId: RegExp
}

export type TTemplates = {
  regex: Partial<TTemplateRegex>
}

export class Templates {
  regex: TTemplateRegex = {
    open: `{{`,
    close: `}}`,
    check: /\{\{[^}]+\}\}/,
    match: /\{\{([^}]*)$/,
    extract: /\{\{([^}]+)\}\}/,
    extractId: /\{\{\s*(.+?):([A-Za-z0-9_-]{10})\s*\}\}/,
  }

  constructor(opts?: TTemplates) {
    if (opts?.regex) {
      this.regex = { ...this.regex, ...opts.regex } as TTemplateRegex
    }
  }

  before = (value: string) => {
    return value.substring(0, value.lastIndexOf(this.regex.open))
  }

  after = (value: string) => {
    return value.substring(value.lastIndexOf(this.regex.close) + this.regex.close.length)
  }

  wrapWithId = (name: string, id: string) => {
    return `${this.regex.open}  ${name.trim()}:${id}  ${this.regex.close}`
  }

  includes = (value: string) => value.includes(this.regex.open)

  has = (value: string) => this.regex.check.test(value)

  match = (value: string) => value.match(this.regex.match)

  extract = (value: string) => {
    const match = value.match(this.regex.extract)
    return match ? match[1] : null
  }

  extractName = (value: string): string | null => {
    const match = value.match(this.regex.extractId)
    if (match) return match[1].trim()
    return this.extract(value)
  }

  extractId = (value: string): string | null => {
    const match = value.match(this.regex.extractId)
    return match ? match[2] : null
  }
}

export const templates = new Templates()
