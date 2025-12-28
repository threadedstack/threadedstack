import { toNum } from '@keg-hub/jsutils/toNum'
import { isStr } from '@keg-hub/jsutils/isStr'

export class ApiError extends Error {
  status:number
  name=`ApiError`

  constructor(msg:string|Error, status:string|number){
    const isErr = !isStr(msg)
    const message = isErr ? msg.message : msg
    super(message)

    this.status = toNum(status)
    if(isErr) this.stack = msg.stack
  }
}
