import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router'

export const useUnsavedChangesGuard = (isDirty: boolean) => {
  const [showDialog, setShowDialog] = useState(false)
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    blocker.state === `blocked` && setShowDialog(true)
  }, [blocker.state])

  useEffect(() => {
    if (!isDirty) return

    const handler = (evt: BeforeUnloadEvent) => evt.preventDefault()

    window.addEventListener(`beforeunload`, handler)
    return () => window.removeEventListener(`beforeunload`, handler)
  }, [isDirty])

  const onConfirmLeave = useCallback(() => {
    setShowDialog(false)
    blocker.state === `blocked` && blocker.proceed?.()
  }, [blocker])

  const onCancelLeave = useCallback(() => {
    setShowDialog(false)
    blocker.state === `blocked` && blocker.reset?.()
  }, [blocker])

  return { showDialog, onConfirmLeave, onCancelLeave }
}
