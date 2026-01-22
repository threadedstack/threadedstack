export class OverrideError extends Error {
  static throw = (method: string, message?: string, errorCode?: string) => {
    throw new OverrideError(method, message, errorCode)
  }

  method: string
  message: string
  errorCode?: string

  constructor(method: string, message?: string, errorCode?: string) {
    let msg = `[Override Error] The ${method} function should be overwritten by the child class.`
    if (message) msg = `${msg}\n${message}`
    super(msg)
    this.message = msg
    this.method = method
    this.errorCode = errorCode
  }
}
