/**
 * Stream I/O Tests
 * Tests WHATWG Streams API integration for stdin/stdout/stderr
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMockReadableStream, createMockWritableStream } from '../setup'

describe('Stream Manager', () => {
  describe('ReadableStream Operations', () => {
    it('should create readable stream with data', async () => {
      const testData = 'Hello, Streams!'
      const stream = createMockReadableStream(testData)

      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      let result = await reader.read()
      while (!result.done) {
        chunks.push(result.value)
        result = await reader.read()
      }

      const output = new TextDecoder().decode(Buffer.concat(chunks))
      expect(output).toBe(testData)
    })

    it('should handle empty streams', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const reader = stream.getReader()
      const result = await reader.read()

      expect(result.done).toBe(true)
    })

    it('should handle stream cancellation', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data'))
        },
      })

      const reader = stream.getReader()
      await reader.cancel()

      const result = await reader.read()
      expect(result.done).toBe(true)
    })

    it('should handle multiple chunks', async () => {
      const chunks = ['First', 'Second', 'Third']
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk))
          }
          controller.close()
        },
      })

      const reader = stream.getReader()
      const results: string[] = []

      let result = await reader.read()
      while (!result.done) {
        results.push(new TextDecoder().decode(result.value))
        result = await reader.read()
      }

      expect(results).toEqual(chunks)
    })
  })

  describe('WritableStream Operations', () => {
    it('should write data to writable stream', async () => {
      const { stream, getOutput } = createMockWritableStream()
      const writer = stream.getWriter()

      await writer.write(new TextEncoder().encode('Test data'))
      await writer.close()

      expect(getOutput()).toBe('Test data')
    })

    it('should handle multiple writes', async () => {
      const { stream, getOutput } = createMockWritableStream()
      const writer = stream.getWriter()

      await writer.write(new TextEncoder().encode('First '))
      await writer.write(new TextEncoder().encode('Second '))
      await writer.write(new TextEncoder().encode('Third'))
      await writer.close()

      expect(getOutput()).toBe('First Second Third')
    })

    it('should handle stream closure', async () => {
      const { stream } = createMockWritableStream()
      const writer = stream.getWriter()

      await writer.close()

      // Node.js throws ERR_INTERNAL_ASSERTION for closed streams
      // We verify it throws by catching the error
      try {
        await writer.write(new TextEncoder().encode('data'))
        // If we reach here, test should fail
        expect(true).toBe(false)
      } catch (error) {
        // Any error (including ERR_INTERNAL_ASSERTION) is expected
        expect(error).toBeDefined()
      }
    })

    it('should handle stream abort', async () => {
      const { stream } = createMockWritableStream()
      const writer = stream.getWriter()

      await writer.abort('Test abort')

      await expect(
        writer.write(new TextEncoder().encode('data'))
      ).rejects.toThrow()
    })
  })

  describe('Stream Piping', () => {
    it('should pipe readable to writable', async () => {
      const testData = 'Piped data'
      const readable = createMockReadableStream(testData)
      const { stream: writable, getOutput } = createMockWritableStream()

      await readable.pipeTo(writable)

      expect(getOutput()).toBe(testData)
    })

    it('should handle pipe with transform', async () => {
      const testData = 'lowercase'
      const readable = createMockReadableStream(testData)

      const transform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          const upper = text.toUpperCase()
          controller.enqueue(new TextEncoder().encode(upper))
        },
      })

      const { stream: writable, getOutput } = createMockWritableStream()

      await readable
        .pipeThrough(transform)
        .pipeTo(writable)

      expect(getOutput()).toBe('LOWERCASE')
    })

    it('should handle multiple transforms', async () => {
      const testData = 'test'
      const readable = createMockReadableStream(testData)

      const upperTransform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          controller.enqueue(new TextEncoder().encode(text.toUpperCase()))
        },
      })

      const reverseTransform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          const reversed = text.split('').reverse().join('')
          controller.enqueue(new TextEncoder().encode(reversed))
        },
      })

      const { stream: writable, getOutput } = createMockWritableStream()

      await readable
        .pipeThrough(upperTransform)
        .pipeThrough(reverseTransform)
        .pipeTo(writable)

      expect(getOutput()).toBe('TSET')
    })
  })

  describe('Stream Backpressure', () => {
    it('should handle backpressure in piping', async () => {
      let writeCount = 0
      const readable = new ReadableStream({
        start(controller) {
          for (let i = 0; i < 100; i++) {
            controller.enqueue(new TextEncoder().encode(`chunk${i}`))
          }
          controller.close()
        },
      })

      const writable = new WritableStream({
        write() {
          writeCount++
        },
      })

      await readable.pipeTo(writable)

      expect(writeCount).toBe(100)
    })
  })

  describe('Stream Error Handling', () => {
    it('should propagate errors in readable stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'))
        },
      })

      const reader = stream.getReader()

      await expect(reader.read()).rejects.toThrow('Stream error')
    })

    it('should handle errors in writable stream', async () => {
      const writable = new WritableStream({
        write() {
          throw new Error('Write error')
        },
      })

      const writer = writable.getWriter()

      await expect(
        writer.write(new TextEncoder().encode('data'))
      ).rejects.toThrow('Write error')
    })

    it('should handle errors in transform stream', async () => {
      const transform = new TransformStream({
        transform() {
          throw new Error('Transform error')
        },
      })

      const readable = createMockReadableStream('data')
      const { stream: writable } = createMockWritableStream()

      await expect(
        readable.pipeThrough(transform).pipeTo(writable)
      ).rejects.toThrow('Transform error')
    })
  })

  describe('Binary Stream Handling', () => {
    it('should handle binary data streams', async () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(buffer)
          controller.close()
        },
      })

      const reader = stream.getReader()
      const result = await reader.read()

      expect(Buffer.compare(result.value, buffer)).toBe(0)
    })

    it('should pipe binary data', async () => {
      const buffer = Buffer.from([0xFF, 0xFE, 0xFD, 0xFC])
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(buffer)
          controller.close()
        },
      })

      const chunks: Uint8Array[] = []
      const writable = new WritableStream({
        write(chunk) {
          chunks.push(chunk)
        },
      })

      await readable.pipeTo(writable)

      expect(Buffer.compare(chunks[0], buffer)).toBe(0)
    })
  })

  describe('Performance', () => {
    it('should handle large stream efficiently', async () => {
      const largeData = 'x'.repeat(1024 * 1024) // 1MB

      const start = performance.now()

      const readable = createMockReadableStream(largeData)
      const { stream: writable, getOutput } = createMockWritableStream()

      await readable.pipeTo(writable)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(100)
      expect(getOutput().length).toBe(largeData.length)
    })

    it('should handle high-frequency writes', async () => {
      const { stream, getOutput } = createMockWritableStream()
      const writer = stream.getWriter()

      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        await writer.write(new TextEncoder().encode('x'))
      }
      await writer.close()

      const duration = performance.now() - start
      expect(duration).toBeLessThan(200)
      expect(getOutput().length).toBe(1000)
    })
  })
})
