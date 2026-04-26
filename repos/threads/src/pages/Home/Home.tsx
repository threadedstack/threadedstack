import { Navigate } from 'react-router'
import { useOrgId } from '@TTH/state/selectors'

const Home = () => {
  const [orgId] = useOrgId()
  if (orgId)
    return (
      <Navigate
        replace
        to={`/orgs/${orgId}/projects`}
      />
    )
  return (
    <Navigate
      replace
      to='/orgs'
    />
  )
}

export default Home
