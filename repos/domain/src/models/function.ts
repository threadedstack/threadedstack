import { Base } from './base'

export class Function extends Base {
  endpointId: string
  providerId: string
  content: string
  language: string = 'typescript'
  defaultArgs?: Record<string, any>
  dependencies?: Record<string, any>

  constructor(func: Partial<Function>) {
    super()
    Object.assign(this, func)
  }
}
