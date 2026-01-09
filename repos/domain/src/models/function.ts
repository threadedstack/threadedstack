import { Base } from './base'

export class Function extends Base {
  name: string
  repoId: string
  content: string
  endpointId: string
  description?: string
  language: string = 'typescript'
  defaultArgs?: Record<string, any>
  dependencies?: Record<string, any>

  constructor(func: Partial<Function>) {
    super()
    Object.assign(this, func)
  }
}
