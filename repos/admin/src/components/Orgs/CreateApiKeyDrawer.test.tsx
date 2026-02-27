import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockCreateApiKey = vi.fn()
vi.mock(`@TAF/actions/apiKeys`, () => ({
  createApiKey: (...args: any[]) => mockCreateApiKey(...args),
}))

vi.mock(`@TAF/state/selectors`, () => ({
  useUser: () => [{ id: `auth-user`, role: `admin` }],
  useActiveOrgId: () => [`org-1`],
}))

vi.mock(`@tdsk/components`, () => ({
  Drawer: ({ open, title, children, actions }: any) =>
    open ? (
      <div data-testid='drawer'>
        <div data-testid='drawer-title'>{title}</div>
        <div data-testid='drawer-content'>{children}</div>
        <div data-testid='drawer-actions'>{actions}</div>
      </div>
    ) : null,
  Button: ({ children, onClick, ...props }: any) => (
    <button
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
  TextInput: ({ label, value, onChange, id, fullWidth, ...props }: any) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={onChange}
        aria-label={label}
        {...props}
      />
    </div>
  ),
  InputLabel: ({ children }: any) => <label htmlFor='anything'>{children}</label>,
  SelectInput: ({ label, value, onChange, items }: any) => (
    <div>
      <label htmlFor='select-item-test'>{label}</label>
      <select
        id='select-item-test'
        value={value}
        onChange={onChange}
      >
        {items?.map?.((item: any) => (
          <option
            key={item.value}
            value={item.value}
          >
            {item.label}
          </option>
        ))}
      </select>
    </div>
  ),
  ClipboardCopy: () => null,
  DrawerActions: ({ actions }: any) => (
    <div data-testid='drawer-actions-bar'>
      <button onClick={actions?.cancel?.onClick}>Cancel</button>
      <button onClick={actions?.save?.onClick}>Create</button>
    </div>
  ),
  CheckboxInput: ({ label, checked, onChange }: any) => (
    <div>
      <input
        type='checkbox'
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </div>
  ),
}))

import { CreateApiKeyDrawer } from './CreateApiKeyDrawer'

const defaultProps = {
  orgId: `org-1`,
  open: true,
  onClose: vi.fn(),
}

describe(`CreateApiKeyDrawer`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateApiKey.mockResolvedValue({ data: { key: `tdsk_test123` } })
  })

  it(`renders without userId prop`, () => {
    render(<CreateApiKeyDrawer {...defaultProps} />)
    expect(screen.getByText(`Generate API Key`)).toBeTruthy()
    expect(screen.getByLabelText(`Key Name`)).toBeTruthy()
  })

  it(`shows user name when userName prop is provided`, () => {
    render(
      <CreateApiKeyDrawer
        {...defaultProps}
        userId='user-1'
        userName='Alice Admin'
      />
    )
    expect(screen.getByText(`User`)).toBeTruthy()
    expect(screen.getByText(`Alice Admin`)).toBeTruthy()
  })

  it(`includes userId in createApiKey call when provided`, async () => {
    render(
      <CreateApiKeyDrawer
        {...defaultProps}
        userId='user-1'
        userName='Alice Admin'
      />
    )

    const nameInput = screen.getByLabelText(`Key Name`)
    fireEvent.change(nameInput, { target: { value: `My Test Key` } })

    // The DrawerActions renders a Create button (editing=false)
    const createBtn = screen.getByText(`Create`)
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: `org-1`,
          data: expect.objectContaining({
            userId: `user-1`,
            name: `My Test Key`,
          }),
        })
      )
    })
  })
})
