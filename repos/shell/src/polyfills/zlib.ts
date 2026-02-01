import { ungzip, inflate, gzip, constants as pakoConstants } from 'pako'

export const constants = pakoConstants
export const gzipSync = (data: Uint8Array, options?: any) => gzip(data, options)
export const gunzipSync = (data: Uint8Array, options?: any) => ungzip(data, options)
export const inflateSync = (data: Uint8Array, options?: any) => inflate(data, options)

export default {
  gzipSync,
  constants,
  gunzipSync,
  inflateSync,
}
