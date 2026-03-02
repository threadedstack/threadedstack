import type { TApiRes } from '@TAF/types'

import { BaseApi } from '@TAF/services/api'

export type TFileUploadResult = {
  assetId: string
  fileName: string
  fileType: string
  fileSize: number
  extractedText?: string
  imageData?: string
}

export class FilesApi extends BaseApi {
  /**
   * Upload a file to a thread. Reads the File as base64 and POSTs to the backend.
   */
  async upload(
    orgId: string,
    agentId: string,
    threadId: string,
    file: File
  ): Promise<TApiRes<TFileUploadResult>> {
    const data = await this.#readAsBase64(file)

    const resp = await this.api.post<TFileUploadResult>({
      data: {
        data,
        fileName: file.name,
        mimeType: file.type || `application/octet-stream`,
      },
      path: `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/files`,
    })

    resp.error && (await this._onError(resp.error, `Failed to upload file`))

    return resp
  }

  #readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip the data:*;base64, prefix
        const base64 = result.split(`,`)[1] || result
        resolve(base64)
      }
      reader.onerror = () => reject(new Error(`Failed to read file`))
      reader.readAsDataURL(file)
    })
  }
}

export const filesApi = new FilesApi()
