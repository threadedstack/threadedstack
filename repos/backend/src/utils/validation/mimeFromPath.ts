const ExtensionMimeMap: Record<string, string> = {
  // Text
  '.txt': `text/plain`,
  '.html': `text/html`,
  '.htm': `text/html`,
  '.css': `text/css`,
  '.csv': `text/csv`,
  '.md': `text/markdown`,
  '.markdown': `text/markdown`,
  '.xml': `text/xml`,
  '.yaml': `text/yaml`,
  '.yml': `text/yaml`,
  '.log': `text/plain`,
  '.env': `text/plain`,

  // Code — JS/TS
  '.js': `application/javascript`,
  '.mjs': `application/javascript`,
  '.cjs': `application/javascript`,
  '.ts': `application/typescript`,
  '.mts': `application/typescript`,
  '.cts': `application/typescript`,
  '.tsx': `application/typescript`,
  '.jsx': `application/javascript`,
  '.json': `application/json`,

  // Code — other languages
  '.py': `text/x-python`,
  '.rb': `text/x-ruby`,
  '.go': `text/x-go`,
  '.rs': `text/x-rust`,
  '.java': `text/x-java`,
  '.c': `text/x-c`,
  '.h': `text/x-c`,
  '.cpp': `text/x-c++`,
  '.hpp': `text/x-c++`,
  '.sh': `application/x-sh`,
  '.bash': `application/x-sh`,
  '.zsh': `application/x-sh`,
  '.toml': `application/toml`,
  '.ini': `text/plain`,
  '.cfg': `text/plain`,

  // Documents
  '.pdf': `application/pdf`,
  '.docx': `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,

  // Images
  '.png': `image/png`,
  '.jpg': `image/jpeg`,
  '.jpeg': `image/jpeg`,
  '.gif': `image/gif`,
  '.svg': `image/svg+xml`,
  '.webp': `image/webp`,
  '.ico': `image/x-icon`,

  // Audio/Video/Binary (mapped so isAllowedMimeType can reject them)
  '.mp3': `audio/mpeg`,
  '.wav': `audio/wav`,
  '.mp4': `video/mp4`,
  '.webm': `video/webm`,
  '.zip': `application/zip`,
  '.gz': `application/gzip`,
  '.tar': `application/x-tar`,
  '.exe': `application/octet-stream`,
  '.bin': `application/octet-stream`,
  '.dll': `application/octet-stream`,
  '.so': `application/octet-stream`,
  '.wasm': `application/wasm`,
}

/**
 * Infer a MIME type from a file path's extension.
 * Returns `text/plain` for unknown extensions since WS file uploads
 * are text-based workspace files (binary uploads use the REST endpoint).
 */
export const mimeFromPath = (filePath: string): string => {
  const dot = filePath.lastIndexOf(`.`)
  if (dot === -1) return `text/plain`

  const ext = filePath.slice(dot).toLowerCase()
  return ExtensionMimeMap[ext] ?? `text/plain`
}
