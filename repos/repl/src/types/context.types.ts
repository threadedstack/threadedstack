export type TContextSource = `auto` | `manual`

export type TContextFile = {
  path: string
  name: string
  source: TContextSource
  content: string
  sizeBytes: number
}
