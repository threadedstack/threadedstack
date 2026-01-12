import { Base } from './base'

export class Function extends Base {
  name: string
  projectId: string
  content: string
  endpointId: string
  description?: string
  branch: string = `main`
  language: string = 'typescript'
  defaultArgs?: Record<string, any>
  dependencies?: Record<string, any>

  constructor(func: Partial<Function>) {
    super()
    Object.assign(this, func)
  }
}
