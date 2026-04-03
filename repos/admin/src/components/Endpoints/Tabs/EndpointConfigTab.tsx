import { Typography } from '@mui/material'
import { EEndpointType } from '@tdsk/domain'
import { useActiveEndpoint } from '@TAF/state/selectors'
import { ProxyConfigTab } from './ProxyConfigTab'
import { FaasConfigTab } from './FaasConfigTab'
import { AgentConfigTab } from './AgentConfigTab'

const EndpointConfigTab = () => {
  const [endpoint] = useActiveEndpoint()

  if (!endpoint) return null

  switch (endpoint.type) {
    case EEndpointType.proxy:
      return <ProxyConfigTab />
    case EEndpointType.faas:
      return <FaasConfigTab />
    case EEndpointType.agent:
      return <AgentConfigTab />
    default:
      return (
        <Typography color='text.secondary'>
          Configuration is not available for endpoint type "{endpoint.type}".
        </Typography>
      )
  }
}

export default EndpointConfigTab
