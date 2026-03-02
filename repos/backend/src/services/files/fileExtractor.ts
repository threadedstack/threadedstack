/**
 * File text extraction service.
 * Extracts readable text from various file formats.
 *
 * Text-based formats (text/*, JSON, CSV, markdown) are handled directly.
 * PDF and DOCX extraction require optional npm packages (pdf-parse, mammoth).
 * Image files are not extracted — they're passed as ImageContent to vision models.
 */

const MAX_EXTRACTED_LENGTH = 50_000

type TExtractionResult = {
  text: string | null
  error?: string
}

/**
 * Extract text content from a file buffer based on its MIME type.
 */
export const extractText = async (
  buffer: Buffer,
  mimeType: string
): Promise<TExtractionResult> => {
  // Text-based formats — direct passthrough
  if (
    mimeType.startsWith(`text/`) ||
    mimeType === `application/json` ||
    mimeType === `application/xml` ||
    mimeType === `application/csv` ||
    mimeType === `application/javascript` ||
    mimeType === `application/typescript`
  ) {
    const text = buffer.toString(`utf-8`).slice(0, MAX_EXTRACTED_LENGTH)
    return { text }
  }

  // PDF extraction
  if (mimeType === `application/pdf`) {
    return extractPdf(buffer)
  }

  // DOCX extraction
  if (
    mimeType === `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  ) {
    return extractDocx(buffer)
  }

  // Image files — no text extraction (handled as ImageContent by the agent)
  if (mimeType.startsWith(`image/`)) {
    return { text: null }
  }

  return { text: null, error: `Unsupported file type: ${mimeType}` }
}

/**
 * Dynamically import an optional package at runtime.
 * Uses a variable to prevent TypeScript from resolving the import statically.
 */
const tryRequire = async (pkg: string): Promise<any> => {
  const mod = await import(/* webpackIgnore: true */ pkg)
  return mod.default ?? mod
}

/**
 * Extract text from PDF using pdf-parse (optional dependency).
 */
const extractPdf = async (buffer: Buffer): Promise<TExtractionResult> => {
  try {
    const pdfParse = await tryRequire(`pdf-parse`)
    const result = await pdfParse(buffer)
    return { text: (result.text || ``).slice(0, MAX_EXTRACTED_LENGTH) }
  } catch (err: any) {
    if (err.code === `ERR_MODULE_NOT_FOUND` || err.code === `MODULE_NOT_FOUND`) {
      return { text: null, error: `PDF extraction requires the pdf-parse package` }
    }
    return { text: null, error: `PDF extraction failed: ${err.message}` }
  }
}

/**
 * Extract text from DOCX using mammoth (optional dependency).
 */
const extractDocx = async (buffer: Buffer): Promise<TExtractionResult> => {
  try {
    const mammoth = await tryRequire(`mammoth`)
    const result = await mammoth.extractRawText({ buffer })
    return { text: (result.value || ``).slice(0, MAX_EXTRACTED_LENGTH) }
  } catch (err: any) {
    if (err.code === `ERR_MODULE_NOT_FOUND` || err.code === `MODULE_NOT_FOUND`) {
      return { text: null, error: `DOCX extraction requires the mammoth package` }
    }
    return { text: null, error: `DOCX extraction failed: ${err.message}` }
  }
}

/**
 * Check if a MIME type represents an image file.
 */
export const isImageMimeType = (mimeType: string): boolean =>
  mimeType.startsWith(`image/`)
