import { useMemo } from 'react'
import { EntitySelectorSingle } from './EntitySelector'

export type TEndpointSelector = {
  loading?: boolean
  disabled?: boolean
  endpointId: string
  required?: boolean
  onChange: (endpointId: string) => void
  endpoints: Array<{ id: string; name: string; type?: string }>
}

export const EndpointSelector = (props: TEndpointSelector) => {
  const { loading, disabled, required, endpointId, endpoints, onChange } = props

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
      options={options}
      required={required}
      disabled={disabled}
      value={endpointId || null}
      placeholder='Select endpoint...'
      onChange={(id) => onChange(id || '')}
      description={
        loading
          ? `Loading endpoints...`
          : endpoints.length === 0
            ? `No endpoints available.`
            : `Select an endpoint`
      }
    />
  )
}
