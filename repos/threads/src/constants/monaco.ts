/**
 * Monaco Editor Configuration Constants
 */

export const MonacoOptions = {
  fontSize: 14,
  automaticLayout: true,
  wordWrap: `on` as const,
  lineNumbers: `on` as const,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: `all` as const,
}

export const DefaultLines = [`// No content available for this file`]
