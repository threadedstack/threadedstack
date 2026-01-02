
export class DBError extends Error {

  static throw = (msg?:string, ...args:any[]) => {
    msg = msg || `A database error occurred`
    throw new this(msg, ...args)
  }

  constructor(msg:string, ...rest:any[]){
    super(msg)
  }

}

export class DBIdError extends DBError {

  constructor(msg?:string){
    msg = msg || `Update requires an ID field in the data object.`
    super(msg)
  }

}

