import type { Readable } from 'stream'
import type { TS3Config, TUploadStream } from '@TBE/types/s3.types'

import { PassThrough } from 'stream'
import { logger } from '@TBE/utils/logger'
import { Upload } from '@aws-sdk/lib-storage'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

// Interval for the tail-snapshot PutObject. Small enough that a killed pod
// leaves at most this many seconds of unwritten stdout on the floor, large
// enough not to hammer S3 while a chatty run is streaming.
const LIVE_FLUSH_MS = 15_000
// Max size of the tail-snapshot buffer. Keeps the last N bytes of the run so
// the file at `<key>.live` is always cheap to read while showing recent output.
const LIVE_TAIL_MAX_BYTES = 2 * 1024 * 1024

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
    const client = this.#client
    const bucket = this.#bucket

    const stream = new PassThrough()

    stream.on(`error`, (err) => {
      logger.error(`[S3Service] Upload stream error for key "${key}":`, err.message)
    })

    // Multipart upload for the full transcript. Only becomes a readable object
    // at `<key>` after `.done()` succeeds.
    const upload = new Upload({
      client,
      params: {
        Key: key,
        Body: stream,
        Bucket: bucket,
        ContentType: `application/octet-stream`,
      },
    })

    // Live tail: rolling buffer of the most recent bytes, PutObject'd to
    // `<key>.live` every LIVE_FLUSH_MS. Survives pod force-kill because each
    // flush is a single atomic PutObject, not a multipart-in-progress. Reader
    // grabs the .live key to see what a still-running job is doing right now.
    const tailKey = `${key}.live`
    const chunks: Buffer[] = []
    let tailBytes = 0
    let tailDirty = false
    let tailFlushing = false

    stream.on(`data`, (chunk: Buffer) => {
      chunks.push(chunk)
      tailBytes += chunk.length
      while (tailBytes > LIVE_TAIL_MAX_BYTES && chunks.length > 1) {
        const dropped = chunks.shift()!
        tailBytes -= dropped.length
      }
      tailDirty = true
    })

    const flushTail = async () => {
      if (!tailDirty || tailFlushing) return
      tailFlushing = true
      // Snapshot the buffer first so subsequent writes during the PutObject
      // don't get clobbered by the in-place slice.
      const body = Buffer.concat(chunks, tailBytes)
      tailDirty = false
      try {
        await client.send(
          new PutObjectCommand({
            Key: tailKey,
            Body: body,
            Bucket: bucket,
            ContentType: `application/octet-stream`,
          })
        )
      } catch (err) {
        // Tail flush is best-effort. Log once; don't stall the run.
        logger.warn(
          `[S3Service] Live tail flush failed for "${tailKey}":`,
          (err as Error).message
        )
      } finally {
        tailFlushing = false
      }
    }

    const flushTimer: NodeJS.Timeout = setInterval(flushTail, LIVE_FLUSH_MS)
    flushTimer.unref()

    let finalized = false
    const done = async () => {
      if (finalized) return
      finalized = true
      clearInterval(flushTimer)
      // Best-effort final tail snapshot so `.live` reflects the end of the
      // run even if we hit an error path before the multipart completes.
      await flushTail()
      try {
        await upload.done()
      } catch (err) {
        throw new Error(`S3 upload failed for key "${key}": ${(err as Error).message}`)
      }
      // Multipart succeeded; drop the tail companion so operators only see
      // the canonical object at `<key>`.
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: tailKey }))
      } catch {
        // Tail delete is best-effort; a stray `.live` never breaks anything.
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
