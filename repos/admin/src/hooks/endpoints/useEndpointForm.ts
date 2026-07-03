import { useEffect, useState } from 'react'

/**
 * Shared hook for endpoint form validation and config exposure
 * Handles the common pattern of:
 * 1. Exposing config to parent on state changes
 * 2. Triggering validation when requested
 */
export const useEndpointForm = <T>(
  state: any,
  mapToConfig: (state: any) => T,
  validate: (state: any) => string | null,
  onConfigChange: (config: T) => void,
  onValidate: (error: string | null) => void
) => {
  const [validateTrigger, setValidateTrigger] = useState(0)

  // Expose config to parent
  useEffect(() => {
    const config = mapToConfig(state)
    onConfigChange(config)
  }, [state, mapToConfig, onConfigChange])

  // Validate when requested
  useEffect(() => {
    if (validateTrigger > 0) {
      const error = validate(state)
      onValidate(error)
      setValidateTrigger(0)
    }
  }, [validateTrigger, state, validate, onValidate])

  // Trigger validation from parent
  useEffect(() => {
    if (onValidate) {
      setValidateTrigger((count) => count + 1)
    }
  }, [onValidate])
}
