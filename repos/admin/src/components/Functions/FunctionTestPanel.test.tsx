// biome-ignore-all lint: is a test file

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock(`@TAF/components/Code/Code`, () => ({
  Code: ({ label, value, onChange, disabled }: any) => (
    <textarea
      aria-label={label}
      data-testid={`code-${label}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

vi.mock(`@TAF/components/ErrorAlert/ErrorAlert`, () => ({
  ErrorAlert: ({ message }: { message: string }) => (
    <div data-testid='error-alert'>{message}</div>
  ),
}))

vi.mock(`@TAF/services/functionsApi`, () => ({
  functionsApi: {
    invoke: vi.fn(),
  },
}))

import { FunctionTestPanel } from './FunctionTestPanel'
import { functionsApi } from '@TAF/services/functionsApi'

const func = { id: `f-1`, name: `myFunc` } as any

describe(`FunctionTestPanel`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`invokes the function with the parsed JSON input and renders the result`, async () => {
    ;(functionsApi.invoke as any).mockResolvedValue({
      data: { result: { y: 2 }, logs: `hello`, durationMs: 12 },
    })

    render(
      <FunctionTestPanel
        func={func}
        orgId='org-1'
        projectId='proj-1'
      />
    )

    fireEvent.change(screen.getByTestId(`code-Input`), {
      target: { value: `{"x": 1}` },
    })

    await act(async () => {
      fireEvent.click(screen.getByText(`Invoke`))
    })

    expect(functionsApi.invoke).toHaveBeenCalledWith(`org-1`, `proj-1`, `f-1`, { x: 1 })
    expect(screen.getByText(`Success`)).toBeInTheDocument()
    expect(screen.getByText(`12ms`)).toBeInTheDocument()
    expect((screen.getByTestId(`code-Result`) as HTMLTextAreaElement).value).toContain(
      `"y": 2`
    )
    expect((screen.getByTestId(`code-Logs`) as HTMLTextAreaElement).value).toBe(`hello`)
  })

  it(`shows a JSON parse error and never calls the API when input is invalid JSON`, async () => {
    render(
      <FunctionTestPanel
        func={func}
        orgId='org-1'
        projectId='proj-1'
      />
    )

    fireEvent.change(screen.getByTestId(`code-Input`), {
      target: { value: `{not json` },
    })

    await act(async () => {
      fireEvent.click(screen.getByText(`Invoke`))
    })

    expect(functionsApi.invoke).not.toHaveBeenCalled()
    expect(screen.getByTestId(`error-alert`)).toHaveTextContent(
      `Input must be valid JSON`
    )
  })

  it(`defaults to {} when the input is blank`, async () => {
    ;(functionsApi.invoke as any).mockResolvedValue({
      data: { result: null, logs: ``, durationMs: 1 },
    })

    render(
      <FunctionTestPanel
        func={func}
        orgId='org-1'
        projectId='proj-1'
      />
    )

    fireEvent.change(screen.getByTestId(`code-Input`), { target: { value: `` } })

    await act(async () => {
      fireEvent.click(screen.getByText(`Invoke`))
    })

    expect(functionsApi.invoke).toHaveBeenCalledWith(`org-1`, `proj-1`, `f-1`, {})
  })

  it(`renders the execution error inline (from a failed run, not a thrown request) without an API-failure banner`, async () => {
    ;(functionsApi.invoke as any).mockResolvedValue({
      data: { result: null, logs: ``, durationMs: 5, error: `boom` },
    })

    render(
      <FunctionTestPanel
        func={func}
        orgId='org-1'
        projectId='proj-1'
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByText(`Invoke`))
    })

    expect(screen.getByText(`Error`)).toBeInTheDocument()
    expect(screen.getByTestId(`error-alert`)).toHaveTextContent(`boom`)
  })

  it(`shows a generic failure message when the request itself errors`, async () => {
    ;(functionsApi.invoke as any).mockResolvedValue({ error: new Error(`network down`) })

    render(
      <FunctionTestPanel
        func={func}
        orgId='org-1'
        projectId='proj-1'
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByText(`Invoke`))
    })

    expect(screen.getByTestId(`error-alert`)).toHaveTextContent(
      `Failed to invoke function. Please try again.`
    )
  })

  it(`clears the output when Clear is clicked`, async () => {
    ;(functionsApi.invoke as any).mockResolvedValue({
      data: { result: { y: 2 }, logs: ``, durationMs: 1 },
    })

    render(
      <FunctionTestPanel
        func={func}
        orgId='org-1'
        projectId='proj-1'
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByText(`Invoke`))
    })
    expect(screen.getByText(`Success`)).toBeInTheDocument()

    fireEvent.click(screen.getByText(`Clear`))
    expect(screen.queryByText(`Success`)).not.toBeInTheDocument()
  })
})
