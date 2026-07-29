import '@testing-library/jest-dom/vitest'

import { toast } from 'sonner'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock(`sonner`, () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock(`@TTH/services/collectionApi`, () => ({
  collectionApi: {
    list: (...args: any[]) => mockList(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}))

import { ProjectCollectionsSection } from './ProjectCollectionsSection'

const orders = {
  id: `c1`,
  name: `orders`,
  description: `Order records`,
  schema: null,
  projectId: `proj-1`,
  recordCount: 3,
}

describe(`ProjectCollectionsSection`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ data: [orders] })
  })

  it(`renders collections returned from list()`, async () => {
    render(
      <ProjectCollectionsSection
        orgId='org-1'
        projectId='proj-1'
      />
    )

    expect(await screen.findByText(`orders`)).toBeInTheDocument()
    expect(screen.getByText(`3`)).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledWith(`org-1`, `proj-1`)
  })

  it(`shows the empty state when there are no collections`, async () => {
    mockList.mockResolvedValue({ data: [] })
    render(
      <ProjectCollectionsSection
        orgId='org-1'
        projectId='proj-1'
      />
    )

    expect(await screen.findByText(`No collections in this project`)).toBeInTheDocument()
  })

  it(`creates a collection through the form dialog and adds it to the rendered list`, async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({
      data: {
        id: `c2`,
        name: `sessions`,
        description: null,
        schema: null,
        projectId: `proj-1`,
      },
    })

    render(
      <ProjectCollectionsSection
        orgId='org-1'
        projectId='proj-1'
      />
    )
    await screen.findByText(`orders`)

    await user.click(screen.getByRole(`button`, { name: `Add Collection` }))
    await user.type(screen.getByLabelText(`Name`, { exact: false }), `sessions`)
    await user.click(screen.getByRole(`button`, { name: `Create` }))

    expect(mockCreate).toHaveBeenCalledWith(`org-1`, `proj-1`, {
      name: `sessions`,
      description: null,
    })
    expect(await screen.findByText(`sessions`)).toBeInTheDocument()
  })

  it(`edits a collection through the form dialog and updates it in place in the rendered list`, async () => {
    const user = userEvent.setup()
    mockUpdate.mockResolvedValue({
      data: {
        id: `c1`,
        name: `orders-renamed`,
        description: `Order records`,
        schema: null,
        projectId: `proj-1`,
      },
    })

    render(
      <ProjectCollectionsSection
        orgId='org-1'
        projectId='proj-1'
      />
    )
    await screen.findByText(`orders`)

    await user.click(screen.getByRole(`button`, { name: `Edit` }))
    const nameInput = screen.getByLabelText(`Name`, { exact: false })
    await user.clear(nameInput)
    await user.type(nameInput, `orders-renamed`)
    await user.click(screen.getByRole(`button`, { name: `Save` }))

    expect(mockUpdate).toHaveBeenCalledWith(`org-1`, `proj-1`, `orders`, {
      name: `orders-renamed`,
      description: `Order records`,
    })
    expect(await screen.findByText(`orders-renamed`)).toBeInTheDocument()
    expect(screen.queryByText(`orders`)).not.toBeInTheDocument()
  })

  it(`deletes a collection after confirming and removes it from the rendered list`, async () => {
    const user = userEvent.setup()
    mockDelete.mockResolvedValue({ data: { success: true } })

    render(
      <ProjectCollectionsSection
        orgId='org-1'
        projectId='proj-1'
      />
    )
    await screen.findByText(`orders`)

    await user.click(screen.getByRole(`button`, { name: `Delete` }))
    const confirmButtons = screen.getAllByRole(`button`, { name: `Delete` })
    await user.click(confirmButtons[confirmButtons.length - 1]!)

    expect(mockDelete).toHaveBeenCalledWith(`org-1`, `proj-1`, `orders`)
    await waitFor(() => expect(screen.queryByText(`orders`)).not.toBeInTheDocument())
  })

  it(`shows an error toast and keeps the collection in the list when delete fails`, async () => {
    const user = userEvent.setup()
    mockDelete.mockResolvedValue({ error: { message: `boom` } })

    render(
      <ProjectCollectionsSection
        orgId='org-1'
        projectId='proj-1'
      />
    )
    await screen.findByText(`orders`)

    await user.click(screen.getByRole(`button`, { name: `Delete` }))
    const confirmButtons = screen.getAllByRole(`button`, { name: `Delete` })
    await user.click(confirmButtons[confirmButtons.length - 1]!)

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByText(`orders`, { selector: `p` })).toBeInTheDocument()
  })
})
