import type { TProviderStepData, TAgentStepData } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { QSSteps } from '@TAF/constants/nav'
import { ProviderTemplates } from '@tdsk/domain'
import { useState, useMemo, useCallback } from 'react'
import { useSteps } from '@TAF/hooks/components/useSteps'
import { createQuickstart } from '@TAF/actions/quickstart/api/create'

export type THQuickStart = {
  orgId: string
  onClose: () => void
}

export const useQuickStart = (props: THQuickStart) => {
  const { orgId, onClose: onCloseCB } = props

  const [loading, setLoading] = useState(false)

  const { error, onBack, onNext, setError, activeStep, setActiveStep } = useSteps({
    steps: QSSteps,
  })

  const [providerData, setProviderData] = useState<TProviderStepData>({
    model: ``,
    apiKey: ``,
    providerUrl: ``,
    providerTemp: ``,
    providerName: ``,
  })

  const [agentData, setAgentData] = useState<TAgentStepData>({
    agentName: ``,
    projectName: ``,
    systemPrompt: ``,
    agentDescription: ``,
  })

  const onProviderChange = useCallback(
    (updates: Partial<TProviderStepData>) => {
      setProviderData((prev) => {
        const next = { ...prev, ...updates }

        // Auto-suggest project and agent names when provider is first selected
        if (updates.providerTemp && updates.providerTemp !== prev.providerTemp) {
          const tmpl = ProviderTemplates[updates.providerTemp]
          if (tmpl && !agentData.projectName && !agentData.agentName) {
            const name = tmpl.name.replace(/\s+/g, `-`).toLowerCase()
            setAgentData((a) => ({
              ...a,
              projectName: a.projectName || `My ${tmpl.name} Project`,
              agentName: a.agentName || `${name}-agent`,
            }))
          }
        }

        return next
      })
    },
    [agentData.projectName, agentData.agentName]
  )

  const onAgentChange = useCallback((updates: Partial<TAgentStepData>) => {
    setAgentData((prev) => ({ ...prev, ...updates }))
  }, [])

  const canNext = useMemo(() => {
    if (activeStep === 0) {
      if (!providerData.providerTemp || !providerData.apiKey) return false
      if (providerData.providerTemp === `custom`) {
        return !!(
          providerData.providerName &&
          providerData.providerUrl &&
          providerData.model
        )
      }
      return !!providerData.model
    }
    if (activeStep === 1) return !!(agentData.projectName && agentData.agentName)
    return true
  }, [activeStep, providerData, agentData])

  const onClose = useCallback(() => {
    if (loading) return
    setActiveStep(0)
    setError(null)
    setProviderData({
      model: ``,
      apiKey: ``,
      providerUrl: ``,
      providerTemp: ``,
      providerName: ``,
    })
    setAgentData({
      projectName: ``,
      agentName: ``,
      agentDescription: ``,
      systemPrompt: ``,
    })
    onCloseCB?.()
  }, [loading, onCloseCB])

  const onSubmit = useCallback(async () => {
    setLoading(true)
    setError(null)

    const template = ProviderTemplates[providerData.providerTemp]
    const modelEntry = template?.models?.find((m) => m.id === providerData.model)

    const resp = await createQuickstart({
      orgId,
      agent: agentData,
      model: modelEntry,
      provider: providerData,
    })

    setLoading(false)

    if (resp.error)
      setError(resp.error.message || `Failed to create resources. Please try again.`)
    else {
      const projectId = resp.data?.project?.id
      onClose()
      projectId && nav.route(ERoutePath.OrgProject, { orgId, projectId })
    }
  }, [orgId, providerData, agentData, onClose])

  const onSave = useCallback(
    (evt: any) => {
      evt?.preventDefault?.()
      activeStep === QSSteps.length - 1 ? onSubmit() : onNext()
    },
    [onNext, onSubmit, activeStep]
  )

  return {
    error,
    onBack,
    onSave,
    onClose,
    loading,
    canNext,
    setError,
    agentData,
    activeStep,
    providerData,
    onAgentChange,
    onProviderChange,
  }
}
