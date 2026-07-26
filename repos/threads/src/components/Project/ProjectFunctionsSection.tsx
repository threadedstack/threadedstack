import type { Function as FunctionModel } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { useEffect, useState } from 'react'
import Typography from '@mui/material/Typography'
import { functionApi } from '@TTH/services/functionApi'
import { MonoFont } from '@TTH/constants/values'
import { Functions as FunctionsIcon } from '@mui/icons-material'
import { EmptyState } from '@TTH/components/EmptyState/EmptyState'
import { RowList, PillMono, SectionHeader } from '@TTH/components/PagePrimitives'

const FunctionColumns = [
  { label: `Name`, width: `1fr` },
  { label: `Language`, width: `120px` },
  { label: `Endpoint`, width: `160px` },
]

export type TProjectFunctionsSection = {
  orgId: string
  projectId: string
}

export const ProjectFunctionsSection = (props: TProjectFunctionsSection) => {
  const { orgId, projectId } = props
  const [functions, setFunctions] = useState<FunctionModel[]>([])

  useEffect(() => {
    let cancelled = false

    functionApi.list(orgId, projectId).then((resp) => {
      if (!cancelled) setFunctions(resp.data || [])
    })

    return () => {
      cancelled = true
    }
  }, [orgId, projectId])

  return (
    <>
      <SectionHeader
        title='Functions'
        count={functions.length}
      />

      {functions.length === 0 ? (
        <EmptyState
          icon={<FunctionsIcon />}
          title='No functions configured for this project'
        />
      ) : (
        <RowList columns={FunctionColumns}>
          {functions.map((func, idx) => (
            <RowList.Row
              key={func.id}
              isLast={idx === functions.length - 1}
            >
              {/* Name */}
              <Box sx={{ display: `flex`, alignItems: `center` }}>
                <Typography
                  noWrap
                  sx={{ fontSize: `13px`, fontWeight: 600 }}
                >
                  {func.name}
                </Typography>
              </Box>

              {/* Language */}
              <Box sx={{ display: `flex`, alignItems: `center` }}>
                <PillMono>{func.language}</PillMono>
              </Box>

              {/* Endpoint */}
              <Box sx={{ display: `flex`, alignItems: `center` }}>
                <Typography
                  noWrap
                  sx={{
                    fontSize: `12px`,
                    fontFamily: MonoFont,
                    color: `text.secondary`,
                  }}
                >
                  {func.endpointId || `-`}
                </Typography>
              </Box>
            </RowList.Row>
          ))}
        </RowList>
      )}
    </>
  )
}
