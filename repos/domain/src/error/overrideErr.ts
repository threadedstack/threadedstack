import { isStr } from "@keg-hub/jsutils/isStr"
import { emptyArr } from "@keg-hub/jsutils/emptyArr"
import { ensureArr } from "@keg-hub/jsutils/ensureArr"


export type TOvrErrDetail = {
  loc:string[]
  msg:string
  type:string
}

export type TOvrErrDetails = Array<TOvrErrDetail>

const ErrorText = `This method must be overwritten by child extended class`

const mkDetail = (item:TOvrErrDetail|string):TOvrErrDetail => {
  return isStr(item)
      ? { loc: emptyArr, msg: item, type: `` }
      : item
}

export class OverrideErr extends Error {

  static throw = (message:string=ErrorText, details:TOvrErrDetails|TOvrErrDetail|string=emptyArr) => {
    throw new OverrideErr(message, details)
  }

  message: string
  details?:TOvrErrDetails

  constructor(
    message:string=ErrorText,
    details:TOvrErrDetails|TOvrErrDetail|string=emptyArr
  ) {
    super(message)
    this.message = message
    this.details = isStr(details) ? [mkDetail(details)] : ensureArr<TOvrErrDetail>(details).map(mkDetail)
  }

  toString():string {
    return this.details?.length
      ? [this.message, `Details: ${this.details.join(`\n`)}`].join(`\n`)
      : this.message
  }
  
}

