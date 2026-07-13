import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('@TAF/utils/docsContent', () => ({
  allPages: [
    { path: '/docs/getting-started', label: 'Getting Started' },
    { path: '/docs/architecture', label: 'Architecture' },
    { path: '/docs/deployment', label: 'Deployment' },
  ],
}))

import DocsPrevNext from './DocsPrevNext'

const renderAt = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <DocsPrevNext />
    </MemoryRouter>
  )

describe('DocsPrevNext', () => {
  it('renders neither prev nor next on an unmatched/404 docs path', () => {
    const { container } = renderAt('/docs/this-page-does-not-exist')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('renders only next on the first page', () => {
    renderAt('/docs/getting-started')

    expect(
      screen.queryByRole('link', { name: /getting started/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /architecture/i })).toHaveAttribute(
      'href',
      '/docs/architecture'
    )
  })

  it('renders both prev and next on a middle page', () => {
    renderAt('/docs/architecture')

    expect(screen.getByRole('link', { name: /getting started/i })).toHaveAttribute(
      'href',
      '/docs/getting-started'
    )
    expect(screen.getByRole('link', { name: /deployment/i })).toHaveAttribute(
      'href',
      '/docs/deployment'
    )
  })

  it('renders only prev on the last page', () => {
    renderAt('/docs/deployment')

    expect(screen.getByRole('link', { name: /architecture/i })).toHaveAttribute(
      'href',
      '/docs/architecture'
    )
    expect(screen.queryByRole('link', { name: /^deployment$/i })).not.toBeInTheDocument()
  })
})
