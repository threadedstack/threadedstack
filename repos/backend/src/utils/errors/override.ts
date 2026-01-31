export class OverrideError extends Error {
  static throw = (method: string, message?: string, code?: string) => {
    throw new OverrideError(method, message, code)
  }

  code?: string
  method: string
  message: string

  constructor(method: string, message?: string, code?: string) {
    let msg = `[Override Error] The ${method} function should be overwritten by the child class.`
    if (message) msg = `${msg}\n${message}`
    super(msg)
    this.code = code
    this.message = msg
    this.method = method
  }
}
