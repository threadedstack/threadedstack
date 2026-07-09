import { describe, it, expect, vi, beforeEach } from 'vitest'
import { S3Service } from './s3'
import type { TS3Config } from '@TBE/types/s3.types'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const sendMock = vi.fn()
const uploadDoneMock = vi.fn()

vi.mock(`@aws-sdk/client-s3`, () => ({
  S3Client: vi.fn(() => ({ send: sendMock })),
  GetObjectCommand: vi.fn((input) => ({ input, __type: `GetObjectCommand` })),
  DeleteObjectCommand: vi.fn((input) => ({ input, __type: `DeleteObjectCommand` })),
}))

vi.mock(`@aws-sdk/lib-storage`, () => ({
  Upload: vi.fn(() => ({ done: uploadDoneMock })),
}))

const activeConfig: TS3Config = {
  active: true,
  bucket: `test-bucket`,
  endpoint: `https://s3.example.com`,
  accessKeyId: `key-id`,
  secretAccessKey: `secret`,
}

describe(`S3Service`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`constructor / active`, () => {
    it(`is inactive when config.active is falsy`, () => {
      const svc = new S3Service({ ...activeConfig, active: false })
      expect(svc.active).toBe(false)
    })

    it(`is inactive when config.active is omitted`, () => {
      const { active, ...rest } = activeConfig
      const svc = new S3Service(rest as TS3Config)
      expect(svc.active).toBe(false)
    })

    it(`is active when config.active is true`, () => {
      const svc = new S3Service(activeConfig)
      expect(svc.active).toBe(true)
    })
  })

  describe(`createUploadStream`, () => {
    it(`returns undefined when inactive`, () => {
      const svc = new S3Service({ ...activeConfig, active: false })
      expect(svc.createUploadStream(`key`)).toBeUndefined()
    })

    it(`returns a stream + done() when active`, () => {
      const svc = new S3Service(activeConfig)
      const result = svc.createUploadStream(`some-key`)
      expect(result).toBeDefined()
      expect(result?.stream).toBeDefined()
      expect(typeof result?.done).toBe(`function`)
    })

    it(`done() awaits upload.done() and resolves on success`, async () => {
      uploadDoneMock.mockResolvedValueOnce(undefined)
      const svc = new S3Service(activeConfig)
      const result = svc.createUploadStream(`some-key`)
      await expect(result!.done()).resolves.toBeUndefined()
      expect(uploadDoneMock).toHaveBeenCalledTimes(1)
    })

    it(`done() is idempotent — only calls upload.done() once across repeat calls`, async () => {
      uploadDoneMock.mockResolvedValueOnce(undefined)
      const svc = new S3Service(activeConfig)
      const result = svc.createUploadStream(`some-key`)
      await result!.done()
      await result!.done()
      expect(uploadDoneMock).toHaveBeenCalledTimes(1)
    })

    it(`done() wraps a failed upload.done() in a descriptive error`, async () => {
      uploadDoneMock.mockRejectedValueOnce(new Error(`network blip`))
      const svc = new S3Service(activeConfig)
      const result = svc.createUploadStream(`bad-key`)
      await expect(result!.done()).rejects.toThrow(
        `S3 upload failed for key "bad-key": network blip`
      )
    })
  })

  describe(`getObject`, () => {
    it(`throws when inactive`, async () => {
      const svc = new S3Service({ ...activeConfig, active: false })
      await expect(svc.getObject(`key`)).rejects.toThrow(`S3 is not configured`)
    })

    it(`throws when the response body is empty`, async () => {
      sendMock.mockResolvedValueOnce({ Body: undefined })
      const svc = new S3Service(activeConfig)
      await expect(svc.getObject(`missing-key`)).rejects.toThrow(
        `S3 object body is empty for key: missing-key`
      )
    })

    it(`returns the response body when present`, async () => {
      const fakeBody = { pipe: vi.fn() }
      sendMock.mockResolvedValueOnce({ Body: fakeBody })
      const svc = new S3Service(activeConfig)
      const body = await svc.getObject(`present-key`)
      expect(body).toBe(fakeBody)
    })
  })

  describe(`deleteObject`, () => {
    it(`throws when inactive`, async () => {
      const svc = new S3Service({ ...activeConfig, active: false })
      await expect(svc.deleteObject(`key`)).rejects.toThrow(`S3 is not configured`)
    })

    it(`sends a DeleteObjectCommand when active`, async () => {
      sendMock.mockResolvedValueOnce({})
      const svc = new S3Service(activeConfig)
      await svc.deleteObject(`delete-key`)
      expect(sendMock).toHaveBeenCalledTimes(1)
      const [command] = sendMock.mock.calls[0]
      expect(command.__type).toBe(`DeleteObjectCommand`)
      expect(command.input).toEqual({ Bucket: `test-bucket`, Key: `delete-key` })
    })
  })
})
