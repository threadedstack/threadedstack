import { describe, it, expect } from 'vitest'
import { parseShellControlMsg } from './parseControlMsg'

describe('parseShellControlMsg', () => {
  // -------------------------------------------------------------------------
  // resize
  // -------------------------------------------------------------------------
  describe('resize', () => {
    it('returns typed message for valid integer cols/rows', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'resize', cols: 80, rows: 24 })
      )
      expect(msg).toEqual({ type: 'resize', cols: 80, rows: 24 })
    })

    it('returns null when cols is 0', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'resize', cols: 0, rows: 24 })
      )
      expect(msg).toBeNull()
    })

    it('returns null when cols is negative', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'resize', cols: -1, rows: 24 })
      )
      expect(msg).toBeNull()
    })

    it('returns null when cols exceeds 500', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'resize', cols: 501, rows: 24 })
      )
      expect(msg).toBeNull()
    })

    it('returns null when cols is a float', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'resize', cols: 80.5, rows: 24 })
      )
      expect(msg).toBeNull()
    })

    it('returns null when rows is 0', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'resize', cols: 80, rows: 0 })
      )
      expect(msg).toBeNull()
    })

    it('accepts cols/rows at boundary (1 and 500)', () => {
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'resize', cols: 1, rows: 1 }))
      ).toEqual({
        type: 'resize',
        cols: 1,
        rows: 1,
      })
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'resize', cols: 500, rows: 500 }))
      ).toEqual({ type: 'resize', cols: 500, rows: 500 })
    })
  })

  // -------------------------------------------------------------------------
  // signal
  // -------------------------------------------------------------------------
  describe('signal', () => {
    it('returns typed message for SIGINT', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'signal', signal: 'SIGINT' })
      )
      expect(msg).toEqual({ type: 'signal', signal: 'SIGINT' })
    })

    it('returns typed message for SIGTSTP', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'signal', signal: 'SIGTSTP' })
      )
      expect(msg).toEqual({ type: 'signal', signal: 'SIGTSTP' })
    })

    it('returns null for invalid signal value', () => {
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'signal', signal: 'SIGKILL' }))
      ).toBeNull()
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'signal', signal: 'sigint' }))
      ).toBeNull()
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'signal', signal: 42 }))
      ).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // visibility
  // -------------------------------------------------------------------------
  describe('visibility', () => {
    it('returns typed message for private', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'visibility', visibility: 'private' })
      )
      expect(msg).toEqual({ type: 'visibility', visibility: 'private' })
    })

    it('returns typed message for public', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'visibility', visibility: 'public' })
      )
      expect(msg).toEqual({ type: 'visibility', visibility: 'public' })
    })

    it('returns null for invalid visibility value', () => {
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'visibility', visibility: 'shared' }))
      ).toBeNull()
      expect(
        parseShellControlMsg(JSON.stringify({ type: 'visibility', visibility: 123 }))
      ).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // permission-response
  // -------------------------------------------------------------------------
  describe('permission-response', () => {
    it('returns typed message for y', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'permission-response', response: 'y' })
      )
      expect(msg).toEqual({ type: 'permission-response', response: 'y' })
    })

    it('returns typed message for n', () => {
      const msg = parseShellControlMsg(
        JSON.stringify({ type: 'permission-response', response: 'n' })
      )
      expect(msg).toEqual({ type: 'permission-response', response: 'n' })
    })

    it('returns null for invalid permission-response value', () => {
      expect(
        parseShellControlMsg(
          JSON.stringify({ type: 'permission-response', response: 'yes' })
        )
      ).toBeNull()
      expect(
        parseShellControlMsg(
          JSON.stringify({ type: 'permission-response', response: true })
        )
      ).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // malformed / edge cases
  // -------------------------------------------------------------------------
  describe('malformed input', () => {
    it('returns null for unknown type field', () => {
      expect(parseShellControlMsg(JSON.stringify({ type: 'unknown' }))).toBeNull()
    })

    it('returns null for non-JSON string', () => {
      expect(parseShellControlMsg('not json at all')).toBeNull()
    })

    it('returns null for JSON array', () => {
      expect(parseShellControlMsg(JSON.stringify([1, 2, 3]))).toBeNull()
    })

    it('returns null for JSON null', () => {
      expect(parseShellControlMsg(JSON.stringify(null))).toBeNull()
    })

    it('returns null for object with no type field', () => {
      expect(parseShellControlMsg(JSON.stringify({ cols: 80, rows: 24 }))).toBeNull()
    })
  })
})
