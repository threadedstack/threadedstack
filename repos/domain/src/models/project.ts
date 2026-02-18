import { Base } from './base'

export class Project extends Base {
  name: string
  orgId: string
  gitUrl?: string
  description?: string
  branch: string = `main`
  meta: Record<string, any> = {}

  constructor(project: Partial<Project>) {
    super()
    Object.assign(this, project)
  }
}
