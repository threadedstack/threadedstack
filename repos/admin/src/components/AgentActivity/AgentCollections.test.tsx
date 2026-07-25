import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const navTo = vi.hoisted(() => vi.fn())

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children }: any) => <span>{children}</span>,
  Chip: ({ label }: any) => <span>{label}</span>,
}))

vi.mock(`@TAF/services/nav`, () => ({ nav: { to: navTo } }))

import { AgentCollections } from './AgentCollections'

const props = { orgId: `o`, projectId: `p` }

describe(`AgentCollections`, () => {
  it(`renders a skeleton while collections are undefined`, () => {
    render(<AgentCollections {...props} collections={undefined} />)
    expect(screen.getByTestId(`agent-collections-skeleton`)).toBeTruthy()
  })

  it(`renders an empty state when fetched but empty`, () => {
    render(<AgentCollections {...props} collections={{}} />)
    expect(screen.getByText(/No collections/i)).toBeTruthy()
  })

  it(`renders collections by record count desc and links into the browser`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{
          a: { id: `a`, name: `plans`, recordCount: 5 } as any,
          b: { id: `b`, name: `resident_transcripts`, recordCount: 3794 } as any,
        }}
      />
    )
    const names = screen.getAllByText(/plans|resident_transcripts/).map((n) => n.textContent)
    expect(names.indexOf(`resident_transcripts`)).toBeLessThan(names.indexOf(`plans`))

    fireEvent.click(screen.getByText(`plans`))
    expect(navTo).toHaveBeenCalledWith(`/orgs/o/projects/p/collections`)
  })
})
