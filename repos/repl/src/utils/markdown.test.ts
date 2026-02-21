import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown'

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
