// biome-ignore-all lint: is a test file

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

let drawerHookArgs: any

vi.mock(`@TAF/state/selectors`, () => ({
  useOrgAgents: () => [{}],
  useProjectSandboxes: () => [{}],
}))

vi.mock(`@TAF/actions/schedules/api/createSchedule`, () => ({
  createSchedule: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock(`@TAF/actions/schedules/api/updateSchedule`, () => ({
  updateSchedule: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock(`@TAF/hooks/components/useDrawerActions`, () => ({
  useDrawerActions: (args: any) => {
    drawerHookArgs = args
    return {
      actions: { save: vi.fn(), cancel: vi.fn(), delete: vi.fn() },
    }
  },
}))

vi.mock(`@TAF/components/ErrorAlert/ErrorAlert`, () => ({
  ErrorAlert: ({ message }: { message: string }) => (
    <div data-testid='error-alert'>{message}</div>
  ),
}))

vi.mock(`@TAF/components/FormSection/FormSection`, () => ({
  FormSection: ({ children, title }: any) => (
    <div data-testid='form-section'>
      {title}
      {children}
    </div>
  ),
}))

vi.mock(`@TAF/components/Schedules/ScheduleRuns`, () => ({
  ScheduleRuns: () => <div data-testid='schedule-runs' />,
}))

vi.mock(`@TAF/components/Selectors`, () => ({
  AgentSelector: () => <div data-testid='agent-selector' />,
  SandboxSelector: ({ onChange }: any) => (
    <button
      type='button'
      data-testid='set-sandbox'
      onClick={() => onChange(`sb-1`)}
    />
  ),
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
  CronInput: () => <div data-testid='cron-input' />,
  SwitchInput: (props: any) => (
    <input
      type='checkbox'
      data-testid={props.id}
      checked={props.checked}
      onChange={props.onChange}
    />
  ),
  TextInput: (props: any) => (
    <input
      data-testid={props.id}
      value={props.value}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  ),
}))

import { ScheduleDrawer } from './ScheduleDrawer'
import { createSchedule } from '@TAF/actions/schedules/api/createSchedule'
import { updateSchedule } from '@TAF/actions/schedules/api/updateSchedule'

const mockSchedule = {
  id: `sd_1`,
  orgId: `org-1`,
  projectId: `proj-1`,
  sandboxId: `sb-1`,
  type: `prompt`,
  prompt: `Run the task`,
  enabled: true,
  timeoutMs: 3_600_000,
  cronExpression: `0 * * * *`,
} as any

describe(`ScheduleDrawer`, () => {
  const defaultProps = {
    open: true,
    orgId: `org-1`,
    projectId: `proj-1`,
    schedule: null as any,
    onClose: vi.fn(),
    onRemove: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const fillRequiredCreateFields = () => {
    fireEvent.click(screen.getByTestId(`set-sandbox`))
    fireEvent.change(screen.getByTestId(`tdsk-schedule-prompt-input`), {
      target: { value: `Do the thing` },
    })
  }

  it(`converts the timeout minutes input to timeoutMs in the create payload`, async () => {
    render(<ScheduleDrawer {...defaultProps} />)

    fillRequiredCreateFields()
    fireEvent.change(screen.getByTestId(`tdsk-schedule-timeout-input`), {
      target: { value: `45` },
    })

    await act(async () => {
      await drawerHookArgs.onSave({ preventDefault: vi.fn() })
    })

    expect(createSchedule).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      expect.objectContaining({ timeoutMs: 45 * 60_000 })
    )
  })

  it(`omits timeoutMs from the create payload when the input is empty`, async () => {
    render(<ScheduleDrawer {...defaultProps} />)

    fillRequiredCreateFields()

    await act(async () => {
      await drawerHookArgs.onSave({ preventDefault: vi.fn() })
    })

    expect(createSchedule).toHaveBeenCalledTimes(1)
    const payload = (createSchedule as any).mock.calls[0][2]
    expect(payload).not.toHaveProperty(`timeoutMs`)
  })

  it(`pre-populates the timeout input in minutes from schedule.timeoutMs`, () => {
    render(
      <ScheduleDrawer
        {...defaultProps}
        schedule={mockSchedule}
      />
    )

    const input = screen.getByTestId(`tdsk-schedule-timeout-input`) as HTMLInputElement
    expect(input.value).toBe(`60`)
  })

  it(`sends timeoutMs null when clearing an existing timeout on edit`, async () => {
    render(
      <ScheduleDrawer
        {...defaultProps}
        schedule={mockSchedule}
      />
    )

    fireEvent.change(screen.getByTestId(`tdsk-schedule-timeout-input`), {
      target: { value: `` },
    })

    await act(async () => {
      await drawerHookArgs.onSave({ preventDefault: vi.fn() })
    })

    expect(updateSchedule).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sd_1`,
      expect.objectContaining({ timeoutMs: null })
    )
  })

  it(`converts a changed timeout on edit into the update payload`, async () => {
    render(
      <ScheduleDrawer
        {...defaultProps}
        schedule={mockSchedule}
      />
    )

    fireEvent.change(screen.getByTestId(`tdsk-schedule-timeout-input`), {
      target: { value: `90` },
    })

    await act(async () => {
      await drawerHookArgs.onSave({ preventDefault: vi.fn() })
    })

    expect(updateSchedule).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sd_1`,
      expect.objectContaining({ timeoutMs: 90 * 60_000 })
    )
  })
})
