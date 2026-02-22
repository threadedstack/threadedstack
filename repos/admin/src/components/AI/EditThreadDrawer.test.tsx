import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

const mockUpdateThread = vi.fn().mockResolvedValue({ data: {} })
const mockOnSuccess = vi.fn()
const mockOnClose = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useProviders: vi.fn(() => [
    {
      'provider-1': { id: `provider-1`, name: `Anthropic`, type: `ai`, orgId: `org-1` },
      'provider-2': { id: `provider-2`, name: `OpenAI`, type: `ai`, orgId: `org-1` },
      'provider-3': {
        id: `provider-3`,
        name: `S3 Bucket`,
        type: `storage`,
        orgId: `org-1`,
      },
    },
  ]),
}))

vi.mock(`@TAF/actions/threads/api/updateThread`, () => ({
  updateThread: (...args: any[]) => mockUpdateThread(...args),
}))

vi.mock(`@tdsk/components`, () => ({
  Loading: () => null,
  Drawer: ({ children, open, title }: any) =>
    open ? (
      <div data-testid='drawer'>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
  DrawerActions: () => null,
}))

vi.mock(`@TAF/hooks/components/useDrawerActions`, () => ({
  useDrawerActions: () => ({ actions: [] }),
}))

import { EditThreadDrawer } from './EditThreadDrawer'

const mockThread = {
  id: `thread-abc-123`,
  name: `My Test Thread`,
  orgId: `org-1`,
  agentId: `agent-1`,
  public: true,
  providerId: `provider-1`,
  updatedAt: `2026-01-01`,
  createdAt: `2026-01-01`,
} as any

describe(`EditThreadDrawer`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return null when thread is null`, () => {
    const { container } = render(
      <EditThreadDrawer
        open={true}
        thread={null}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )
    expect(container.innerHTML).toBe(``)
  })

  it(`should render provider select with ai providers and exclude non-ai types`, async () => {
    render(
      <EditThreadDrawer
        open={true}
        thread={mockThread}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )

    const selectButton = screen.getByRole(`combobox`, { name: `AI Provider` })
    await userEvent.click(selectButton)

    const listbox = screen.getByRole(`listbox`)
    const options = within(listbox).getAllByRole(`option`)

    const optionTexts = options.map((opt) => opt.textContent)
    expect(optionTexts).toContain(`Anthropic`)
    expect(optionTexts).toContain(`OpenAI`)
    expect(optionTexts).not.toContain(`S3 Bucket`)
  })

  it(`should display thread ID in a read-only field`, () => {
    render(
      <EditThreadDrawer
        open={true}
        thread={mockThread}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )

    const threadIdInput = screen.getByDisplayValue(`thread-abc-123`)
    expect(threadIdInput).toBeDefined()
    expect(threadIdInput.getAttribute(`readonly`)).not.toBeNull()
  })

  it(`should pre-fill form fields from thread data`, () => {
    render(
      <EditThreadDrawer
        open={true}
        thread={mockThread}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByDisplayValue(`My Test Thread`)).toBeDefined()
    expect(screen.getByDisplayValue(`thread-abc-123`)).toBeDefined()

    const publicSwitch = screen.getByRole(`checkbox`)
    expect(publicSwitch).toBeDefined()
    expect((publicSwitch as HTMLInputElement).checked).toBe(true)
  })

  it(`should include a "None" option for provider selection`, async () => {
    render(
      <EditThreadDrawer
        open={true}
        thread={mockThread}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )

    const selectButton = screen.getByRole(`combobox`, { name: `AI Provider` })
    await userEvent.click(selectButton)

    const listbox = screen.getByRole(`listbox`)
    const noneOption = within(listbox).getByText(`None (use agent's primary provider)`)
    expect(noneOption).toBeDefined()
  })
})
