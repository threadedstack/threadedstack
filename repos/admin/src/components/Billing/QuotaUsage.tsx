import { useOrgQuota, useOrgLimits } from '@TAF/state/selectors'
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Alert,
} from '@mui/material'

export type TQuotaUsage = {
  orgId: string
}

type TQuotaItem = {
  label: string
  current: number
  limit: number
  unit?: string
}

const formatValue = (value: number | undefined, unit?: string): string => {
  if (value === undefined) return 'N/A'
  if (value === -1 || value === Number.POSITIVE_INFINITY) return 'Unlimited'
  return unit ? `${value} ${unit}` : String(value)
}

const getProgress = (current: number, limit: number): number => {
  if (limit === -1 || limit === Number.POSITIVE_INFINITY) return 0
  if (limit === 0) return 100
  return Math.min((current / limit) * 100, 100)
}

const getProgressColor = (percentage: number): 'success' | 'warning' | 'error' => {
  if (percentage < 70) return 'success'
  if (percentage < 90) return 'warning'
  return 'error'
}

export const QuotaUsage = (props: TQuotaUsage) => {
  const { orgId: _orgId } = props

  const [usage] = useOrgQuota()
  const [limits] = useOrgLimits()

  if (!usage || !limits) {
    return (
      <Alert
        severity='info'
        sx={{ mb: 3 }}
      >
        No quota data available
      </Alert>
    )
  }

  const quotaItems: TQuotaItem[] = [
    {
      label: 'Projects',
      current: usage.projects || 0,
      limit: limits.projects || 0,
    },
    {
      label: 'Compute',
      current: usage.compute || 0,
      limit: limits.compute || 0,
      unit: 'seconds',
    },
    {
      label: 'Threads',
      current: usage.threads || 0,
      limit: limits.threads || 0,
    },
    {
      label: 'Messages',
      current: usage.messages || 0,
      limit: limits.messages || 0,
    },
    {
      label: 'Endpoints',
      current: usage.endpoints || 0,
      limit: limits.endpoints || 0,
    },
    {
      label: 'Secrets',
      current: usage.secrets || 0,
      limit: limits.secrets || 0,
    },
    {
      label: 'Sandbox Sessions',
      current: usage.sandboxSessions || 0,
      limit: limits.sandboxSessions || 0,
    },
  ]

  return (
    <Box>
      <Typography
        variant='h6'
        sx={{ mb: 3 }}
      >
        Current Usage
      </Typography>

      <Grid
        container
        spacing={3}
      >
        {quotaItems.map((item) => {
          const progress = getProgress(item.current, item.limit)
          const color = getProgressColor(progress)

          return (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={item.label}
            >
              <Card>
                <CardContent>
                  <Typography
                    variant='subtitle2'
                    color='text.secondary'
                    gutterBottom
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    variant='h6'
                    sx={{ mb: 1 }}
                  >
                    {formatValue(item.current, item.unit)} /{' '}
                    {formatValue(item.limit, item.unit)}
                  </Typography>
                  {item.limit !== -1 && item.limit !== Number.POSITIVE_INFINITY && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant='determinate'
                        value={progress}
                        color={color}
                        sx={{ height: 8, borderRadius: 1, flex: 1 }}
                      />
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ minWidth: 35 }}
                      >
                        {Math.round(progress)}%
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
