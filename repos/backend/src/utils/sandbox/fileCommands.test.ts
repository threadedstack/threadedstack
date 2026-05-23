import { describe, it, expect } from 'vitest'
import { Exception } from '@tdsk/domain'
import { validateFileChange, buildFileCommand, isMutatingOp } from './fileCommands'

describe(`validateFileChange`, () => {
  it(`throws 400 for null input`, () => {
    expect(() => validateFileChange(null as any)).toThrow(Exception)
    try {
      validateFileChange(null as any)
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`fileChange is required`)
    }
  })

  it(`throws 400 for non-object input`, () => {
    expect(() => validateFileChange(`string` as any)).toThrow(Exception)
    try {
      validateFileChange(`string` as any)
    } catch (err) {
      expect((err as Exception).status).toBe(400)
    }
  })

  it(`throws 400 for invalid op`, () => {
    expect(() => validateFileChange({ op: `invalid`, path: `/test` })).toThrow(Exception)
    try {
      validateFileChange({ op: `invalid`, path: `/test` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`fileChange.op must be one of`)
    }
  })

  it(`throws 400 for missing op`, () => {
    expect(() => validateFileChange({ path: `/test` })).toThrow(Exception)
    try {
      validateFileChange({ path: `/test` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
    }
  })

  it(`throws 400 for missing path`, () => {
    expect(() => validateFileChange({ op: `list` })).toThrow(Exception)
    try {
      validateFileChange({ op: `list` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`fileChange.path is required`)
    }
  })

  it(`throws 400 for non-string path`, () => {
    expect(() => validateFileChange({ op: `list`, path: 123 })).toThrow(Exception)
    try {
      validateFileChange({ op: `list`, path: 123 })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
    }
  })

  it(`throws 400 for null byte in path`, () => {
    expect(() => validateFileChange({ op: `list`, path: `/test\0evil` })).toThrow(
      Exception
    )
    try {
      validateFileChange({ op: `list`, path: `/test\0evil` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`invalid characters`)
    }
  })

  it(`throws 400 for path traversal`, () => {
    expect(() => validateFileChange({ op: `list`, path: `/test/../etc/passwd` })).toThrow(
      Exception
    )
    try {
      validateFileChange({ op: `list`, path: `/test/../etc/passwd` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`path traversal`)
    }
  })

  it(`throws 400 for embedded path traversal`, () => {
    expect(() => validateFileChange({ op: `read`, path: `foo/../bar` })).toThrow(
      Exception
    )
    try {
      validateFileChange({ op: `read`, path: `foo/../bar` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`path traversal`)
    }
  })

  it(`throws 400 for create without entryType`, () => {
    expect(() => validateFileChange({ op: `create`, path: `/test` })).toThrow(Exception)
    try {
      validateFileChange({ op: `create`, path: `/test` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`entryType must be 'file' or 'folder'`)
    }
  })

  it(`throws 400 for delete without entryType`, () => {
    expect(() => validateFileChange({ op: `delete`, path: `/test` })).toThrow(Exception)
    try {
      validateFileChange({ op: `delete`, path: `/test` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
    }
  })

  it(`throws 400 for create with invalid entryType`, () => {
    expect(() =>
      validateFileChange({ op: `create`, path: `/test`, entryType: `symlink` })
    ).toThrow(Exception)
    try {
      validateFileChange({ op: `create`, path: `/test`, entryType: `symlink` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
    }
  })

  it(`throws 400 for write without content`, () => {
    expect(() => validateFileChange({ op: `write`, path: `/test` })).toThrow(Exception)
    try {
      validateFileChange({ op: `write`, path: `/test` })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`content is required`)
    }
  })

  it(`throws 400 for write with non-string content`, () => {
    expect(() =>
      validateFileChange({ op: `write`, path: `/test`, content: 123 })
    ).toThrow(Exception)
    try {
      validateFileChange({ op: `write`, path: `/test`, content: 123 })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
    }
  })

  it(`throws 400 for write with content exceeding 2MB`, () => {
    const oversized = `x`.repeat(2 * 1024 * 1024 + 1)
    expect(() =>
      validateFileChange({ op: `write`, path: `/test`, content: oversized })
    ).toThrow(Exception)
    try {
      validateFileChange({ op: `write`, path: `/test`, content: oversized })
    } catch (err) {
      expect((err as Exception).status).toBe(400)
      expect((err as Exception).message).toContain(`exceeds maximum size`)
    }
  })

  it(`accepts write with content exactly at 2MB limit`, () => {
    const exactly2MB = `x`.repeat(2 * 1024 * 1024)
    expect(() =>
      validateFileChange({ op: `write`, path: `/test`, content: exactly2MB })
    ).not.toThrow()
  })

  it(`accepts all valid read-only ops`, () => {
    expect(() => validateFileChange({ op: `list`, path: `/home/user` })).not.toThrow()
    expect(() => validateFileChange({ op: `read`, path: `/file.txt` })).not.toThrow()
    expect(() => validateFileChange({ op: `size`, path: `/file.txt` })).not.toThrow()
    expect(() => validateFileChange({ op: `exists`, path: `/file.txt` })).not.toThrow()
  })

  it(`accepts create with entryType file`, () => {
    expect(() =>
      validateFileChange({ op: `create`, path: `/test`, entryType: `file` })
    ).not.toThrow()
  })

  it(`accepts create with entryType folder`, () => {
    expect(() =>
      validateFileChange({ op: `create`, path: `/dir`, entryType: `folder` })
    ).not.toThrow()
  })

  it(`accepts delete with entryType file`, () => {
    expect(() =>
      validateFileChange({ op: `delete`, path: `/test`, entryType: `file` })
    ).not.toThrow()
  })

  it(`accepts write with valid content`, () => {
    expect(() =>
      validateFileChange({ op: `write`, path: `/test`, content: `hello` })
    ).not.toThrow()
  })
})

describe(`buildFileCommand`, () => {
  it(`list op returns ls with correct args`, () => {
    const result = buildFileCommand({ op: `list`, path: `/home/user` } as any)
    expect(result).toEqual({ command: `ls`, args: [`-1aF`, `--`, `'/home/user'`] })
  })

  it(`read op returns cat with correct args`, () => {
    const result = buildFileCommand({ op: `read`, path: `/file.txt` } as any)
    expect(result).toEqual({ command: `cat`, args: [`--`, `'/file.txt'`] })
  })

  it(`write op base64 encodes content`, () => {
    const result = buildFileCommand({
      op: `write`,
      path: `/file.txt`,
      content: `hello`,
    } as any)
    expect(result.command).toBe(`printf`)
    expect(result.args[1]).toBe(`aGVsbG8=`)
  })

  it(`create file returns touch with correct args`, () => {
    const result = buildFileCommand({
      op: `create`,
      path: `/file.txt`,
      entryType: `file`,
    } as any)
    expect(result).toEqual({ command: `touch`, args: [`--`, `'/file.txt'`] })
  })

  it(`create folder returns mkdir with correct args`, () => {
    const result = buildFileCommand({
      op: `create`,
      path: `/dir`,
      entryType: `folder`,
    } as any)
    expect(result).toEqual({ command: `mkdir`, args: [`-p`, `--`, `'/dir'`] })
  })

  it(`delete file returns rm -f`, () => {
    const result = buildFileCommand({
      op: `delete`,
      path: `/file.txt`,
      entryType: `file`,
    } as any)
    expect(result).toEqual({ command: `rm`, args: [`-f`, `--`, `'/file.txt'`] })
  })

  it(`delete folder returns rm -rf`, () => {
    const result = buildFileCommand({
      op: `delete`,
      path: `/dir`,
      entryType: `folder`,
    } as any)
    expect(result).toEqual({ command: `rm`, args: [`-rf`, `--`, `'/dir'`] })
  })

  it(`exists op returns test -e`, () => {
    const result = buildFileCommand({ op: `exists`, path: `/file.txt` } as any)
    expect(result).toEqual({ command: `test`, args: [`-e`, `'/file.txt'`] })
  })

  it(`size op returns wc -c`, () => {
    const result = buildFileCommand({ op: `size`, path: `/file.txt` } as any)
    expect(result).toEqual({ command: `wc`, args: [`-c`, `--`, `'/file.txt'`] })
  })

  it(`path with single quotes is properly shell-quoted`, () => {
    const result = buildFileCommand({ op: `read`, path: `/it's/a file` } as any)
    expect(result.args[1]).toBe(`'/it'\\''s/a file'`)
  })

  it(`path with spaces is properly quoted`, () => {
    const result = buildFileCommand({ op: `list`, path: `/my documents` } as any)
    expect(result.args[2]).toBe(`'/my documents'`)
  })
})

describe(`isMutatingOp`, () => {
  it(`create returns true`, () => {
    expect(isMutatingOp(`create`)).toBe(true)
  })

  it(`delete returns true`, () => {
    expect(isMutatingOp(`delete`)).toBe(true)
  })

  it(`write returns true`, () => {
    expect(isMutatingOp(`write`)).toBe(true)
  })

  it(`list returns false`, () => {
    expect(isMutatingOp(`list`)).toBe(false)
  })

  it(`read returns false`, () => {
    expect(isMutatingOp(`read`)).toBe(false)
  })

  it(`exists returns false`, () => {
    expect(isMutatingOp(`exists`)).toBe(false)
  })

  it(`size returns false`, () => {
    expect(isMutatingOp(`size`)).toBe(false)
  })
})
