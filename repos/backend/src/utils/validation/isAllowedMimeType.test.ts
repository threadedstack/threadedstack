import { describe, it, expect } from 'vitest'
import { isAllowedMimeType } from './isAllowedMimeType'

describe(`isAllowedMimeType`, () => {
  describe(`prefix matches`, () => {
    it(`should allow text/* mime types`, () => {
      expect(isAllowedMimeType(`text/plain`)).toBe(true)
      expect(isAllowedMimeType(`text/html`)).toBe(true)
      expect(isAllowedMimeType(`text/css`)).toBe(true)
      expect(isAllowedMimeType(`text/csv`)).toBe(true)
      expect(isAllowedMimeType(`text/markdown`)).toBe(true)
    })

    it(`should allow image/* mime types`, () => {
      expect(isAllowedMimeType(`image/png`)).toBe(true)
      expect(isAllowedMimeType(`image/jpeg`)).toBe(true)
      expect(isAllowedMimeType(`image/gif`)).toBe(true)
      expect(isAllowedMimeType(`image/svg+xml`)).toBe(true)
      expect(isAllowedMimeType(`image/webp`)).toBe(true)
    })
  })

  describe(`exact matches`, () => {
    it(`should allow application/json`, () => {
      expect(isAllowedMimeType(`application/json`)).toBe(true)
    })

    it(`should allow application/xml`, () => {
      expect(isAllowedMimeType(`application/xml`)).toBe(true)
    })

    it(`should allow application/csv`, () => {
      expect(isAllowedMimeType(`application/csv`)).toBe(true)
    })

    it(`should allow application/javascript`, () => {
      expect(isAllowedMimeType(`application/javascript`)).toBe(true)
    })

    it(`should allow application/typescript`, () => {
      expect(isAllowedMimeType(`application/typescript`)).toBe(true)
    })

    it(`should allow application/pdf`, () => {
      expect(isAllowedMimeType(`application/pdf`)).toBe(true)
    })

    it(`should allow application/vnd.openxmlformats docx`, () => {
      expect(
        isAllowedMimeType(
          `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
        )
      ).toBe(true)
    })
  })

  describe(`rejected types`, () => {
    it(`should reject application/octet-stream`, () => {
      expect(isAllowedMimeType(`application/octet-stream`)).toBe(false)
    })

    it(`should reject audio/* mime types`, () => {
      expect(isAllowedMimeType(`audio/mpeg`)).toBe(false)
      expect(isAllowedMimeType(`audio/wav`)).toBe(false)
    })

    it(`should reject video/* mime types`, () => {
      expect(isAllowedMimeType(`video/mp4`)).toBe(false)
      expect(isAllowedMimeType(`video/webm`)).toBe(false)
    })

    it(`should reject application/zip`, () => {
      expect(isAllowedMimeType(`application/zip`)).toBe(false)
    })

    it(`should reject empty string`, () => {
      expect(isAllowedMimeType(``)).toBe(false)
    })

    it(`should reject arbitrary strings`, () => {
      expect(isAllowedMimeType(`not-a-mime-type`)).toBe(false)
    })
  })
})
