import { Base } from './base'

export class User extends Base {

  first:string
  last:string
  email?:string
  altEmail?:string
  photoUrl:string
  provider?:string
  displayName?:string

  constructor(usr:Partial<User>){
    super()
    Object.assign(this, usr)
  }

}
