import { ungzip, inflate, gzip, constants as pakoConstants } from 'pako'

export const constants = pakoConstants
export const gzipSync = (data, options) => gzip(data, options)
export const gunzipSync = (data, options) => ungzip(data, options)
export const inflateSync = (data, options) => inflate(data, options)

export default {
  gzipSync,
  constants,
  gunzipSync,
  inflateSync,
}
