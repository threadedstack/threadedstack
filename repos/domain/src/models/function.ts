import type { TFunctionParam } from '@TDM/types'

import { Base } from '@TDM/models/base'
import { EFunLanguage } from '@TDM/types'

export class Function extends Base {
  name: string
  content: string
  projectId: string
  endpointId?: string
  description?: string
  branch: string = `main`
  inputSchema?: TFunctionParam[]
  defaultArgs?: Record<string, any>
  dependencies?: Record<string, any>
  language: string = EFunLanguage.typescript

  constructor(func: Partial<Function>) {
    super()
    Object.assign(this, func)
  }
}
