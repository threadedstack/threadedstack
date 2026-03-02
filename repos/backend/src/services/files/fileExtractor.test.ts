import { describe, it, expect, vi } from 'vitest'
import { extractText, isImageMimeType } from './fileExtractor'

const MAX_EXTRACTED_LENGTH = 50_000

// ── extractText: text-based MIME types ──────────────────────────────

describe(`extractText`, () => {
  describe(`text/* MIME types`, () => {
    it(`should extract text/plain content`, async () => {
      const buf = Buffer.from(`Hello, world!`)
      const result = await extractText(buf, `text/plain`)
      expect(result).toEqual({ text: `Hello, world!` })
    })

    it(`should extract text/html content`, async () => {
      const html = `<h1>Title</h1><p>Body</p>`
      const buf = Buffer.from(html)
      const result = await extractText(buf, `text/html`)
      expect(result).toEqual({ text: html })
    })

    it(`should extract text/csv content`, async () => {
      const csv = `name,age\nAlice,30\nBob,25`
      const buf = Buffer.from(csv)
      const result = await extractText(buf, `text/csv`)
      expect(result).toEqual({ text: csv })
    })

    it(`should extract text/markdown content`, async () => {
      const md = `# Heading\n\nParagraph text.`
      const buf = Buffer.from(md)
      const result = await extractText(buf, `text/markdown`)
      expect(result).toEqual({ text: md })
    })
  })

  // ── extractText: application/* text-like types ──────────────────────

  describe(`application/* text-like types`, () => {
    it(`should extract application/json content`, async () => {
      const json = `{"key":"value","num":42}`
      const buf = Buffer.from(json)
      const result = await extractText(buf, `application/json`)
      expect(result).toEqual({ text: json })
    })

    it(`should extract application/xml content`, async () => {
      const xml = `<root><item>value</item></root>`
      const buf = Buffer.from(xml)
      const result = await extractText(buf, `application/xml`)
      expect(result).toEqual({ text: xml })
    })

    it(`should extract application/csv content`, async () => {
      const csv = `col1,col2\nval1,val2`
      const buf = Buffer.from(csv)
      const result = await extractText(buf, `application/csv`)
      expect(result).toEqual({ text: csv })
    })
  })

  // ── extractText: truncation ─────────────────────────────────────────

  describe(`truncation at MAX_EXTRACTED_LENGTH`, () => {
    it(`should truncate text exceeding 50000 characters`, async () => {
      const longText = `x`.repeat(MAX_EXTRACTED_LENGTH + 500)
      const buf = Buffer.from(longText)
      const result = await extractText(buf, `text/plain`)
      expect(result.text).toHaveLength(MAX_EXTRACTED_LENGTH)
      expect(result.text).toBe(`x`.repeat(MAX_EXTRACTED_LENGTH))
    })

    it(`should not truncate text at exactly 50000 characters`, async () => {
      const exactText = `a`.repeat(MAX_EXTRACTED_LENGTH)
      const buf = Buffer.from(exactText)
      const result = await extractText(buf, `text/plain`)
      expect(result.text).toHaveLength(MAX_EXTRACTED_LENGTH)
    })

    it(`should leave text shorter than 50000 characters unchanged`, async () => {
      const shortText = `short`
      const buf = Buffer.from(shortText)
      const result = await extractText(buf, `application/json`)
      expect(result.text).toBe(shortText)
    })
  })

  // ── extractText: PDF extraction ─────────────────────────────────────

  describe(`application/pdf`, () => {
    it(`should return MODULE_NOT_FOUND error when pdf-parse is unavailable`, async () => {
      const buf = Buffer.from(`fake-pdf-data`)
      const result = await extractText(buf, `application/pdf`)

      // pdf-parse is not installed in dev, so we expect the module-not-found error
      // OR a successful extraction if the package happens to be installed
      if (result.error) {
        expect(result.text).toBeNull()
        expect(result.error).toMatch(/pdf-parse/)
      } else {
        // If pdf-parse IS installed, we should get a text result (or null for invalid PDF)
        expect(result.text).toBeDefined()
      }
    })
  })

  // ── extractText: DOCX extraction ────────────────────────────────────

  describe(`DOCX MIME type`, () => {
    it(`should return MODULE_NOT_FOUND error when mammoth is unavailable`, async () => {
      const buf = Buffer.from(`fake-docx-data`)
      const result = await extractText(
        buf,
        `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
      )

      // mammoth is not installed in dev, so we expect the module-not-found error
      // OR a successful extraction if the package happens to be installed
      if (result.error) {
        expect(result.text).toBeNull()
        expect(result.error).toMatch(/mammoth/)
      } else {
        expect(result.text).toBeDefined()
      }
    })
  })

  // ── extractText: image types ────────────────────────────────────────

  describe(`image/* MIME types`, () => {
    it(`should return null text for image/png`, async () => {
      const buf = Buffer.from(`fake-image-data`)
      const result = await extractText(buf, `image/png`)
      expect(result).toEqual({ text: null })
    })

    it(`should return null text for image/jpeg`, async () => {
      const buf = Buffer.from(`fake-image-data`)
      const result = await extractText(buf, `image/jpeg`)
      expect(result).toEqual({ text: null })
    })

    it(`should return null text for image/gif`, async () => {
      const buf = Buffer.from(`fake-image-data`)
      const result = await extractText(buf, `image/gif`)
      expect(result).toEqual({ text: null })
    })

    it(`should return null text for image/webp`, async () => {
      const buf = Buffer.from(`fake-image-data`)
      const result = await extractText(buf, `image/webp`)
      expect(result).toEqual({ text: null })
    })

    it(`should not include an error for image types`, async () => {
      const buf = Buffer.from(`fake-image-data`)
      const result = await extractText(buf, `image/svg+xml`)
      expect(result.text).toBeNull()
      expect(result.error).toBeUndefined()
    })
  })

  // ── extractText: unsupported types ──────────────────────────────────

  describe(`unsupported MIME types`, () => {
    it(`should return null text with error for audio types`, async () => {
      const buf = Buffer.from(`fake-audio-data`)
      const result = await extractText(buf, `audio/mpeg`)
      expect(result.text).toBeNull()
      expect(result.error).toBe(`Unsupported file type: audio/mpeg`)
    })

    it(`should return null text with error for video types`, async () => {
      const buf = Buffer.from(`fake-video-data`)
      const result = await extractText(buf, `video/mp4`)
      expect(result.text).toBeNull()
      expect(result.error).toBe(`Unsupported file type: video/mp4`)
    })

    it(`should return null text with error for application/octet-stream`, async () => {
      const buf = Buffer.from(`binary-data`)
      const result = await extractText(buf, `application/octet-stream`)
      expect(result.text).toBeNull()
      expect(result.error).toBe(`Unsupported file type: application/octet-stream`)
    })

    it(`should return null text with error for application/zip`, async () => {
      const buf = Buffer.from(`zip-data`)
      const result = await extractText(buf, `application/zip`)
      expect(result.text).toBeNull()
      expect(result.error).toBe(`Unsupported file type: application/zip`)
    })
  })

  // ── extractText: edge cases ─────────────────────────────────────────

  describe(`edge cases`, () => {
    it(`should handle empty buffer for text types`, async () => {
      const buf = Buffer.from(``)
      const result = await extractText(buf, `text/plain`)
      expect(result).toEqual({ text: `` })
    })

    it(`should handle UTF-8 encoded content`, async () => {
      const utf8Text = `Hello \u00e9\u00e0\u00fc \u4f60\u597d \ud83d\ude00`
      const buf = Buffer.from(utf8Text, `utf-8`)
      const result = await extractText(buf, `text/plain`)
      expect(result.text).toBe(utf8Text)
    })
  })
})

// ── isImageMimeType ───────────────────────────────────────────────────

describe(`isImageMimeType`, () => {
  it(`should return true for image/png`, () => {
    expect(isImageMimeType(`image/png`)).toBe(true)
  })

  it(`should return true for image/jpeg`, () => {
    expect(isImageMimeType(`image/jpeg`)).toBe(true)
  })

  it(`should return true for image/gif`, () => {
    expect(isImageMimeType(`image/gif`)).toBe(true)
  })

  it(`should return true for image/webp`, () => {
    expect(isImageMimeType(`image/webp`)).toBe(true)
  })

  it(`should return true for image/svg+xml`, () => {
    expect(isImageMimeType(`image/svg+xml`)).toBe(true)
  })

  it(`should return false for text/plain`, () => {
    expect(isImageMimeType(`text/plain`)).toBe(false)
  })

  it(`should return false for application/json`, () => {
    expect(isImageMimeType(`application/json`)).toBe(false)
  })

  it(`should return false for application/pdf`, () => {
    expect(isImageMimeType(`application/pdf`)).toBe(false)
  })

  it(`should return false for audio/mpeg`, () => {
    expect(isImageMimeType(`audio/mpeg`)).toBe(false)
  })

  it(`should return false for video/mp4`, () => {
    expect(isImageMimeType(`video/mp4`)).toBe(false)
  })

  it(`should return false for empty string`, () => {
    expect(isImageMimeType(``)).toBe(false)
  })
})
