import { Base } from './base'


export class User extends Base {

  first:string
  last:string
  email?:string
  image:string
  role?:string
  name?:string
  banned?:boolean
  provider?:string
  banReason?:string
  emailVerified?:boolean
  banExpires?:string|Date

  constructor(usr:Partial<User>){
    super()
    const { name } = usr
    let last = usr.last
    let first = usr.first
    if(name && !first || !last){
      const [fn, ln] = name.split(` `)
      first = first || fn
      last = last || ln
    }

    Object.assign(this, { ...usr, first, last })
  }

}
