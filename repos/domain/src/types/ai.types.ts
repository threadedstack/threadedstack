export enum EMsgType {
  user = `user`,
  tool = `tool`,
  system = `system`,
  action = `action`,
  assistant = `assistant`,
}

export type TMsgType = `${EMsgType}`
