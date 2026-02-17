export enum EFunLanguage {
  python = `python`,
  typescript = `typescript`,
  javascript = `javascript`,
}

export type TFunLanguage = `${EFunLanguage}`

/** HTTP request data passed to FaaS function handler */
export type TFunctionRequest = {
  path?: string
  body?: unknown
  method?: string
  query?: Record<string, string>
  headers?: Record<string, string>
}

/** Platform-injected context available to function handler */
export type TFunctionContext = {
  args?: Record<string, any>
  envVars?: Record<string, string>
  secrets?: Record<string, string>
}

/** Return value from a FaaS function handler (maps to HTTP response) */
export type TFunctionResponse = {
  body?: unknown
  statusCode?: number
  headers?: Record<string, string>
}

/** Internal execution result from FunctionExecutor */
export type TFunctionExecResult = {
  error?: string
  output: unknown
  duration: number
  success: boolean
}

export enum EFunParamType {
  array = `array`,
  string = `string`,
  object = `object`,
  number = `number`,
  boolean = `boolean`,
}

export type TFunParamType = `${EFunParamType}`

export type TFunctionParam = {
  name: string
  default?: unknown
  required?: boolean
  type: TFunParamType
  description?: string
}
