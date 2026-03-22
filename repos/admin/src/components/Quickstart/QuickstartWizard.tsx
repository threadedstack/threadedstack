import { QSSteps } from '@TAF/constants/nav'
import { styled } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { Drawer, DrawerActions } from '@tdsk/components'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { AgentStep } from '@TAF/components/Quickstart/AgentStep'
import { ReviewStep } from '@TAF/components/Quickstart/ReviewStep'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useQuickStart } from '@TAF/hooks/components/useQuickStart'
import { Box, Step, Stepper, StepLabel, Fade } from '@mui/material'
import { ProviderStep } from '@TAF/components/Quickstart/ProviderStep'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined'

const WizardStepper = styled(Stepper)(({ theme }) => ({
  padding: theme.spacing(2, 0, 1),
  '& .MuiStepLabel-label': {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 500,
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
  const isFirstStep = activeStep === 0

  const drawerActions = isFirstStep
    ? {
        cancel: {
          onClick: onClose,
        },
        create: {
          text: `Next`,
          onClick: onSave,
          Icon: ArrowForwardIcon,
          color: `primary` as const,
          variant: `contained` as const,
          disabled: loading || !canNext,
        },
      }
    : {
        remove: {
          text: `Cancel`,
          Icon: CloseIcon,
          onClick: onClose,
          variant: `text` as const,
          color: `inherit` as const,
        },
        cancel: {
          text: `Back`,
          onClick: onBack,
          Icon: ArrowBackIcon,
          color: `secondary` as const,
          variant: `outlined` as const,
        },
        save: {
          onClick: onSave,
          variant: `contained` as const,
          disabled: loading || !canNext,
          text: isLastStep ? `Create Everything` : `Next`,
          Icon: isLastStep ? AddCircleOutlineIcon : ArrowForwardIcon,
          color: isLastStep ? (`success` as const) : (`primary` as const),
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
          loading={loading}
          disabled={loading}
          actions={drawerActions}
          editing={!isFirstStep}
          saveDisabled={loading || !canNext}
          createDisabled={loading || !canNext}
        />
      }
    >
      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
        <WizardStepper
          alternativeLabel
          activeStep={activeStep}
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

        <Box>
          <Fade
            in={activeStep === 0}
            mountOnEnter
            unmountOnExit
            timeout={300}
          >
            <div>
              <ProviderStep
                disabled={loading}
                data={providerData}
                onChange={onProviderChange}
              />
            </div>
          </Fade>

          <Fade
            mountOnEnter
            unmountOnExit
            timeout={300}
            in={activeStep === 1}
          >
            <div>
              <AgentStep
                data={agentData}
                disabled={loading}
                onChange={onAgentChange}
              />
            </div>
          </Fade>

          <Fade
            mountOnEnter
            unmountOnExit
            timeout={300}
            in={activeStep === 2}
          >
            <div>
              <ReviewStep
                agent={agentData}
                provider={providerData}
              />
            </div>
          </Fade>
        </Box>
      </Box>
    </Drawer>
  )
}
