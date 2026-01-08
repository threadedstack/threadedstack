export class Exception extends Error {
  static throw = (status: number, message: string, errorCode?: string) => {
    throw new Exception(status, message, errorCode)
  }

  status: number
  message: string
  errorCode?: string

  constructor(status: number, message: string, errorCode?: string) {
    super(message)
    this.status = status
    this.message = message
    this.errorCode = errorCode
  }
}
