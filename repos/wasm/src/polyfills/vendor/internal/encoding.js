/**
 * Encodes a string to UTF-8 Uint8Array.
 * Mimics Node.js behavior: replaces lone surrogates with U+FFFD.
 */
export function text_encode(input, encoding) {
  if (encoding !== 'utf-8' && encoding !== 'utf8') {
    // The wrapper handles the undefined check or fallback
    return new Uint8Array(0)
  }

  let codePoints = []
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i)

    // High surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 < input.length) {
        let next = input.charCodeAt(i + 1)
        // Low surrogate
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
          i++
        } else {
          // Unpaired high surrogate -> Replacement char
          code = 0xfffd
        }
      } else {
        // Unpaired high surrogate at end of string
        code = 0xfffd
      }
    }
    // Unpaired low surrogate
    else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd
    }

    codePoints.push(code)
  }

  // Calculate strict byte size to avoid over-allocation
  let byteSize = 0
  for (let code of codePoints) {
    if (code < 0x80) byteSize += 1
    else if (code < 0x800) byteSize += 2
    else if (code < 0x10000) byteSize += 3
    else byteSize += 4
  }

  const bytes = new Uint8Array(byteSize)
  let offset = 0

  for (const code of codePoints) {
    if (code < 0x80) {
      bytes[offset++] = code
    } else if (code < 0x800) {
      bytes[offset++] = 0xc0 | (code >> 6)
      bytes[offset++] = 0x80 | (code & 0x3f)
    } else if (code < 0x10000) {
      bytes[offset++] = 0xe0 | (code >> 12)
      bytes[offset++] = 0x80 | ((code >> 6) & 0x3f)
      bytes[offset++] = 0x80 | (code & 0x3f)
    } else {
      bytes[offset++] = 0xf0 | (code >> 18)
      bytes[offset++] = 0x80 | ((code >> 12) & 0x3f)
      bytes[offset++] = 0x80 | ((code >> 6) & 0x3f)
      bytes[offset++] = 0x80 | (code & 0x3f)
    }
  }

  return bytes
}

/**
 * Decodes a buffer to a string.
 * Mimics Node.js behavior: handles BOM, fatal options, and invalid sequence replacement.
 */
export function text_decode(buffer, encoding, fatal) {
  const enc = String(encoding).toLowerCase()
  if (enc !== 'utf-8' && enc !== 'utf8') {
    return new Error(`The encoding "${encoding}" is not supported`)
  }

  const bytes = new Uint8Array(buffer)
  let i = 0
  const len = bytes.length
  let result = ''

  // BOM Handling: If the buffer starts with 0xEF 0xBB 0xBF, skip it.
  // (Standard UTF-8 decode behavior usually strips BOM unless ignoreBOM is true)
  if (len >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    i = 3
  }

  while (i < len) {
    const b1 = bytes[i++]

    // ASCII
    if (b1 < 0x80) {
      result += String.fromCharCode(b1)
      continue
    }

    // Error: Continuation byte at start
    if ((b1 & 0xc0) === 0x80) {
      if (fatal) return new Error('Invalid continuation byte')
      result += '\uFFFD'
      continue
    }

    // 2-byte sequence
    if ((b1 & 0xe0) === 0xc0) {
      if (i >= len) {
        // Truncated
        if (fatal) return new Error('Unexpected end of data')
        result += '\uFFFD'
        continue
      }
      const b2 = bytes[i++]
      if ((b2 & 0xc0) !== 0x80) {
        // Invalid continuation
        if (fatal) return new Error('Invalid continuation byte')
        i-- // Backtrack b2 to re-process it
        result += '\uFFFD'
        continue
      }
      const code = ((b1 & 0x1f) << 6) | (b2 & 0x3f)
      if (code < 0x80) {
        // Overlong encoding
        if (fatal) return new Error('Overlong encoding')
        result += '\uFFFD'
      } else {
        result += String.fromCharCode(code)
      }
      continue
    }

    // 3-byte sequence
    if ((b1 & 0xf0) === 0xe0) {
      if (i + 1 >= len) {
        // Truncated
        if (fatal) return new Error('Unexpected end of data')
        result += '\uFFFD'
        if (i < len) i++ // Skip remaining byte if 1 left
        continue
      }
      const b2 = bytes[i++]
      const b3 = bytes[i++]
      if ((b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) {
        if (fatal) return new Error('Invalid continuation byte')
        i -= 2 // Backtrack
        if ((b2 & 0xc0) !== 0x80) {
          /* backtrack to b2 */
        } else {
          i++ /* b2 was ok, backtrack to b3 */
        }
        result += '\uFFFD'
        continue
      }
      const code = ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      if (code < 0x800 || (code >= 0xd800 && code <= 0xdfff)) {
        // Overlong or Surrogate
        if (fatal) return new Error('Invalid sequence')
        result += '\uFFFD'
      } else {
        result += String.fromCharCode(code)
      }
      continue
    }

    // 4-byte sequence
    if ((b1 & 0xf8) === 0xf0) {
      if (i + 2 >= len) {
        // Truncated
        if (fatal) return new Error('Unexpected end of data')
        result += '\uFFFD'
        i = len // Skip rest
        continue
      }
      const b2 = bytes[i++]
      const b3 = bytes[i++]
      const b4 = bytes[i++]
      if ((b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80 || (b4 & 0xc0) !== 0x80) {
        if (fatal) return new Error('Invalid continuation byte')
        i -= 3
        // Simple backtrack logic for robustness usually just replaces the sequence
        result += '\uFFFD'
        continue
      }
      const code =
        ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f)
      if (code < 0x10000 || code > 0x10ffff) {
        // Overlong or out of bounds
        if (fatal) return new Error('Invalid sequence')
        result += '\uFFFD'
      } else {
        result += String.fromCodePoint(code)
      }
      continue
    }

    // Invalid start byte
    if (fatal) return new Error('Invalid byte')
    result += '\uFFFD'
  }

  return result
}

/**
 * Encodes directly into a target buffer.
 * Mimics Node.js behavior:
 * - Returns { read, written }
 * - read: number of UTF-16 units read from source
 * - written: number of bytes written to dest
 * - Stops exactly when destination is full, never writing partial sequences.
 */
export function text_encode_into(source, encoding, destBuffer, destOffset) {
  const dest = new Uint8Array(destBuffer, destOffset)
  let read = 0
  let written = 0

  for (let i = 0; i < source.length; i++) {
    let code = source.charCodeAt(i)
    let charLen = 1 // UTF-16 units consumed (1 or 2)
    let bytesNeeded = 0
    let bytesVal = []

    // Handle Surrogates
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 < source.length) {
        const next = source.charCodeAt(i + 1)
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
          charLen = 2
        } else {
          code = 0xfffd // Unpaired high
        }
      } else {
        code = 0xfffd // Unpaired high at end
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd // Unpaired low
    }

    // Calculate bytes needed
    if (code < 0x80) {
      bytesNeeded = 1
      bytesVal = [code]
    } else if (code < 0x800) {
      bytesNeeded = 2
      bytesVal = [0xc0 | (code >> 6), 0x80 | (code & 0x3f)]
    } else if (code < 0x10000) {
      bytesNeeded = 3
      bytesVal = [0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)]
    } else {
      bytesNeeded = 4
      bytesVal = [
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      ]
    }

    // Check buffer space
    if (written + bytesNeeded > dest.length) {
      break // Stop if it doesn't fit
    }

    // Write bytes
    for (let b of bytesVal) {
      dest[written++] = b
    }

    read += charLen
    if (charLen === 2) i++ // Skip next unit if surrogate pair
  }

  return { read, written }
}
