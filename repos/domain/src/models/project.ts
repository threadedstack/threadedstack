import { Base } from '@TDM/models/base'

type TProjectCounts = {
  agent?: number
  endpoint?: number
  function?: number
}

export class Project extends Base {
  name: string
  orgId: string
  gitUrl?: string
  description?: string
  branch: string = `main`
  counts?: TProjectCounts
  meta: Record<string, any> = {}

  constructor(project: Partial<Project>) {
    super()
    Object.assign(this, project)
  }
}
