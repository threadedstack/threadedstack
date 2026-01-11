import { Base } from './base'

export class Repo extends Base {
  name: string
  orgId: string
  gitUrl?: string
  branch: string = `main`
  meta: Record<string, any> = {}

  constructor(repo: Partial<Repo>) {
    super()
    Object.assign(this, repo)
  }
}
