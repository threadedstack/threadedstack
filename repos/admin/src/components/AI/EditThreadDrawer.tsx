import type { Thread } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { useProviders } from '@TAF/state/selectors'
import { Stack, Alert, Divider } from '@mui/material'
import { ProviderSelectorSingle } from '@TAF/components/Selectors'
import { updateThread } from '@TAF/actions/threads/api/updateThread'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Loading, Drawer, TextInput, SwitchInput, DrawerActions } from '@tdsk/components'

export type TEditThreadDrawerProps = {
  open: boolean
  thread: Thread | null
  onSuccess: () => void
  onClose: () => void
}

export const EditThreadDrawer = (props: TEditThreadDrawerProps) => {
  const { open, thread, onSuccess, onClose: onCloseCB } = props

  const [providers] = useProviders()

  const [name, setName] = useState('')
  const [publicThread, setPublicThread] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (thread) {
      setName(thread.name || '')
      setPublicThread(thread.public || false)
      setSelectedProviderId(thread.providerId || '')
    }
  }, [thread])

  const availableProviders = Object.values(providers || {}).filter(
    (provider) => provider.type === 'ai' && (!thread || provider.orgId === thread.orgId)
  )

  const onClose = () => {
    if (loading) return

    setName('')
    setPublicThread(false)
    setSelectedProviderId('')
    setError(null)
    onCloseCB?.()
  }

  const onSave = async () => {
    if (!thread || !name.trim()) return

    setLoading(true)
    setError(null)

    const threadData: Partial<Thread> = {
      name: name.trim(),
      public: publicThread,
    }

    if (selectedProviderId) {
      threadData.providerId = selectedProviderId
    }

    const result = await updateThread(thread.orgId, thread.agentId, thread.id, threadData)

    if (result.error) {
      setError(result.error.message)
    } else {
      onSuccess()
      onCloseCB?.()
    }

    setLoading(false)
  }

  const { actions } = useDrawerActions({ onSave, onClose })

  if (!thread) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Edit Thread'
      actions={
        <DrawerActions
          editing={true}
          actions={actions}
          loading={loading}
          form='edit-thread-form'
          disabled={loading || !name.trim()}
        />
      }
    >
      {loading && <Loading />}

      {!loading && (
        <>
          {error && (
            <Alert
              color='error'
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}

          <form id='edit-thread-form'>
            <Stack spacing={3}>
              <TextInput
                fullWidth
                required
                autoFocus
                value={name}
                label='Thread Name'
                id='edit-thread-name'
                onChange={(e) => setName(e.target.value)}
              />

              <TextInput
                disabled
                fullWidth
                label='Thread ID'
                value={thread.id}
                id='edit-thread-id'
              />

              <Divider />

              <ProviderSelectorSingle
                loading={loading}
                providerId={selectedProviderId}
                onChange={setSelectedProviderId}
                providers={availableProviders.map((p) => ({
                  id: p.id,
                  name: p.name || p.id,
                }))}
              />

              <Divider />

              <SwitchInput
                id='edit-thread-public'
                label='Public Thread'
                checked={publicThread}
                onChange={(e, checked) => setPublicThread(checked)}
              />
            </Stack>
          </form>
        </>
      )}
    </Drawer>
  )
}
