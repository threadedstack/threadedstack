import { describe, it, expect } from 'vitest'
import { RingBuffer } from './ringBuffer'

describe('RingBuffer', () => {
  it('stores and drains data', () => {
    const buf = new RingBuffer(1024)
    buf.write(Buffer.from('hello'))
    buf.write(Buffer.from(' world'))
    const result = buf.drain()
    expect(result.toString()).toBe('hello world')
  })

  it('evicts oldest data when full', () => {
    const buf = new RingBuffer(10) // 10 bytes
    buf.write(Buffer.from('12345'))
    buf.write(Buffer.from('67890'))
    buf.write(Buffer.from('ABCDE'))
    const result = buf.drain()
    // Only last 10 bytes fit
    expect(result.length).toBeLessThanOrEqual(10)
    expect(result.toString()).toContain('ABCDE')
  })

  it('returns empty buffer when nothing written', () => {
    const buf = new RingBuffer(1024)
    const result = buf.drain()
    expect(result.length).toBe(0)
  })

  it('clears after drain', () => {
    const buf = new RingBuffer(1024)
    buf.write(Buffer.from('data'))
    buf.drain()
    const result = buf.drain()
    expect(result.length).toBe(0)
  })

  it('reports size correctly', () => {
    const buf = new RingBuffer(1024)
    expect(buf.size).toBe(0)
    buf.write(Buffer.from('hello'))
    expect(buf.size).toBe(5)
  })

  it('clears without draining', () => {
    const buf = new RingBuffer(1024)
    buf.write(Buffer.from('data'))
    buf.clear()
    expect(buf.size).toBe(0)
  })
})
