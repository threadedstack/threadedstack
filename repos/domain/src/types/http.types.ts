export enum EHttpMethod {
  Get = `get`,
  Post = `post`,
  Put = `put`,
  Patch = `patch`,
  Delete = `delete`,
  Head = `head`,
  Trace = `trace`,
  Connect = `connect`,
}

export type THttpMethod = `${EHttpMethod}`
