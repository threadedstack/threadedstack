import { QSSteps } from '@TAF/constants/nav'
import { Drawer, DrawerActions } from '@tdsk/components'
import { AgentStep } from '@TAF/components/Quickstart/AgentStep'
import { ReviewStep } from '@TAF/components/Quickstart/ReviewStep'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useQuickStart } from '@TAF/hooks/components/useQuickStart'
import { ProviderStep } from '@TAF/components/Quickstart/ProviderStep'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Box, Step, Stepper, StepLabel, Fade } from '@mui/material'
import { styled } from '@mui/material/styles'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined'

const WizardStepper = styled(Stepper)(({ theme }) => ({
  padding: theme.spacing(2, 0, 1),
  '& .MuiStepLabel-label': {
    fontSize: `0.75rem`,
    fontWeight: 500,
    letterSpacing: `0.02em`,
    marginTop: `${theme.spacing(0.75)} !important`,
  },
  '& .MuiStepLabel-label.Mui-active': {
    fontWeight: 600,
    color: theme.palette.primary.main,
  },
  '& .MuiStepLabel-label.Mui-completed': {
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  '& .MuiStepIcon-root': {
    fontSize: `1.75rem`,
    color: theme.palette.action.disabled,
    transition: `all 0.3s ease`,
  },
  '& .MuiStepIcon-root.Mui-active': {
    color: theme.palette.primary.main,
    filter: `drop-shadow(0 0 6px ${theme.palette.primary.main}40)`,
  },
  '& .MuiStepIcon-root.Mui-completed': {
    color: theme.palette.success.main,
  },
  '& .MuiStepConnector-line': {
    borderColor: theme.palette.divider,
    borderTopWidth: 2,
  },
  '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
    borderColor: theme.palette.primary.main,
  },
  '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
    borderColor: theme.palette.success.main,
  },
}))

const StepContent = styled(Box)({
  minHeight: 200,
})

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

  const isLastStep = activeStep === QSSteps.length - 1

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  const drawerActions = {
    ...actions,
    cancel: {
      ...actions.cancel,
      ...(activeStep > 0
        ? {
            text: `Back`,
            Icon: ArrowBackIcon,
            color: `secondary` as const,
            variant: `outlined` as const,
            onClick: onBack,
          }
        : {}),
    },
    create: {
      ...actions.save,
      text: isLastStep ? `Create Everything` : `Next`,
      Icon: isLastStep ? AddCircleOutlineIcon : ArrowForwardIcon,
      color: isLastStep ? (`success` as const) : (`primary` as const),
      variant: `contained` as const,
      onClick: onSave,
      disabled: loading || !canNext,
    },
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Quick Start'
      titleIcon={
        <RocketLaunchIcon
          sx={{
            fontSize: 20,
            color: `primary.main`,
          }}
        />
      }
      actions={
        <DrawerActions
          actions={drawerActions}
          loading={loading}
          disabled={loading}
          createDisabled={loading || !canNext}
        />
      }
    >
      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
        <WizardStepper
          activeStep={activeStep}
          alternativeLabel
        >
          {QSSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </WizardStepper>

        {error && (
          <ErrorAlert
            message={error}
            onClose={() => setError(null)}
          />
        )}

        <StepContent>
          <Fade
            in={activeStep === 0}
            mountOnEnter
            unmountOnExit
            timeout={300}
          >
            <div>
              <ProviderStep
                data={providerData}
                onChange={onProviderChange}
                disabled={loading}
              />
            </div>
          </Fade>

          <Fade
            in={activeStep === 1}
            mountOnEnter
            unmountOnExit
            timeout={300}
          >
            <div>
              <AgentStep
                data={agentData}
                onChange={onAgentChange}
                disabled={loading}
              />
            </div>
          </Fade>

          <Fade
            in={activeStep === 2}
            mountOnEnter
            unmountOnExit
            timeout={300}
          >
            <div>
              <ReviewStep
                provider={providerData}
                agent={agentData}
              />
            </div>
          </Fade>
        </StepContent>
      </Box>
    </Drawer>
  )
}
