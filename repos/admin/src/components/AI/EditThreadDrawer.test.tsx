import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

const mockProviderSelectorSingle = vi.fn()
vi.mock(`@TAF/components/Selectors`, () => ({
  ProviderSelectorSingle: (props: any) => {
    mockProviderSelectorSingle(props)
    return (
      <div data-testid='provider-selector-single'>
        {props.providers?.map((p: any) => (
          <span
            key={p.id}
            data-testid={`provider-opt-${p.id}`}
          >
            {p.name}
          </span>
        ))}
      </div>
    )
  },
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

  it(`should pass only AI providers to ProviderSelectorSingle, excluding non-ai types`, async () => {
    render(
      <EditThreadDrawer
        open={true}
        thread={mockThread}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )

    const lastCall = mockProviderSelectorSingle.mock.calls.at(-1)?.[0]
    const providerNames = lastCall.providers.map((p: any) => p.name)
    expect(providerNames).toContain(`Anthropic`)
    expect(providerNames).toContain(`OpenAI`)
    expect(providerNames).not.toContain(`S3 Bucket`)
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

  it(`should pass current providerId to ProviderSelectorSingle`, async () => {
    render(
      <EditThreadDrawer
        open={true}
        thread={mockThread}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    )

    const lastCall = mockProviderSelectorSingle.mock.calls.at(-1)?.[0]
    expect(lastCall.providerId).toBe(`provider-1`)
    expect(typeof lastCall.onChange).toBe(`function`)
  })
})
