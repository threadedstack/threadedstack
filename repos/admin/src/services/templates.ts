type TTemplateRegex = {
  open: string
  close: string
  check: RegExp
  match: RegExp
  extract: RegExp
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
  }

  constructor(opts?: TTemplates) {
    Object.assign(this, {
      ...opts,
      regex: { ...this.regex, ...opts?.regex },
    })
  }

  before = (value: string) => {
    return value.substring(0, value.lastIndexOf(this.regex.open))
  }

  after = (value: string) => {
    return value.substring(value.lastIndexOf(this.regex.close) + this.regex.close.length)
  }

  wrap = (value: string, check = true) => {
    let wrapped = value.trim()
    if (check) {
      if (!wrapped.startsWith(this.regex.open)) wrapped = `${this.regex.open}${wrapped}`
      if (!wrapped.endsWith(this.regex.close)) wrapped = `${wrapped}${this.regex.close}`
    } else {
      wrapped = `${this.regex.open}${wrapped}${this.regex.close}`
    }

    return wrapped
  }

  includes = (value: string) => value.includes(this.regex.open)

  has = (value: string) => this.regex.check.test(value)

  match = (value: string) => value.match(this.regex.match)

  extract = (value: string) => {
    const match = value.match(this.regex.extract)
    return match ? match[1] : null
  }
}

export const templates = new Templates()
