/**
 * IndexedDB Persistence Tests
 * Tests browser-specific persistent storage (jsdom environment only)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Skip these tests in Node environment
const describeIfBrowser = global.testUtils?.isBrowser ? describe : describe.skip

describeIfBrowser('IndexedDB FileSystem', () => {
  const DB_NAME = 'shell-test-fs'
  const STORE_NAME = 'files'
  let db: IDBDatabase | null = null

  beforeEach(async () => {
    // Open IndexedDB connection
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'path' })
        }
      }
    })
  })

  afterEach(async () => {
    if (db) {
      db.close()
      db = null
    }

    // Delete test database
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })

  describe('Database Initialization', () => {
    it('should create IndexedDB database', () => {
      expect(db).toBeDefined()
      expect(db?.name).toBe(DB_NAME)
    })

    it('should create object store', () => {
      expect(db?.objectStoreNames.contains(STORE_NAME)).toBe(true)
    })

    it('should handle database version', () => {
      expect(db?.version).toBe(1)
    })
  })

  describe('File Storage', () => {
    it('should store file in IndexedDB', async () => {
      const file = {
        path: '/test.txt',
        content: 'Test content',
        timestamp: Date.now(),
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(file)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Verify file was stored
      const stored = await new Promise<any>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get('/test.txt')

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      expect(stored.path).toBe('/test.txt')
      expect(stored.content).toBe('Test content')
    })

    it('should update existing file', async () => {
      const file = {
        path: '/update.txt',
        content: 'Original',
        timestamp: Date.now(),
      }

      // Add file
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(file)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Update file
      file.content = 'Updated'
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put(file)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Verify update
      const stored = await new Promise<any>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get('/update.txt')

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      expect(stored.content).toBe('Updated')
    })

    it('should delete file from storage', async () => {
      const file = {
        path: '/delete.txt',
        content: 'Delete me',
        timestamp: Date.now(),
      }

      // Add file
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(file)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Delete file
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete('/delete.txt')

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Verify deletion
      const stored = await new Promise<any>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get('/delete.txt')

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      expect(stored).toBeUndefined()
    })
  })

  describe('Multiple Files', () => {
    it('should store multiple files', async () => {
      const files = [
        { path: '/file1.txt', content: 'Content 1', timestamp: Date.now() },
        { path: '/file2.txt', content: 'Content 2', timestamp: Date.now() },
        { path: '/file3.txt', content: 'Content 3', timestamp: Date.now() },
      ]

      for (const file of files) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db!.transaction([STORE_NAME], 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.add(file)

          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      // Count stored files
      const count = await new Promise<number>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.count()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      expect(count).toBe(3)
    })

    it('should list all files', async () => {
      const files = [
        { path: '/a.txt', content: 'A', timestamp: Date.now() },
        { path: '/b.txt', content: 'B', timestamp: Date.now() },
      ]

      for (const file of files) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db!.transaction([STORE_NAME], 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.add(file)

          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      const allFiles = await new Promise<any[]>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      expect(allFiles).toHaveLength(2)
      expect(allFiles.map(f => f.path)).toContain('/a.txt')
      expect(allFiles.map(f => f.path)).toContain('/b.txt')
    })
  })

  describe('Binary Data', () => {
    it('should store binary data', async () => {
      const buffer = new Uint8Array([0x00, 0x01, 0x02, 0x03])
      const file = {
        path: '/binary.bin',
        content: buffer,
        timestamp: Date.now(),
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(file)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      const stored = await new Promise<any>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get('/binary.bin')

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      // Compare arrays element by element since toEqual may fail on Uint8Array
      expect(Array.from(stored.content)).toEqual(Array.from(buffer))
    })
  })

  describe('Transaction Handling', () => {
    it('should handle transaction rollback on error', async () => {
      const file = {
        path: '/error.txt',
        content: 'Content',
        timestamp: Date.now(),
      }

      // Add file first
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(file)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Try to add duplicate (should fail)
      const addedDuplicate = await new Promise<boolean>((resolve) => {
        const transaction = db!.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(file)

        request.onsuccess = () => resolve(true)
        request.onerror = () => resolve(false)
      })

      expect(addedDuplicate).toBe(false)
    })
  })

  describe('Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const start = performance.now()

      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `/perf${i}.txt`,
        content: `Content ${i}`,
        timestamp: Date.now(),
      }))

      for (const file of files) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db!.transaction([STORE_NAME], 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.add(file)

          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      const duration = performance.now() - start
      expect(duration).toBeLessThan(500)
    })
  })
})
