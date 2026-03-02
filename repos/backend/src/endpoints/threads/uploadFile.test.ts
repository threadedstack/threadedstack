import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { uploadFile } from './uploadFile'
import { EPMethod } from '@TBE/types'

const mockExtractText = vi.hoisted(() => vi.fn())
const mockIsImageMimeType = vi.hoisted(() => vi.fn())
const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/services/files/fileExtractor`, () => ({
  extractText: mockExtractText,
  isImageMimeType: mockIsImageMimeType,
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

describe(`POST /:threadId/files - Upload file`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const mockThread = {
    id: `t-1`,
    orgId: `org-1`,
    agentId: `agent-1`,
    userId: `test-user-id`,
  }

  const validBody = {
    fileName: `document.txt`,
    data: Buffer.from(`hello world`).toString(`base64`),
    mimeType: `text/plain`,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              thread: {
                get: vi.fn().mockResolvedValue({ data: mockThread }),
              },
              asset: {
                create: vi.fn().mockResolvedValue({
                  data: { id: `asset-1` },
                }),
              },
            },
          },
        },
      } as any,
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: { threadId: `t-1`, agentId: `agent-1` },
      body: { ...validBody },
    }

    mockExtractText.mockResolvedValue({ text: `hello world`, error: undefined })
    mockIsImageMimeType.mockReturnValue(false)
    mockCheckPermission.mockResolvedValue(undefined)
  })

  // ── CONFIG ────────────────────────────────────────────────────────

  describe(`Endpoint configuration`, () => {
    it(`should have correct path and method`, () => {
      expect(uploadFile.path).toBe(`/:threadId/files`)
      expect(uploadFile.method).toBe(EPMethod.Post)
    })
  })

  // ── AUTH & PARAM VALIDATION ───────────────────────────────────────

  describe(`Authentication and parameter validation`, () => {
    it(`should throw 401 when no user`, async () => {
      mockReq.user = undefined as any

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Authentication required`)
    })

    it(`should throw 400 when threadId is missing`, async () => {
      mockReq.params = { agentId: `agent-1` }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`threadId is required`)
    })

    it(`should throw 404 when thread not found`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Thread not found`)
    })

    it(`should throw 404 when thread service returns error`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: `Not found` })

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Thread not found`)
    })

    it(`should throw 404 when thread belongs to different agent`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({
        data: { ...mockThread, agentId: `other-agent` },
      })

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Thread not found`)
    })

    it(`should throw 403 when thread belongs to different user`, async () => {
      const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({
        data: { ...mockThread, userId: `other-user` },
      })

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Access denied`)
    })
  })

  // ── BODY VALIDATION ───────────────────────────────────────────────

  describe(`Request body validation`, () => {
    it(`should throw 400 when fileName is missing`, async () => {
      mockReq.body = { data: validBody.data, mimeType: validBody.mimeType }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`fileName is required`)
    })

    it(`should throw 400 when data is missing`, async () => {
      mockReq.body = { fileName: validBody.fileName, mimeType: validBody.mimeType }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`data is required (base64)`)
    })

    it(`should throw 400 when mimeType is missing`, async () => {
      mockReq.body = { fileName: validBody.fileName, data: validBody.data }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`mimeType is required`)
    })

    it(`should throw 400 when file exceeds maximum size`, async () => {
      // Create base64 data that decodes to > 25MB
      const largeBuffer = Buffer.alloc(25 * 1024 * 1024 + 1, `x`)
      mockReq.body = {
        fileName: `large.txt`,
        data: largeBuffer.toString(`base64`),
        mimeType: `text/plain`,
      }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`File exceeds maximum size of 25MB`)
    })

    it(`should throw 400 when base64 data contains invalid characters`, async () => {
      mockReq.body = {
        fileName: `doc.txt`,
        data: `!!!not-valid-base64!!!`,
        mimeType: `text/plain`,
      }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Invalid base64 encoding`)
    })

    it(`should throw 400 when base64 length is not a multiple of 4`, async () => {
      mockReq.body = {
        fileName: `doc.txt`,
        data: `abc`,
        mimeType: `text/plain`,
      }

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Invalid base64 encoding`)
    })
  })

  // ── SUCCESSFUL TEXT FILE UPLOAD ────────────────────────────────────

  describe(`Successful text file upload`, () => {
    it(`should return 201 with asset data and extracted text`, async () => {
      mockExtractText.mockResolvedValue({ text: `hello world`, error: undefined })
      mockIsImageMimeType.mockReturnValue(false)

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: { id: `asset-1` } })

      await uploadFile.action(mockReq as TRequest, mockRes as Response)

      expect(mockExtractText).toHaveBeenCalledWith(
        Buffer.from(validBody.data, `base64`),
        `text/plain`
      )
      expect(mockIsImageMimeType).toHaveBeenCalledWith(`text/plain`)

      expect(mockCreate).toHaveBeenCalledWith({
        name: `document.txt`,
        type: `text/plain`,
        threadId: `t-1`,
        meta: {
          fileSize: Buffer.from(validBody.data, `base64`).length,
          extractedText: `hello world`,
          extractionError: undefined,
          isImage: false,
        },
      })

      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          assetId: `asset-1`,
          fileName: `document.txt`,
          fileType: `text/plain`,
          fileSize: Buffer.from(validBody.data, `base64`).length,
          extractedText: `hello world`,
          extractionError: undefined,
          imageData: undefined,
        },
      })
    })
  })

  // ── SUCCESSFUL IMAGE FILE UPLOAD ──────────────────────────────────

  describe(`Successful image file upload`, () => {
    it(`should return 201 with asset data and imageData`, async () => {
      const imageBase64 = Buffer.from(`fake-png-data`).toString(`base64`)
      mockReq.body = {
        fileName: `photo.png`,
        data: imageBase64,
        mimeType: `image/png`,
      }

      mockExtractText.mockResolvedValue({ text: undefined, error: undefined })
      mockIsImageMimeType.mockReturnValue(true)

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: { id: `asset-2` } })

      await uploadFile.action(mockReq as TRequest, mockRes as Response)

      expect(mockIsImageMimeType).toHaveBeenCalledWith(`image/png`)

      expect(mockCreate).toHaveBeenCalledWith({
        name: `photo.png`,
        type: `image/png`,
        threadId: `t-1`,
        meta: {
          fileSize: Buffer.from(imageBase64, `base64`).length,
          extractedText: undefined,
          extractionError: undefined,
          isImage: true,
        },
      })

      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          assetId: `asset-2`,
          fileName: `photo.png`,
          fileType: `image/png`,
          fileSize: Buffer.from(imageBase64, `base64`).length,
          extractedText: undefined,
          extractionError: undefined,
          imageData: imageBase64,
        },
      })
    })
  })

  // ── ASSET CREATION ERROR ──────────────────────────────────────────

  describe(`Asset creation error`, () => {
    it(`should throw 500 when asset create returns error`, async () => {
      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ error: `Failed to create asset` })

      await expect(
        uploadFile.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Failed to create asset`)
    })
  })

  // ── RESPONSE SHAPE ────────────────────────────────────────────────

  describe(`Response shape verification`, () => {
    it(`should include all expected fields in response data`, async () => {
      mockExtractText.mockResolvedValue({ text: `extracted`, error: undefined })
      mockIsImageMimeType.mockReturnValue(false)

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: { id: `asset-99` } })

      await uploadFile.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0]
      expect(responseData).toHaveProperty(`data.assetId`)
      expect(responseData).toHaveProperty(`data.fileName`)
      expect(responseData).toHaveProperty(`data.fileType`)
      expect(responseData).toHaveProperty(`data.fileSize`)
      expect(responseData).toHaveProperty(`data.extractedText`)
      expect(responseData.data.imageData).toBeUndefined()
    })

    it(`should include imageData in response when file is an image`, async () => {
      const imageBase64 = Buffer.from(`img-bytes`).toString(`base64`)
      mockReq.body = {
        fileName: `img.jpg`,
        data: imageBase64,
        mimeType: `image/jpeg`,
      }

      mockExtractText.mockResolvedValue({ text: undefined, error: undefined })
      mockIsImageMimeType.mockReturnValue(true)

      const mockCreate = mockReq.app?.locals.db.services.asset.create as ReturnType<
        typeof vi.fn
      >
      mockCreate.mockResolvedValue({ data: { id: `asset-img` } })

      await uploadFile.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0]
      expect(responseData.data.imageData).toBe(imageBase64)
    })
  })
})
