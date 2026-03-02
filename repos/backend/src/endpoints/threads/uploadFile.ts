import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { FileMaxSize } from '@TBE/constants/values'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { isAllowedMimeType } from '@TBE/utils/validation/isAllowedMimeType'
import { extractText, isImageMimeType } from '@TBE/services/files/fileExtractor'

/**
 * POST /:threadId/files - Upload a file to a thread
 *
 * Body: { fileName: string, data: string (base64), mimeType: string }
 * Returns: { data: { assetId, fileName, fileType, fileSize, extractedText?, extractionError?, imageData? } }
 */
export const uploadFile: TEndpointConfig = {
  path: `/:threadId/files`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { threadId, agentId } = req.params

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!threadId) throw new Exception(400, `threadId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Validate thread exists and belongs to this agent
    const { data: thread, error: tErr } = await db.services.thread.get(threadId)
    if (tErr || !thread) throw new Exception(404, `Thread not found`)
    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    await checkPermission(req, EPermAction.create, EPermResource.asset, {
      orgId: thread.orgId,
    })

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { fileName, data, mimeType } = req.body
    if (!fileName) throw new Exception(400, `fileName is required`)
    if (!data) throw new Exception(400, `data is required (base64)`)
    if (!mimeType) throw new Exception(400, `mimeType is required`)
    if (!isAllowedMimeType(mimeType))
      throw new Exception(400, `Unsupported file type: ${mimeType}`)

    // Check estimated decoded size BEFORE allocating memory
    const estimatedSize = Math.ceil((data.length * 3) / 4)
    if (estimatedSize > FileMaxSize)
      throw new Exception(400, `File exceeds maximum size of 25MB`)

    // Validate base64 encoding before decoding
    const trimmed = data.replace(/\s/g, ``)
    if (trimmed.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed))
      throw new Exception(400, `Invalid base64 encoding`)

    // Decode base64 file data
    const buffer = Buffer.from(trimmed, `base64`)

    // Extract text content from the file
    const extraction = await extractText(buffer, mimeType)

    // Build image data for vision models
    const imageData = isImageMimeType(mimeType) ? data : undefined

    // Create asset record linked to the thread
    const { data: asset, error } = await db.services.asset.create({
      name: fileName,
      type: mimeType,
      threadId,
      meta: {
        fileSize: buffer.length,
        extractedText: extraction.text,
        extractionError: extraction.error,
        isImage: !!imageData,
      },
    })

    if (error) throw new Exception(500, error)

    res.status(201).json({
      data: {
        assetId: asset.id,
        fileName,
        fileType: mimeType,
        fileSize: buffer.length,
        extractedText: extraction.text,
        extractionError: extraction.error || undefined,
        imageData,
      },
    })
  },
}
