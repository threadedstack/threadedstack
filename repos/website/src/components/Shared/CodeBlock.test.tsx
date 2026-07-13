import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const codeToHtml = vi.fn()
vi.mock('shiki', () => ({
  codeToHtml: (...args: unknown[]) => codeToHtml(...args),
}))

import CodeBlock from './CodeBlock'

describe('CodeBlock', () => {
  beforeEach(() => {
    codeToHtml.mockReset()
  })

  it('renders shiki output for a recognized language', async () => {
    codeToHtml.mockResolvedValue('<pre><code>const x = 1</code></pre>')

    const { container } = render(
      <CodeBlock
        code='const x = 1'
        language='typescript'
      />
    )

    await waitFor(() => {
      expect(container.querySelector('code')).toHaveTextContent('const x = 1')
    })

    expect(codeToHtml).toHaveBeenCalledWith('const x = 1', {
      lang: 'typescript',
      theme: 'github-dark',
    })
  })

  it('falls back to the text grammar instead of rendering blank when the language is unrecognized', async () => {
    codeToHtml.mockImplementation((_code: string, opts: { lang: string }) => {
      if (opts.lang !== 'text') {
        return Promise.reject(
          new Error(`Language '${opts.lang}' is not included in this bundle`)
        )
      }
      return Promise.resolve('<pre><code>fallback rendered</code></pre>')
    })

    const { container } = render(
      <CodeBlock
        code='some content'
        language='tdsk-author-secret'
      />
    )

    await waitFor(() => {
      expect(container.querySelector('code')).toHaveTextContent('fallback rendered')
    })

    expect(codeToHtml).toHaveBeenCalledWith('some content', {
      lang: 'tdsk-author-secret',
      theme: 'github-dark',
    })
    expect(codeToHtml).toHaveBeenCalledWith('some content', {
      lang: 'text',
      theme: 'github-dark',
    })
  })

  it('shows the language label from props', async () => {
    codeToHtml.mockResolvedValue('<pre><code>x</code></pre>')

    const { getByText } = render(
      <CodeBlock
        code='x'
        language='python'
      />
    )

    await waitFor(() => {
      expect(getByText('python')).toBeInTheDocument()
    })
  })
})
