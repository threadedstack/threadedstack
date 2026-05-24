import type { PassThrough } from 'stream'

export type TUploadStream = {
  stream: PassThrough
  done: () => Promise<void>
}

export type TS3Config = {
  bucket: string
  active?: boolean
  region?: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
}
