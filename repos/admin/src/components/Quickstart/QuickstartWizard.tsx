import { QSSteps } from '@TAF/constants/nav'
import { Button, Drawer } from '@tdsk/components'
import { AgentStep } from '@TAF/components/Quickstart/AgentStep'
import { ReviewStep } from '@TAF/components/Quickstart/ReviewStep'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useQuickStart } from '@TAF/hooks/components/useQuickStart'
import { ProviderStep } from '@TAF/components/Quickstart/ProviderStep'
import { Box, Step, Stepper, StepLabel, CircularProgress } from '@mui/material'

export type TQuickstartWizard = {
  open: boolean
  orgId: string
  onClose: () => void
}

export const QuickstartWizard = (props: TQuickstartWizard) => {
  const { open } = props

  const {
    error,
    onBack,
    canNext,
    onSave,
    onClose,
    loading,
    setError,
    agentData,
    activeStep,
    providerData,
    onAgentChange,
    onProviderChange,
  } = useQuickStart(props)

  const saveLabel = activeStep === QSSteps.length - 1 ? `Create Everything` : `Next`

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Quick Start'
      actions={
        <Box
          sx={{ display: `flex`, gap: 1, width: `100%`, justifyContent: `space-between` }}
        >
          <Button
            color='secondary'
            variant='text'
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Box sx={{ display: `flex`, gap: 1 }}>
            {activeStep > 0 && (
              <Button
                color='secondary'
                variant='outlined'
                disabled={loading}
                onClick={onBack}
              >
                Back
              </Button>
            )}
            <Button
              color='primary'
              variant='contained'
              disabled={loading || !canNext}
              onClick={onSave}
            >
              {loading ? (
                <CircularProgress
                  size={20}
                  color='inherit'
                />
              ) : (
                saveLabel
              )}
            </Button>
          </Box>
        </Box>
      }
    >
      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 3 }}>
        <Stepper
          activeStep={activeStep}
          alternativeLabel
        >
          {QSSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <ErrorAlert
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {activeStep === 0 && (
          <ProviderStep
            data={providerData}
            onChange={onProviderChange}
            disabled={loading}
          />
        )}

        {activeStep === 1 && (
          <AgentStep
            data={agentData}
            onChange={onAgentChange}
            disabled={loading}
          />
        )}

        {activeStep === 2 && (
          <ReviewStep
            provider={providerData}
            agent={agentData}
          />
        )}
      </Box>
    </Drawer>
  )
}
