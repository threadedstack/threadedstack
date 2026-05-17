/**
 * TODO: VALIDATE THIS - Should be able to import from `@tdsk/domain`
 * VT constants — duplicated from @tdsk/domain to avoid cross-package
 * runtime dependency that breaks Vite's browser module resolution.
 */
export const VTCellSize = 16

// --- Cell Flags bitmask constants ---
export const CellFlags = {
  BOLD: 0x01,
  ITALIC: 0x02,
  UNDERLINE: 0x04,
  STRIKETHROUGH: 0x08,
  INVERSE: 0x10,
  INVISIBLE: 0x20,
  BLINK: 0x40,
  FAINT: 0x80,
} as const
