// biome-ignore-all lint: is a test file

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockUpsertConfig = vi.fn().mockResolvedValue({ data: {} })

let drawerHookArgs: any

vi.mock(`@TAF/state/selectors`, () => ({
  useSecrets: () => [{}],
  useOrgSecrets: () => [{}],
  useProviders: () => [{}],
  useProjects: () => [{}],
  useOrgSandboxes: () => [{}],
  useProjectSecrets: () => [{}],
  useProjectFunctions: () => [{}],
  useActiveOrgResolvedPerms: vi.fn(() => [undefined]),
}))

vi.mock(`@TAF/actions/providers`, () => ({
  fetchProviders: vi.fn().mockResolvedValue({ providers: {} }),
}))

vi.mock(`@TAF/actions/functions`, () => ({
  fetchFunctions: vi.fn().mockResolvedValue({ functions: {} }),
}))

vi.mock(`@TAF/actions/projects/api/fetchProjects`, () => ({
  fetchProjects: vi.fn().mockResolvedValue({ projects: {} }),
}))

vi.mock(`@TAF/actions/agents/api/createAgent`, () => ({
  createAgent: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock(`@TAF/actions/agents/api/updateAgent`, () => ({
  updateAgent: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock(`@TAF/actions/agents/api/deleteAgent`, () => ({
  deleteAgent: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock(`@TAF/actions/secrets/api/fetchSecrets`, () => ({
  fetchSecrets: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock(`@TAF/services`, () => ({
  agentsApi: {
    upsertConfig: (...args: any[]) => mockUpsertConfig(...args),
  },
}))

vi.mock(`@TAF/components/Code`, () => ({
  Code: () => null,
}))

vi.mock(`@TAF/constants/monaco`, () => ({
  MonacoOptions: {},
}))

vi.mock(`@TAF/components/KeyValueEditor`, () => ({
  KeyValueEditor: () => null,
}))

vi.mock(`@TAF/components/ErrorAlert/ErrorAlert`, () => ({
  ErrorAlert: ({ message }: { message: string }) => (
    <div data-testid='error-alert'>{message}</div>
  ),
}))

vi.mock(`@TAF/hooks/components/useDrawerActions`, () => ({
  useDrawerActions: (args: any) => {
    drawerHookArgs = args
    return {
      actions: { save: vi.fn(), cancel: vi.fn(), delete: vi.fn() },
    }
  },
}))

vi.mock(`@tdsk/components`, () => ({
  Drawer: ({ children, title, open }: any) =>
    open ? (
      <div data-testid='drawer'>
        <div data-testid='drawer-title'>{title}</div>
        {children}
      </div>
    ) : null,
  DrawerActions: () => null,
  ConfirmDelete: () => null,
  SelectInput: (props: any) => (
    <div data-testid={props.id || 'select-input'}>
      {props.label && <label>{props.label}</label>}
      <select />
    </div>
  ),
  AutoInput: (props: any) => (
    <div data-testid={props.id || 'auto-input'}>
      {props.label && <label>{props.label}</label>}
    </div>
  ),
}))

vi.mock(`@TAF/components/Selectors`, () => ({
  ToolsSelector: () => <div data-testid='tools-selector' />,
  SecretsSelector: () => <div data-testid='secrets-selector' />,
  FunctionsSelector: () => <div data-testid='functions-selector' />,
}))

vi.mock(`@TAF/components/Agents`, () => ({
  BasicInfoForm: ({ loading }: any) => (
    <div
      data-testid='basic-info-form'
      data-loading={loading}
    />
  ),
  ModelConfigForm: () => <div data-testid='model-config-form' />,
  AgentSettingsForm: ({ brain, onBrainChange }: any) => (
    <div
      data-testid='agent-settings-form'
      data-brain={brain}
      data-brain-editable={!!onBrainChange}
    >
      <button
        type='button'
        data-testid='set-brain-runtime'
        onClick={() => onBrainChange?.(`runtime`)}
      />
      <button
        type='button'
        data-testid='set-brain-api'
        onClick={() => onBrainChange?.(`api`)}
      />
    </div>
  ),
  WebProviderSettings: () => <div data-testid='web-provider-settings' />,
}))

import { AgentDrawer } from './AgentDrawer'
import { updateAgent } from '@TAF/actions/agents/api/updateAgent'

const mockAgent = {
  id: `agent-1`,
  name: `Test Agent`,
  model: `claude-sonnet-4-20250514`,
  description: `A test agent`,
  active: true,
  tools: [`webSearch`],
  maxTokens: 100000,
  systemPrompt: `You are helpful`,
  providers: [{ id: `provider-1`, name: `Anthropic`, type: `ai` }],
  secrets: [],
  projects: [{ id: `project-1`, name: `Test Project` }],
  envVars: {},
  environment: { streaming: true, temperature: 0.7 },
  projectConfigs: [
    { agentId: `agent-1`, projectId: `project-1`, functionIds: [`func-1`] },
  ],
  getProjectConfig: (pid: string) =>
    mockAgent.projectConfigs.find((c: any) => c.projectId === pid),
} as any

describe(`AgentDrawer`, () => {
  const defaultProps = {
    open: true,
    orgId: `org-1`,
    agent: null as any,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`Create mode (no agent, no projectId)`, () => {
    it(`should show "Create Agent" title`, () => {
      render(<AgentDrawer {...defaultProps} />)
      expect(screen.getByTestId(`drawer-title`).textContent).toBe(`Create Agent`)
    })
  })

  describe(`Edit mode (agent, no projectId)`, () => {
    it(`should show "Edit Agent" title`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )
      expect(screen.getByTestId(`drawer-title`).textContent).toBe(`Edit Agent`)
    })

    it(`should show project assignment section`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )
      expect(screen.getByText(`Project Assignment`)).toBeTruthy()
    })

    it(`should show secrets selector`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )
      expect(screen.getByTestId(`secrets-selector`)).toBeTruthy()
    })

    it(`should not show override mode banner`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )
      expect(screen.queryByText(/Project Override Mode/)).toBeNull()
    })

    it(`should not show functions selector without projectId`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )
      expect(screen.queryByTestId(`functions-selector`)).toBeNull()
    })

    it(`should show the soul editor section`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )
      expect(screen.getByText(`Soul (Constitution)`)).toBeTruthy()
    })
  })

  describe(`Override mode (agent + projectId)`, () => {
    const overrideProps = {
      ...defaultProps,
      agent: mockAgent,
      projectId: `project-1`,
    }

    it(`should show "Configure Agent for Project" title`, () => {
      render(<AgentDrawer {...overrideProps} />)
      expect(screen.getByTestId(`drawer-title`).textContent).toBe(
        `Configure Agent for Project`
      )
    })

    it(`should show override mode banner`, () => {
      render(<AgentDrawer {...overrideProps} />)
      expect(screen.getByText(/Project Override Mode/)).toBeTruthy()
    })

    it(`should make BasicInfoForm read-only (loading=true)`, () => {
      render(<AgentDrawer {...overrideProps} />)
      const form = screen.getByTestId(`basic-info-form`)
      expect(form.getAttribute(`data-loading`)).toBe(`true`)
    })

    it(`should hide project assignment section`, () => {
      render(<AgentDrawer {...overrideProps} />)
      expect(screen.queryByText(`Project Assignment`)).toBeNull()
    })

    it(`should hide secrets selector`, () => {
      render(<AgentDrawer {...overrideProps} />)
      expect(screen.queryByTestId(`secrets-selector`)).toBeNull()
    })

    it(`should show functions selector`, () => {
      render(<AgentDrawer {...overrideProps} />)
      expect(screen.getByTestId(`functions-selector`)).toBeTruthy()
    })

    it(`should hide the soul editor section`, () => {
      render(<AgentDrawer {...overrideProps} />)
      expect(screen.queryByText(`Soul (Constitution)`)).toBeNull()
    })
  })

  describe(`New agent in project context (projectId, no agent)`, () => {
    it(`should show "Create Agent" title (not override mode)`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          projectId='project-1'
        />
      )
      expect(screen.getByTestId(`drawer-title`).textContent).toBe(`Create Agent`)
    })

    it(`should show functions selector when projectId is set`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          projectId='project-1'
        />
      )
      expect(screen.getByTestId(`functions-selector`)).toBeTruthy()
    })

    it(`should not show override mode banner`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          projectId='project-1'
        />
      )
      expect(screen.queryByText(/Project Override Mode/)).toBeNull()
    })
  })

  describe(`Brain selector`, () => {
    it(`should default brain to api in create mode`, () => {
      render(<AgentDrawer {...defaultProps} />)
      const form = screen.getByTestId(`agent-settings-form`)
      expect(form.getAttribute(`data-brain`)).toBe(`api`)
      expect(form.getAttribute(`data-brain-editable`)).toBe(`true`)
    })

    it(`should pre-populate brain from the agent`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={{ ...mockAgent, brain: `runtime` } as any}
        />
      )
      expect(screen.getByTestId(`agent-settings-form`).getAttribute(`data-brain`)).toBe(
        `runtime`
      )
    })

    it(`should include the default brain in the update payload`, async () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )

      await act(async () => {
        await drawerHookArgs.onSave({ preventDefault: vi.fn() })
      })

      expect(updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brain: `api` }),
        })
      )
    })

    it(`should include the changed brain in the update payload`, async () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
        />
      )

      fireEvent.click(screen.getByTestId(`set-brain-runtime`))

      await act(async () => {
        await drawerHookArgs.onSave({ preventDefault: vi.fn() })
      })

      expect(updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brain: `runtime` }),
        })
      )
    })

    it(`should hide the brain selector in override mode`, () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
          projectId='project-1'
        />
      )
      expect(
        screen.getByTestId(`agent-settings-form`).getAttribute(`data-brain-editable`)
      ).toBe(`false`)
    })

    it(`should save with zero providers when brain is runtime`, async () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={{ ...mockAgent, brain: `runtime`, providers: [] } as any}
        />
      )

      await act(async () => {
        await drawerHookArgs.onSave({ preventDefault: vi.fn() })
      })

      expect(screen.queryByTestId(`error-alert`)).toBeNull()
      expect(updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brain: `runtime`, providerInputs: [] }),
        })
      )
    })

    it(`should error with zero providers when brain is api`, async () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={{ ...mockAgent, providers: [] } as any}
        />
      )

      await act(async () => {
        await drawerHookArgs.onSave({ preventDefault: vi.fn() })
      })

      expect(updateAgent).not.toHaveBeenCalled()
      expect(screen.getByTestId(`error-alert`).textContent).toBe(
        `At least one provider is required`
      )
    })

    it(`should error when flipping brain from runtime to api with zero providers`, async () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={{ ...mockAgent, brain: `runtime`, providers: [] } as any}
        />
      )

      fireEvent.click(screen.getByTestId(`set-brain-api`))

      await act(async () => {
        await drawerHookArgs.onSave({ preventDefault: vi.fn() })
      })

      expect(updateAgent).not.toHaveBeenCalled()
      expect(screen.getByTestId(`error-alert`).textContent).toBe(
        `At least one provider is required`
      )
    })

    it(`should not include brain in the override config payload`, async () => {
      render(
        <AgentDrawer
          {...defaultProps}
          agent={mockAgent}
          projectId='project-1'
        />
      )

      await act(async () => {
        await drawerHookArgs.onSave({ preventDefault: vi.fn() })
      })

      expect(updateAgent).not.toHaveBeenCalled()
      expect(mockUpsertConfig).toHaveBeenCalledWith(
        `org-1`,
        `project-1`,
        `agent-1`,
        expect.not.objectContaining({ brain: expect.anything() })
      )
    })
  })
})
