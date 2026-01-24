import { Base } from './base'
import { EFunLanguage } from '@TDM/types'

export class Function extends Base {
  name: string
  projectId: string
  content: string
  endpointId: string
  description?: string
  branch: string = `main`
  defaultArgs?: Record<string, any>
  dependencies?: Record<string, any>
  language: string = EFunLanguage.typescript

  constructor(func: Partial<Function>) {
    super()
    Object.assign(this, func)
  }
}
