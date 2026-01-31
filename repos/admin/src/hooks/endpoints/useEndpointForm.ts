import { useEffect, useRef } from 'react'

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
  const validateTriggerRef = useRef(0)

  // Expose config to parent
  useEffect(() => {
    const config = mapToConfig(state)
    onConfigChange(config)
  }, [state, mapToConfig, onConfigChange])

  // Validate when requested
  useEffect(() => {
    if (validateTriggerRef.current > 0) {
      const error = validate(state)
      onValidate(error)
      validateTriggerRef.current = 0
    }
  }, [validateTriggerRef.current, state, validate, onValidate])

  // Trigger validation from parent
  useEffect(() => {
    if (onValidate) {
      validateTriggerRef.current++
    }
  }, [onValidate])
}
