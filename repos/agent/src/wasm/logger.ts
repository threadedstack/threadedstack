type TWasmLogLevels = `vebose` | `debug` | `info` | `warn` | `error`
type TLogMethod = keyof typeof console

export type TWasmLogger = {
  tag?: string
  level?: TWasmLogLevels
}

export class WasmLogger {
  tag?: string
  level?: TWasmLogLevels

  constructor(opts?: TWasmLogger) {
    this.tag = opts?.tag || `[WASM]`
    this.level = opts?.level || `vebose`
  }

  #log = (method: TLogMethod, args: any[]): undefined | void => {
    // TODO: add level check an tag
    const func = console?.[method] || console.log
    func.apply(console, ...args)
  }

  log = (...args: any[]) => this.#log(`log`, args)
  debug = (...args: any[]) => this.#log(`debug`, args)
  warn = (...args: any[]) => this.#log(`warn`, args)
  info = (...args: any[]) => this.#log(`info`, args)
  error = (...args: any[]) => this.#log(`error`, args)
}

export const logger = new WasmLogger()
