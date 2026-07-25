import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const fetchRecords = vi.hoisted(() => vi.fn())

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children, onClick }: any) => <span onClick={onClick}>{children}</span>,
  Chip: ({ label }: any) => <span>{label}</span>,
  Collapse: ({ children }: any) => <div>{children}</div>,
}))

vi.mock(`@TAF/actions/agentActivity/api/fetchCollectionRecords`, () => ({
  fetchCollectionRecords: fetchRecords,
}))

import { AgentCollections } from './AgentCollections'

const props = { orgId: `o`, projectId: `p` }

const record = (over: any) => ({
  id: over.id,
  createdAt: `2020-01-01T00:00:00Z`,
  data: over.data,
})

describe(`AgentCollections`, () => {
  beforeEach(() => fetchRecords.mockReset())

  it(`renders a skeleton while collections are undefined`, () => {
    render(
      <AgentCollections
        {...props}
        collections={undefined}
      />
    )
    expect(screen.getByTestId(`agent-collections-skeleton`)).toBeTruthy()
  })

  it(`renders an empty state when there are no collections`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{}}
      />
    )
    expect(screen.getByText(/No collections/i)).toBeTruthy()
  })

  it(`lists collections by record count desc`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{
          a: { id: `a`, name: `plans`, recordCount: 5 } as any,
          b: { id: `b`, name: `dev_tasks`, recordCount: 268 } as any,
        }}
      />
    )
    const names = screen.getAllByText(/plans|dev_tasks/).map((n) => n.textContent)
    expect(names.indexOf(`dev_tasks`)).toBeLessThan(names.indexOf(`plans`))
  })

  it(`opens a collection: fetches its records and shows the Back button`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `dev_tasks`, recordCount: 1 } as any }}
        recordsMap={{ 'p:dev_tasks': [record({ id: `r1`, data: { title: `A task` } })] as any }}
      />
    )
    fireEvent.click(screen.getByText(`dev_tasks`))
    expect(fetchRecords).toHaveBeenCalledWith(`o`, `p`, `dev_tasks`)
    // Back affordance + the record renders in the detail view.
    expect(screen.getByRole(`button`, { name: /Collections/i })).toBeTruthy()
    expect(screen.getByText(`A task`)).toBeTruthy()
  })

  it(`shows a records skeleton when the opened collection is not loaded yet`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `dev_tasks`, recordCount: 3 } as any }}
        recordsMap={{}}
      />
    )
    fireEvent.click(screen.getByText(`dev_tasks`))
    expect(screen.getByTestId(`collection-records-skeleton`)).toBeTruthy()
  })

  it(`shows an empty state for a collection with no records`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `empty_col`, recordCount: 0 } as any }}
        recordsMap={{ 'p:empty_col': [] }}
      />
    )
    fireEvent.click(screen.getByText(`empty_col`))
    expect(screen.getByText(`No records`)).toBeTruthy()
  })

  it(`renders any record generically: title, status, scalar rows, JSON fields`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `dev_tasks`, recordCount: 1 } as any }}
        recordsMap={{
          'p:dev_tasks': [
            record({
              id: `r1`,
              data: {
                title: `Ship the browser`,
                status: `active`,
                count: 42,
                tags: [`urgent`, `ui`],
                meta: { owner: `cto` },
              },
            }),
          ] as any,
        }}
      />
    )
    fireEvent.click(screen.getByText(`dev_tasks`))

    expect(screen.getByText(`Ship the browser`)).toBeTruthy() // title heuristic
    expect(screen.getByText(`active`)).toBeTruthy() // status chip
    expect(screen.getByText(`count`)).toBeTruthy() // scalar key
    expect(screen.getByText(`42`)).toBeTruthy() // scalar value
    expect(screen.getByText(`tags`)).toBeTruthy() // array field label
    expect(screen.getByText(/urgent/)).toBeTruthy() // array field JSON
    expect(screen.getByText(`meta`)).toBeTruthy() // object field label
    expect(screen.getByText(/owner/)).toBeTruthy() // object field JSON
  })

  it(`falls back to the record id when no title-like field exists`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `misc`, recordCount: 1 } as any }}
        recordsMap={{
          'p:misc': [record({ id: `rec_fallback`, data: { foo: `bar` } })] as any,
        }}
      />
    )
    fireEvent.click(screen.getByText(`misc`))
    expect(screen.getByText(`rec_fallback`)).toBeTruthy()
    expect(screen.getByText(`foo`)).toBeTruthy()
    expect(screen.getByText(`bar`)).toBeTruthy()
  })

  it(`renders a record with null data without crashing (falls back to id)`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `misc`, recordCount: 1 } as any }}
        recordsMap={{
          'p:misc': [{ id: `rec_nulldata`, createdAt: `2020-01-01T00:00:00Z`, data: null }] as any,
        }}
      />
    )
    fireEvent.click(screen.getByText(`misc`))
    expect(screen.getByText(`rec_nulldata`)).toBeTruthy()
  })

  it(`Back returns from records to the collection grid`, () => {
    render(
      <AgentCollections
        {...props}
        collections={{ b: { id: `b`, name: `dev_tasks`, recordCount: 1 } as any }}
        recordsMap={{ 'p:dev_tasks': [record({ id: `r1`, data: { title: `A task` } })] as any }}
      />
    )
    fireEvent.click(screen.getByText(`dev_tasks`))
    expect(screen.getByText(`A task`)).toBeTruthy()

    fireEvent.click(screen.getByRole(`button`, { name: /Collections/i }))
    // Back on the grid: the record is gone, the collection card is shown again.
    expect(screen.queryByText(`A task`)).toBeNull()
    expect(screen.getByText(`dev_tasks`)).toBeTruthy()
  })
})
