import { extractSNI } from './extractSNI'
import { describe, it, expect } from 'vitest'

describe(`extractSNI`, () => {
  it(`should return null for non-TLS data`, () => {
    expect(extractSNI(Buffer.from(`GET / HTTP/1.1\r\n`))).toBeNull()
  })

  it(`should return null for empty buffer`, () => {
    expect(extractSNI(Buffer.alloc(0))).toBeNull()
  })

  it(`should return null for truncated TLS record`, () => {
    expect(extractSNI(Buffer.from([0x16, 0x03, 0x01]))).toBeNull()
  })

  it(`should extract hostname from a real TLS ClientHello`, () => {
    // Minimal TLS 1.2 ClientHello with SNI extension for "example.com"
    const hello = buildClientHello(`example.com`)
    expect(extractSNI(hello)).toBe(`example.com`)
  })

  it(`should handle different hostnames`, () => {
    const hello = buildClientHello(`api.test.io`)
    expect(extractSNI(hello)).toBe(`api.test.io`)
  })
})

// ── Helpers: build a minimal TLS ClientHello with SNI ──

function buildClientHello(hostname: string): Buffer {
  const hostBuf = Buffer.from(hostname, `ascii`)

  // SNI extension: type(0x0000) + length + listLength + nameType(0) + nameLength + name
  const sniPayload = Buffer.alloc(5 + hostBuf.length)
  sniPayload.writeUInt16BE(hostBuf.length + 3, 0) // server name list length
  sniPayload[2] = 0x00 // host name type
  sniPayload.writeUInt16BE(hostBuf.length, 3)
  hostBuf.copy(sniPayload, 5)

  const sniExt = Buffer.alloc(4 + sniPayload.length)
  sniExt.writeUInt16BE(0x0000, 0) // extension type: SNI
  sniExt.writeUInt16BE(sniPayload.length, 2)
  sniPayload.copy(sniExt, 4)

  // Extensions block
  const extensions = Buffer.alloc(2 + sniExt.length)
  extensions.writeUInt16BE(sniExt.length, 0)
  sniExt.copy(extensions, 2)

  // ClientHello body: version(2) + random(32) + sessionId(1) + cipherSuites(4) + compression(2) + extensions
  const bodyLen = 2 + 32 + 1 + 4 + 2 + extensions.length
  const body = Buffer.alloc(bodyLen)
  let offset = 0
  body.writeUInt16BE(0x0303, offset)
  offset += 2 // TLS 1.2
  offset += 32 // random (zeros)
  body[offset] = 0
  offset += 1 // session ID length = 0
  body.writeUInt16BE(2, offset)
  offset += 2 // cipher suites length = 2
  body.writeUInt16BE(0x002f, offset)
  offset += 2 // TLS_RSA_WITH_AES_128_CBC_SHA
  body[offset] = 1
  offset += 1 // compression methods length = 1
  body[offset] = 0x00
  offset += 1 // null compression
  extensions.copy(body, offset)

  // Handshake header: type(1) + length(3)
  const handshake = Buffer.alloc(4 + body.length)
  handshake[0] = 0x01 // ClientHello
  handshake[1] = 0
  handshake.writeUInt16BE(body.length, 2)
  body.copy(handshake, 4)

  // TLS record: type(1) + version(2) + length(2)
  const record = Buffer.alloc(5 + handshake.length)
  record[0] = 0x16 // handshake
  record.writeUInt16BE(0x0301, 1) // TLS 1.0 (record version)
  record.writeUInt16BE(handshake.length, 3)
  handshake.copy(record, 5)

  return record
}
