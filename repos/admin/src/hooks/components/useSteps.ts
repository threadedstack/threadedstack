import { useState, useMemo, useCallback } from 'react'

export type THSteps = {
  steps: string[]
}

export const useSteps = (props: THSteps) => {
  const { steps } = props

  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onNext = useCallback(() => {
    if (activeStep < steps.length - 1) {
      setError(null)
      setActiveStep((s) => s + 1)
    }
  }, [activeStep])

  const onBack = useCallback(() => {
    if (activeStep > 0) {
      setError(null)
      setActiveStep((s) => s - 1)
    }
  }, [activeStep])

  return {
    error,
    onBack,
    onNext,
    setError,
    activeStep,
    setActiveStep,
  }
}
