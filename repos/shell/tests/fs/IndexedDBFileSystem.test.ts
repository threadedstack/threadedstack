/**
 * Tests for IndexedDBFileSystem
 * Tests filesystem interface implementation with IndexedDB backend
 * Runs in jsdom environment with fake-indexeddb
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IndexedDBFileSystem } from '../../src/fs/IndexedDBFileSystem'

describe('IndexedDBFileSystem', () => {
  let fs: IndexedDBFileSystem

  beforeEach(async () => {
    // Setup IndexedDB if not available (jsdom environment)
    if (typeof indexedDB === 'undefined') {
      const { IDBFactory } = await import('fake-indexeddb')
      ;(globalThis as any).indexedDB = new IDBFactory()
    }

    fs = new IndexedDBFileSystem({ dbName: 'test-fs' })
    await fs.initialize()
  })

  afterEach(async () => {
    await fs.close()
    // Clean up IndexedDB database
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase('test-fs')
    }
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newFs = new IndexedDBFileSystem({ dbName: 'test-init' })
      await expect(newFs.initialize()).resolves.toBeUndefined()
      await newFs.close()
    })

    it('should throw if IndexedDB is not available', async () => {
      delete (global as any).indexedDB
      const newFs = new IndexedDBFileSystem()
      await expect(newFs.initialize()).rejects.toThrow('IndexedDB is not available')
    })
  })

  describe('file operations', () => {
    it('should write and read a text file', async () => {
      const content = 'Hello, World!'
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/file.txt', content)

      const result = await fs.readFile('/test/file.txt')
      expect(result).toBe(content)
    })

    it('should write and read a binary file', async () => {
      const content = new Uint8Array([1, 2, 3, 4, 5])
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/binary.dat', content)

      const result = await fs.readFileBuffer('/test/binary.dat')
      expect(Array.from(result)).toEqual(Array.from(content))
    })

    it('should append to an existing file', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/append.txt', 'Line 1\n')
      await fs.appendFile('/test/append.txt', 'Line 2\n')

      const result = await fs.readFile('/test/append.txt')
      expect(result).toBe('Line 1\nLine 2\n')
    })

    it('should throw when reading non-existent file', async () => {
      await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow('ENOENT')
    })

    it('should throw when reading directory as file', async () => {
      await fs.mkdir('/test', { recursive: true })
      await expect(fs.readFile('/test')).rejects.toThrow('EISDIR')
    })
  })

  describe('directory operations', () => {
    it('should create a directory', async () => {
      await fs.mkdir('/test', { recursive: true })
      const exists = await fs.exists('/test')
      expect(exists).toBe(true)
    })

    it('should create nested directories with recursive flag', async () => {
      await fs.mkdir('/a/b/c', { recursive: true })

      expect(await fs.exists('/a')).toBe(true)
      expect(await fs.exists('/a/b')).toBe(true)
      expect(await fs.exists('/a/b/c')).toBe(true)
    })

    it('should throw when creating directory without recursive flag', async () => {
      await expect(fs.mkdir('/a/b/c')).rejects.toThrow('ENOENT')
    })

    it('should list directory contents', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/file1.txt', 'content1')
      await fs.writeFile('/test/file2.txt', 'content2')
      await fs.mkdir('/test/subdir', { recursive: true })

      const entries = await fs.readdir('/test')
      expect(entries).toEqual(expect.arrayContaining(['file1.txt', 'file2.txt', 'subdir']))
    }, 30000)

    it('should list directory with file types', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/file.txt', 'content')
      await fs.mkdir('/test/dir', { recursive: true })

      const entries = await fs.readdirWithFileTypes('/test')

      expect(entries).toHaveLength(2)
      expect(entries.find(e => e.name === 'file.txt')?.isFile).toBe(true)
      expect(entries.find(e => e.name === 'dir')?.isDirectory).toBe(true)
    }, 30000)
  })

  describe('stat operations', () => {
    it('should stat a file', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/file.txt', 'content')

      const stats = await fs.stat('/test/file.txt')

      expect(stats.isFile).toBe(true)
      expect(stats.isDirectory).toBe(false)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should stat a directory', async () => {
      await fs.mkdir('/test', { recursive: true })

      const stats = await fs.stat('/test')

      expect(stats.isFile).toBe(false)
      expect(stats.isDirectory).toBe(true)
    })

    it('should throw when statting non-existent path', async () => {
      await expect(fs.stat('/nonexistent')).rejects.toThrow('ENOENT')
    })
  })

  describe('path operations', () => {
    it('should resolve absolute paths', () => {
      const resolved = fs.resolvePath('/base', '/absolute/path')
      expect(resolved).toBe('/absolute/path')
    })

    it('should resolve relative paths', () => {
      const resolved = fs.resolvePath('/base/dir', 'file.txt')
      expect(resolved).toBe('/base/dir/file.txt')
    })

    it('should handle . and .. in paths', () => {
      const resolved = fs.resolvePath('/base', './dir/../file.txt')
      expect(resolved).toBe('/base/file.txt')
    })
  })

  describe('deletion operations', () => {
    it('should remove a file', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/file.txt', 'content')

      await fs.rm('/test/file.txt')

      expect(await fs.exists('/test/file.txt')).toBe(false)
    })

    it('should remove empty directory', async () => {
      await fs.mkdir('/test/empty', { recursive: true })

      await fs.rm('/test/empty')

      expect(await fs.exists('/test/empty')).toBe(false)
    }, 30000)

    it('should recursively remove directory', async () => {
      await fs.mkdir('/test/parent/child', { recursive: true })
      await fs.writeFile('/test/parent/file.txt', 'content')

      await fs.rm('/test/parent', { recursive: true })

      expect(await fs.exists('/test/parent')).toBe(false)
    }, 30000)

    it('should throw when removing non-empty directory without recursive', async () => {
      await fs.mkdir('/test/dir', { recursive: true })
      await fs.writeFile('/test/dir/file.txt', 'content')

      await expect(fs.rm('/test/dir')).rejects.toThrow('ENOTEMPTY')
    }, 30000)
  })

  describe('copy and move operations', () => {
    it('should copy a file', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/source.txt', 'content')

      await fs.cp('/test/source.txt', '/test/dest.txt')

      expect(await fs.readFile('/test/dest.txt')).toBe('content')
      expect(await fs.exists('/test/source.txt')).toBe(true)
    })

    it('should copy a directory recursively', async () => {
      await fs.mkdir('/test/source/sub', { recursive: true })
      await fs.writeFile('/test/source/file.txt', 'content')

      await fs.cp('/test/source', '/test/dest', { recursive: true })

      expect(await fs.exists('/test/dest/file.txt')).toBe(true)
      expect(await fs.readFile('/test/dest/file.txt')).toBe('content')
    }, 30000)

    it('should move a file', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/source.txt', 'content')

      await fs.mv('/test/source.txt', '/test/dest.txt')

      expect(await fs.exists('/test/dest.txt')).toBe(true)
      expect(await fs.exists('/test/source.txt')).toBe(false)
    })
  })

  describe('symlink operations', () => {
    it('should create and read symlink', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/target.txt', 'content')

      await fs.symlink('/test/target.txt', '/test/link.txt')

      const target = await fs.readlink('/test/link.txt')
      expect(target).toBe('/test/target.txt')
    })

    it('should follow symlink when reading', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/target.txt', 'content')
      await fs.symlink('/test/target.txt', '/test/link.txt')

      const content = await fs.readFile('/test/link.txt')
      expect(content).toBe('content')
    })

    it('should distinguish symlink with lstat', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/target.txt', 'content')
      await fs.symlink('/test/target.txt', '/test/link.txt')

      const lstatResult = await fs.lstat('/test/link.txt')
      const statResult = await fs.stat('/test/link.txt')

      expect(lstatResult.isSymbolicLink).toBe(true)
      expect(statResult.isSymbolicLink).toBe(false)
      expect(statResult.isFile).toBe(true)
    })
  })

  describe('permission operations', () => {
    it('should change file permissions', async () => {
      await fs.mkdir('/test', { recursive: true })
      await fs.writeFile('/test/file.txt', 'content')

      await fs.chmod('/test/file.txt', 0o755)

      const stats = await fs.stat('/test/file.txt')
      expect(stats.mode).toBe(0o755)
    })
  })

  describe('encoding support', () => {
    it('should support utf-8 encoding', async () => {
      await fs.mkdir('/test', { recursive: true })
      const content = 'Hello 世界 🌍'

      await fs.writeFile('/test/utf8.txt', content, 'utf-8')
      const result = await fs.readFile('/test/utf8.txt', 'utf-8')

      expect(result).toBe(content)
    })

    it('should support base64 encoding', async () => {
      await fs.mkdir('/test', { recursive: true })
      const base64Content = 'SGVsbG8gV29ybGQ='

      await fs.writeFile('/test/base64.txt', base64Content, 'base64')
      const result = await fs.readFile('/test/base64.txt', 'base64')

      expect(result).toBe(base64Content)
    })

    it('should support hex encoding', async () => {
      await fs.mkdir('/test', { recursive: true })
      const hexContent = '48656c6c6f'

      await fs.writeFile('/test/hex.txt', hexContent, 'hex')
      const result = await fs.readFile('/test/hex.txt', 'hex')

      expect(result).toBe(hexContent)
    })
  })
})
