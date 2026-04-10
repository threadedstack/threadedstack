import { Base } from '@TDM/models/base'

export class Skill extends Base {
  name!: string
  orgId!: string
  description!: string
  instructions!: string
  tools: string[] = []
  triggerKeywords: string[] = []
  alwaysActive: boolean = false

  constructor(skill: Partial<Skill>) {
    super()
    Object.assign(this, skill)
  }
}
