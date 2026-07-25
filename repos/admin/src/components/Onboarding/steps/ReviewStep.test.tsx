import type { ReactNode } from 'react'

import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ReviewStep } from './ReviewStep'

const theme = makeTheme({ type: `light` })
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const baseProps = {
  error: null,
  submitStep: null,
  completion: null,
  onStepClick: vi.fn(),
  onGoToProject: vi.fn(),
  onCreateFunction: vi.fn(),
  onCreateEndpoint: vi.fn(),
  getStepResult: vi.fn(() => ({ outcome: `skipped` as const })),
}

describe('ReviewStep', () => {
  it('renders the Review & Finish summary when there is no completion state', () => {
    renderWithTheme(<ReviewStep {...baseProps} />)

    expect(screen.getByText(`Review & Finish`)).toBeInTheDocument()
    expect(screen.queryByText(`You're all set`)).not.toBeInTheDocument()
  })

  it('renders the completion panel instead of the review summary when completion is set', () => {
    renderWithTheme(
      <ReviewStep
        {...baseProps}
        completion={{ orgId: `org-1`, projectId: `proj-1` }}
      />
    )

    expect(screen.getByText(`You're all set`)).toBeInTheDocument()
    expect(screen.queryByText(`Review & Finish`)).not.toBeInTheDocument()
  })

  it('calls onCreateFunction when the Create a Function CTA is clicked', () => {
    const onCreateFunction = vi.fn()
    renderWithTheme(
      <ReviewStep
        {...baseProps}
        completion={{ orgId: `org-1`, projectId: `proj-1` }}
        onCreateFunction={onCreateFunction}
      />
    )

    fireEvent.click(screen.getByText(`Create a Function`))
    expect(onCreateFunction).toHaveBeenCalledTimes(1)
  })

  it('calls onCreateEndpoint when the Create an Endpoint CTA is clicked', () => {
    const onCreateEndpoint = vi.fn()
    renderWithTheme(
      <ReviewStep
        {...baseProps}
        completion={{ orgId: `org-1`, projectId: `proj-1` }}
        onCreateEndpoint={onCreateEndpoint}
      />
    )

    fireEvent.click(screen.getByText(`Create an Endpoint`))
    expect(onCreateEndpoint).toHaveBeenCalledTimes(1)
  })

  it('calls onGoToProject when the skip link is clicked', () => {
    const onGoToProject = vi.fn()
    renderWithTheme(
      <ReviewStep
        {...baseProps}
        completion={{ orgId: `org-1`, projectId: `proj-1` }}
        onGoToProject={onGoToProject}
      />
    )

    fireEvent.click(screen.getByText(`Go to project`))
    expect(onGoToProject).toHaveBeenCalledTimes(1)
  })
})
