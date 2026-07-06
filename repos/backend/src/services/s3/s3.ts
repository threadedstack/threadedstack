import type { Readable } from 'stream'
import type { TS3Config, TUploadStream } from '@TBE/types/s3.types'

import { PassThrough } from 'stream'
import { logger } from '@TBE/utils/logger'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export class S3Service {
  #client?: S3Client
  #bucket?: string
  #active: boolean

  constructor(config: TS3Config) {
    this.#active = !!config.active

    if (!this.#active) {
      logger.warn(
        `[S3Service] No S3 config provided — S3 operations will not be available.`
      )
      return
    }

    const { bucket, endpoint, accessKeyId, secretAccessKey, region = `auto` } = config

    this.#bucket = bucket
    this.#client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })

    logger.info(`[S3Service] Initialized with bucket "${bucket}" at ${endpoint}`)
  }

  get active(): boolean {
    return this.#active
  }

  createUploadStream(key: string): TUploadStream | undefined {
    if (!this.#active || !this.#client || !this.#bucket) return undefined

    const stream = new PassThrough()

    stream.on(`error`, (err) => {
      logger.error(`[S3Service] Upload stream error for key "${key}":`, err.message)
    })

    const upload = new Upload({
      client: this.#client,
      params: {
        Key: key,
        Body: stream,
        Bucket: this.#bucket,
        ContentType: `application/octet-stream`,
      },
    })

    let finalized = false
    const done = async () => {
      if (finalized) return
      finalized = true
      try {
        await upload.done()
      } catch (err) {
        throw new Error(`S3 upload failed for key "${key}": ${(err as Error).message}`)
      }
    }

    return { stream, done }
  }

  async getObject(key: string): Promise<Readable> {
    if (!this.#active || !this.#client || !this.#bucket)
      throw new Error(`[S3Service] S3 is not configured`)

    const resp = await this.#client.send(
      new GetObjectCommand({ Bucket: this.#bucket, Key: key })
    )

    if (!resp.Body) throw new Error(`S3 object body is empty for key: ${key}`)

    return resp.Body as Readable
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.#active || !this.#client || !this.#bucket)
      throw new Error(`[S3Service] S3 is not configured`)

    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }))
  }
}
