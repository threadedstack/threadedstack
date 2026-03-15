import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createTheme, ThemeProvider } from '@mui/material/styles'

import { ReviewStep } from './ReviewStep'

const theme = createTheme()
const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const providerData = {
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-test',
  providerUrl: '',
  providerName: '',
  providerBrand: 'anthropic' as const,
}

const agentData = {
  projectName: 'My Test Project',
  agentName: 'test-agent',
  systemPrompt: '',
  agentDescription: 'A test agent',
}

describe(`ReviewStep`, () => {
  const renderReviewStep = () =>
    renderWithTheme(
      <ReviewStep
        provider={providerData}
        agent={agentData}
      />
    )

  it(`renders the header text`, () => {
    renderReviewStep()
    expect(screen.getByText(`Ready to create 5 resources`)).toBeInTheDocument()
  })

  it(`renders all 5 resource labels`, () => {
    renderReviewStep()
    expect(screen.getByText(`Provider`)).toBeInTheDocument()
    expect(screen.getByText(`Secret`)).toBeInTheDocument()
    expect(screen.getAllByText(`Project`).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(`Agent`)).toBeInTheDocument()
    expect(screen.getByText(`Endpoint`)).toBeInTheDocument()
  })

  it(`displays the provider name from data`, () => {
    renderReviewStep()
    expect(screen.getByText(`Anthropic`)).toBeInTheDocument()
  })

  it(`displays the project name from data`, () => {
    renderReviewStep()
    expect(screen.getByText(`My Test Project`)).toBeInTheDocument()
  })

  it(`displays the agent name from data`, () => {
    renderReviewStep()
    expect(screen.getByText(`test-agent`)).toBeInTheDocument()
  })
})
