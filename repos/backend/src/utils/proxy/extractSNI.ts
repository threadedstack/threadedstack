import type { TRouteMap } from '@tdsk/domain'

/**
 * Extract SNI (Server Name Indication) hostname from a TLS ClientHello.
 * Returns null if the buffer doesn't contain a valid ClientHello or no SNI extension.
 */
export const extractSNI = (buf: Buffer): string | null => {
  // TLS record: contentType(1) + version(2) + length(2)
  if (buf.length < 5 || buf[0] !== 0x16) return null

  let offset = 5 // skip TLS record header

  // Handshake header: type(1) + length(3)
  if (offset >= buf.length || buf[offset] !== 0x01) return null // 0x01 = ClientHello
  offset += 4 // skip handshake type + 3-byte length

  // ClientHello: version(2) + random(32)
  offset += 2 + 32

  // Session ID: length(1) + data
  if (offset >= buf.length) return null
  offset += 1 + buf[offset]

  // Cipher suites: length(2) + data
  if (offset + 2 > buf.length) return null
  offset += 2 + buf.readUInt16BE(offset)

  // Compression methods: length(1) + data
  if (offset >= buf.length) return null
  offset += 1 + buf[offset]

  // Extensions: length(2)
  if (offset + 2 > buf.length) return null
  const extensionsEnd = offset + 2 + buf.readUInt16BE(offset)
  offset += 2

  while (offset + 4 < extensionsEnd && offset + 4 < buf.length) {
    const extType = buf.readUInt16BE(offset)
    const extLen = buf.readUInt16BE(offset + 2)
    offset += 4

    if (extType === 0x0000) {
      // SNI extension: listLength(2) + nameType(1) + nameLength(2) + name
      if (offset + 5 > buf.length) return null
      const nameLen = buf.readUInt16BE(offset + 3)
      if (offset + 5 + nameLen > buf.length) return null
      return buf.subarray(offset + 5, offset + 5 + nameLen).toString(`ascii`)
    }

    offset += extLen
  }

  return null
}
