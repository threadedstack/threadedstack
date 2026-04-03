import { useActiveEndpoint, useActiveProjectId } from '@TAF/state/selectors'
import { EndpointTestPanel } from '@TAF/components/Endpoints/EndpointTestPanel'

const EndpointTestTab = () => {
  const [endpoint] = useActiveEndpoint()
  const [projectId] = useActiveProjectId()

  if (!endpoint || !projectId) return null

  return (
    <EndpointTestPanel
      endpoint={endpoint}
      projectId={projectId}
    />
  )
}

export default EndpointTestTab
