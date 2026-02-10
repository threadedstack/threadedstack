export enum EHttpMethod {
  Get = `get`,
  Put = `put`,
  Post = `post`,
  Head = `head`,
  Patch = `patch`,
  Trace = `trace`,
  Delete = `delete`,
  Connect = `connect`,
  Options = `options`,
}

export type THttpMethod = `${EHttpMethod}`
