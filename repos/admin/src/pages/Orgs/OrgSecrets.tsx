import { useParams } from 'react-router'
import { useEffect } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { Secrets } from '@TAF/components/Secrets/Secrets'
import { setActiveOrgId } from '@TAF/state/accessors'

export type TOrgSecrets = {}

export const OrgSecrets = (props: TOrgSecrets) => {
  const { orgId } = useParams<{ orgId: string }>()

  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  return (
    <Page className='tdsk-org-secrets-page'>
      <Secrets orgId={orgId} />
    </Page>
  )
}

export default OrgSecrets
