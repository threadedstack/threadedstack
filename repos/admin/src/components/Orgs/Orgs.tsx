import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { NoOrgs } from '@TAF/components/Orgs/NoOrgs'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchOrgs } from '@TAF/actions/orgs/fetchOrgs'
import { OrgsGrid } from '@TAF/components/Orgs/OrgsGrid'
import { useOrgs, useActiveOrgId } from '@TAF/state/selectors'
import { CreateOrgDialog } from '@TAF/components/Orgs/CreateOrgDialog'
import { Card, Typography, CardContent } from '@mui/material'

export type TOrgs = {}

export const Orgs = (props: TOrgs) => {
  const [orgs] = useOrgs()
  const navigate = useNavigate()
  const [activeOrgId] = useActiveOrgId()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const loadOrgs = async () => {
      setLoading(true)
      await fetchOrgs()
      setLoading(false)
    }
    loadOrgs()
  }, [])

  const onSelectOrg = (orgId: string) => {
    setActiveOrgId(orgId)
    navigate(`/orgs/${orgId}`)
  }

  const onCreate = () => setCreating(true)

  const orgsArray = orgs ? Object.values(orgs) : []

  return (
    <>
      {loading ? (
        <Card>
          <CardContent>
            <Typography align='center'>Loading...</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {orgsArray.length === 0 ? (
            <NoOrgs onCreate={onCreate} />
          ) : (
            <>
              <OrgsGrid
                orgs={orgsArray}
                onSelect={onSelectOrg}
                activeOrgId={activeOrgId}
              />

              <CreateOrgDialog
                open={creating}
                onCreate={onCreate}
                onClose={() => setCreating(false)}
              />
            </>
          )}
        </>
      )}
    </>
  )
}
