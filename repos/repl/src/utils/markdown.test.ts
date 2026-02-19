import { describe, it, expect } from 'vitest'
import { renderMarkdown, StreamingMarkdownBuffer } from './markdown'

describe('renderMarkdown', () => {
  it('renders plain text', () => {
    const result = renderMarkdown('Hello world')
    expect(result).toContain('Hello world')
  })

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconsole.log("hi")\n```')
    expect(result).toContain('console')
  })

  it('renders headers', () => {
    const result = renderMarkdown('# Title')
    expect(result).toContain('Title')
  })
})

describe('StreamingMarkdownBuffer', () => {
  it('buffers tokens until a block boundary', () => {
    const buf = new StreamingMarkdownBuffer()
    buf.append('Hello ')
    buf.append('world\n\n')
    const flushed = buf.flush()
    expect(flushed).toContain('Hello world')
  })

  it('flushAll renders remaining buffer', () => {
    const buf = new StreamingMarkdownBuffer()
    buf.append('partial text')
    const flushed = buf.flushAll()
    expect(flushed).toContain('partial text')
  })
})
