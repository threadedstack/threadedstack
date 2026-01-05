import { Base } from './base'

export class Team extends Base {

  name:string
  description?:string

  constructor(team:Partial<Team>){
    super()
    Object.assign(this, team)
  }
  
}
