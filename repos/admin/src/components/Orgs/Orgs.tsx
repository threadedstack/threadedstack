import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { NoOrgs } from '@TAF/components/Orgs/NoOrgs'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchOrgs } from '@TAF/actions/orgs/fetchOrgs'
import { deleteOrg } from '@TAF/actions/orgs/deleteOrg'
import { OrgsGrid } from '@TAF/components/Orgs/OrgsGrid'
import { Card, Typography, CardContent } from '@mui/material'
import { useOrgs, useActiveOrgId } from '@TAF/state/selectors'
import { useIsAdmin } from '@TAF/hooks/permissions/useIsAdmin'
import { CreateOrgDialog } from '@TAF/components/Orgs/CreateOrgDialog'

export type TOrgs = {}

export const Orgs = (props: TOrgs) => {
  const [orgs] = useOrgs()
  const admin = useIsAdmin()
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

  const onCreate = () => setCreating(true)
  const onDelete = async (orgId: string) => {
    orgId && (await deleteOrg(orgId))
  }
  const onSelect = (orgId: string) => {
    setActiveOrgId(orgId)
    navigate(`/orgs/${orgId}`)
  }

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
                showDelete={admin}
                onDelete={onDelete}
                onSelect={onSelect}
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
