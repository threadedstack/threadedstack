import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as accessors from '@TAF/state/accessors'
import { ProjectProviders } from './ProjectProviders'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@TAF/scripts/testUtils'

vi.mock(`react-router`, () => ({
  useParams: () => ({ orgId: `org-123`, projectId: `project-456` }),
  useNavigate: () => vi.fn(),
}))

vi.mock(`@TAF/pages/Page/Page`, () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock(`@TAF/state/accessors`, () => ({
  setActiveOrgId: vi.fn(),
  setActiveprojectId: vi.fn(),
}))

vi.mock(`@TAF/actions/providers`, () => ({
  fetchProviders: vi.fn().mockResolvedValue({ providers: {} }),
}))

describe(`ProjectProviders`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should render the project providers page`, async () => {
    renderWithTheme(<ProjectProviders />)
    await waitFor(() => {
      expect(screen.getByRole(`heading`, { name: `Project Providers` })).toBeDefined()
    })
  })

  it(`should display the org and project IDs`, async () => {
    renderWithTheme(<ProjectProviders />)
    await waitFor(() => {
      expect(screen.getByText(`No providers configured for this org.`)).toBeDefined()
    })
  })

  it(`should call setActiveOrgId with orgId`, async () => {
    renderWithTheme(<ProjectProviders />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith(`org-123`)
    })
  })
})
