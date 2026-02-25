import { useMemo } from 'react'
import { EntitySelectorSingle } from './EntitySelector'

export type TEndpointSelector = {
  loading?: boolean
  disabled?: boolean
  endpointId: string
  endpoints: Array<{ id: string; name: string; type?: string }>
  onChange: (endpointId: string) => void
}

export const EndpointSelector = (props: TEndpointSelector) => {
  const { loading, disabled, endpointId, endpoints, onChange } = props

  const options = useMemo(
    () =>
      endpoints.map((e) => ({
        id: e.id,
        label: e.name || e.id,
        secondary: e.type,
      })),
    [endpoints]
  )

  return (
    <EntitySelectorSingle
      id='endpoint-id'
      label='Endpoint'
      loading={loading}
      disabled={disabled}
      value={endpointId || null}
      options={options}
      onChange={(id) => onChange(id || '')}
      placeholder='Select endpoint...'
      description={
        loading
          ? 'Loading endpoints...'
          : endpoints.length === 0
            ? 'No endpoints available.'
            : 'Select an endpoint'
      }
    />
  )
}
