import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock(`react-router`, () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock(`@TAF/actions/projects/api/deleteProject`, () => ({
  deleteProject: vi.fn(),
}))

vi.mock(`@TAF/actions/projects/api/updateProject`, () => ({
  updateProject: vi.fn(),
}))

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseActiveProject = vi.fn(() => [undefined])
const mockUseActiveProjectId = vi.fn(() => [`project-1`])

vi.mock(`@TAF/state/selectors`, () => ({
  useActiveOrgId: () => mockUseActiveOrgId(),
  useActiveProject: () => mockUseActiveProject(),
  useActiveProjectId: () => mockUseActiveProjectId(),
  useProjectSandboxes: () => [{}],
  useProjectSecrets: () => [{}],
}))

vi.mock(`@TAF/pages/Page/Page`, () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock(`@TAF/components/Projects/ProjectIcon`, () => ({
  ProjectIcon: () => <span data-testid='project-icon' />,
}))

vi.mock(`@tdsk/components`, async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    ConfirmDelete: () => null,
    Drawer: () => null,
  }
})

import { Project } from './Project'

const baseProject = {
  id: `project-1`,
  name: `Test Project`,
  orgId: `org-1`,
  branch: `main`,
  description: `A test project`,
  meta: {},
  createdAt: `2026-01-01`,
  updatedAt: `2026-01-02`,
}

describe(`Project Page`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseActiveProjectId.mockReturnValue([`project-1`])
    mockUseActiveProject.mockReturnValue([undefined])
  })

  describe(`stat cards with counts`, () => {
    it(`should display endpoint, function, sandbox, and secret counts from project`, () => {
      mockUseActiveProject.mockReturnValue([
        { ...baseProject, counts: { endpoint: 5, function: 3 } },
      ])
      render(<Project />)

      expect(screen.getByText(`5 endpoints`)).toBeTruthy()
      expect(screen.getByText(`3 functions`)).toBeTruthy()
      expect(screen.getByText(`0 sandbox environments`)).toBeTruthy()
      expect(screen.getByText(`0 secrets`)).toBeTruthy()
      expect(screen.getAllByText(`Endpoints`).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(`Functions`).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(`Secrets`).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(`Sandboxes`).length).toBeGreaterThanOrEqual(1)
    })

    it(`should display 0 when count fields are undefined`, () => {
      mockUseActiveProject.mockReturnValue([baseProject])
      render(<Project />)

      expect(screen.getByText(`0 endpoints`)).toBeTruthy()
      expect(screen.getByText(`0 functions`)).toBeTruthy()
      expect(screen.getByText(`0 sandbox environments`)).toBeTruthy()
      expect(screen.getByText(`0 secrets`)).toBeTruthy()
    })

    it(`should display 0 when count fields are explicitly zero`, () => {
      mockUseActiveProject.mockReturnValue([
        { ...baseProject, counts: { endpoint: 0, function: 0 } },
      ])
      render(<Project />)

      expect(screen.getByText(`0 endpoints`)).toBeTruthy()
      expect(screen.getByText(`0 functions`)).toBeTruthy()
      expect(screen.getByText(`0 sandbox environments`)).toBeTruthy()
      expect(screen.getByText(`0 secrets`)).toBeTruthy()
    })
  })

  describe(`project not found`, () => {
    it(`should show error message when project is not found`, () => {
      mockUseActiveProject.mockReturnValue([undefined])
      render(<Project />)

      expect(screen.getByText(`Project not found`)).toBeTruthy()
      expect(screen.getByText(`Back to Projects`)).toBeTruthy()
    })
  })

  describe(`project information`, () => {
    it(`should render project name and description`, () => {
      mockUseActiveProject.mockReturnValue([baseProject])
      render(<Project />)

      expect(screen.getAllByText(`Test Project`).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(`A test project`)).toBeTruthy()
    })

    it(`should show "No description provided" when description is empty`, () => {
      mockUseActiveProject.mockReturnValue([{ ...baseProject, description: undefined }])
      render(<Project />)

      expect(screen.getByText(`No description provided`)).toBeTruthy()
    })
  })
})
