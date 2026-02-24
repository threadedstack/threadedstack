import type { ReactElement, ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { useQuickStart } from '@TAF/hooks/components/useQuickStart'

vi.mock('@TAF/hooks/components/useQuickStart', () => ({
  useQuickStart: vi.fn(),
}))

vi.mock('@TAF/hooks/components/useDrawerActions', () => ({
  useDrawerActions: vi.fn((props: any) => ({
    actions: {
      remove: { onClick: props?.onRemove },
      cancel: { onClick: props?.onClose },
      save: { onClick: props?.onSave },
    },
  })),
}))

vi.mock('@TAF/components/Quickstart/ProviderStep', () => ({
  ProviderStep: () => <div data-testid='provider-step' />,
}))

vi.mock('@TAF/components/Quickstart/AgentStep', () => ({
  AgentStep: () => <div data-testid='agent-step' />,
}))

vi.mock('@TAF/components/Quickstart/ReviewStep', () => ({
  ReviewStep: () => <div data-testid='review-step' />,
}))

vi.mock('@TAF/components/ErrorAlert/ErrorAlert', () => ({
  ErrorAlert: () => null,
}))

import { QuickstartWizard } from './QuickstartWizard'

/**
 * Minimal MUI theme for test rendering
 * The @tdsk/components makeTheme requires env vars not available in tests,
 * so we create a basic theme with the gutter extensions DrawerActions needs
 */
const testTheme = createTheme({})
// DrawerActions uses theme.gutter.px and theme.gutter.mpx
;(testTheme as any).gutter = { px: '8px', mpx: '16px' }

const renderWithTheme = (ui: ReactElement) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={testTheme}>{children}</ThemeProvider>
  )
  return render(ui, { wrapper: Wrapper })
}

const baseHookReturn = {
  error: null,
  onBack: vi.fn(),
  canNext: true,
  onSave: vi.fn(),
  onClose: vi.fn(),
  loading: false,
  setError: vi.fn(),
  agentData: {
    projectName: '',
    agentName: '',
    systemPrompt: '',
    agentDescription: '',
  },
  activeStep: 0,
  providerData: {
    model: '',
    apiKey: '',
    providerUrl: '',
    providerName: '',
    providerBrand: null,
  },
  onAgentChange: vi.fn(),
  onProviderChange: vi.fn(),
}

const defaultProps = {
  open: true,
  orgId: 'org-1',
  onClose: vi.fn(),
}

describe('QuickstartWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useQuickStart).mockReturnValue(baseHookReturn as any)
  })

  describe('Step 0 - Provider', () => {
    it('should render Cancel and Next buttons', () => {
      renderWithTheme(<QuickstartWizard {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      const buttonTexts = buttons.map((b) => b.textContent)

      expect(buttonTexts).toContain('Cancel')
      expect(buttonTexts).toContain('Next')
    })
  })

  describe('Step 1 - Agent', () => {
    beforeEach(() => {
      vi.mocked(useQuickStart).mockReturnValue({
        ...baseHookReturn,
        activeStep: 1,
      } as any)
    })

    it('should render Cancel (left), Back, and Next buttons', () => {
      renderWithTheme(<QuickstartWizard {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      const buttonTexts = buttons.map((b) => b.textContent)

      expect(buttonTexts).toContain('Cancel')
      expect(buttonTexts).toContain('Back')
      expect(buttonTexts).toContain('Next')
    })
  })

  describe('Step 2 - Review', () => {
    beforeEach(() => {
      vi.mocked(useQuickStart).mockReturnValue({
        ...baseHookReturn,
        activeStep: 2,
      } as any)
    })

    it('should render Cancel (left), Back, and Create Everything buttons', () => {
      renderWithTheme(<QuickstartWizard {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      const buttonTexts = buttons.map((b) => b.textContent)

      expect(buttonTexts).toContain('Cancel')
      expect(buttonTexts).toContain('Back')
      expect(buttonTexts).toContain('Create Everything')
    })
  })

  describe('Cancel button behavior', () => {
    it('should call onClose when Cancel is clicked on step 0', async () => {
      const user = userEvent.setup()
      const mockOnClose = vi.fn()

      vi.mocked(useQuickStart).mockReturnValue({
        ...baseHookReturn,
        onClose: mockOnClose,
      } as any)

      renderWithTheme(<QuickstartWizard {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      await user.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onClose when Cancel (left) is clicked on step > 0', async () => {
      const user = userEvent.setup()
      const mockOnClose = vi.fn()

      vi.mocked(useQuickStart).mockReturnValue({
        ...baseHookReturn,
        activeStep: 1,
        onClose: mockOnClose,
      } as any)

      renderWithTheme(<QuickstartWizard {...defaultProps} />)

      // On step > 0, there are two buttons with Cancel-related text:
      // "Cancel" (left, the remove slot) and "Back" (center-right)
      // The left Cancel button is the first one
      const cancelButtons = screen
        .getAllByRole('button')
        .filter((b) => b.textContent === 'Cancel')
      expect(cancelButtons.length).toBeGreaterThanOrEqual(1)

      await user.click(cancelButtons[0])

      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
