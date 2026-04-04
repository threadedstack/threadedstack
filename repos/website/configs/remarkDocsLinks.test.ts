import { describe, it, expect } from 'vitest'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { remarkDocsLinks } from './remarkDocsLinks'
import path from 'node:path'

const docsRoot = path.resolve(__dirname, '..', '..', '..', 'docs')

function process(markdown: string, filePath: string) {
  const file = remark()
    .use(remarkGfm)
    .use(remarkDocsLinks, { docsRoot })
    .processSync({ value: markdown, path: filePath })
  return String(file)
}

describe('remarkDocsLinks', () => {
  it('rewrites relative .md links to /docs/ routes', () => {
    const input = '[Billing](../features/billing.md)'
    const result = process(
      input,
      path.join(docsRoot, 'architecture/platform-overview.md')
    )
    expect(result).toContain('/docs/features/billing')
  })

  it('rewrites relative .mdx links to /docs/ routes', () => {
    const input = '[Agents](agents.mdx)'
    const result = process(input, path.join(docsRoot, 'features/agents.md'))
    expect(result).toContain('/docs/features/agents')
  })

  it('does not rewrite absolute http links', () => {
    const input = '[External](https://example.com/docs/foo.md)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('https://example.com/docs/foo.md')
  })

  it('does not rewrite anchor-only links', () => {
    const input = '[Section](#overview)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('#overview')
  })

  it('rewrites relative image paths to /docs-assets/ absolute paths', () => {
    const input = '![Screenshot](images/01-home.png)'
    const result = process(input, path.join(docsRoot, 'features/proxy-endpoints.md'))
    expect(result).toContain('/docs-assets/features/images/01-home.png')
  })

  it('does not rewrite absolute image URLs', () => {
    const input = '![Logo](https://example.com/logo.png)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('https://example.com/logo.png')
  })

  it('handles links from index.md at docs root', () => {
    const input = '[Overview](architecture/platform-overview.md)'
    const result = process(input, path.join(docsRoot, 'index.md'))
    expect(result).toContain('/docs/architecture/platform-overview')
  })

  it('preserves anchor fragments on .md links', () => {
    const input = '[Pricing](../features/billing.md#pricing-tiers)'
    const result = process(
      input,
      path.join(docsRoot, 'architecture/platform-overview.md')
    )
    expect(result).toContain('/docs/features/billing#pricing-tiers')
  })

  it('does not rewrite relative links to non-markdown files', () => {
    const input = '[Schema](./openapi.json)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('./openapi.json')
  })

  it('does not rewrite root-relative links', () => {
    const input = '[Page](/docs/architecture/overview.md)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('/docs/architecture/overview.md')
  })

  it('does not rewrite root-relative image paths', () => {
    const input = '![Logo](/images/logo.png)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('/images/logo.png')
  })
})
