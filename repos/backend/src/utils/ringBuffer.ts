export class RingBuffer {
  private chunks: Buffer[] = []
  private totalSize = 0
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get size(): number {
    return this.totalSize
  }

  write(data: Buffer) {
    this.chunks.push(data)
    this.totalSize += data.length

    while (this.totalSize > this.maxSize && this.chunks.length > 1) {
      const evicted = this.chunks.shift()!
      this.totalSize -= evicted.length
    }

    if (this.totalSize > this.maxSize && this.chunks.length === 1) {
      const chunk = this.chunks[0]
      const excess = this.totalSize - this.maxSize
      this.chunks[0] = chunk.subarray(excess)
      this.totalSize = this.chunks[0].length
    }
  }

  drain(): Buffer {
    const result = Buffer.concat(this.chunks)
    this.clear()
    return result
  }

  clear() {
    this.chunks = []
    this.totalSize = 0
  }
}
