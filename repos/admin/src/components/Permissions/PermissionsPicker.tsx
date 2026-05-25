import { useMemo, useCallback } from 'react'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { Box, Typography, Divider } from '@mui/material'
import { CheckboxInput } from '@tdsk/components'
import type { TPermission } from '@tdsk/domain'

export type TPermissionsPicker = {
  disabled?: boolean
  selected: TPermission[]
  available: TPermission[]
  onChange: (permissions: TPermission[]) => void
}

type TPermissionGroup = {
  resource: string
  permissions: TPermission[]
}

const groupPermissions = (permissions: TPermission[]): TPermissionGroup[] => {
  const groups: Record<string, TPermission[]> = {}

  for (const perm of permissions) {
    const [resource] = perm.split(`:`)
    if (!groups[resource]) groups[resource] = []
    groups[resource].push(perm)
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, perms]) => ({
      resource,
      permissions: perms.sort(),
    }))
}

const formatPermissionLabel = (perm: TPermission): string => {
  const [, action] = perm.split(`:`)
  return capitalize(action)
}

const formatResourceLabel = (resource: string): string => {
  // camelCase to Title Case: sandboxSession -> Sandbox Session
  return resource
    .replace(/([A-Z])/g, ` $1`)
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

export const PermissionsPicker = (props: TPermissionsPicker) => {
  const { disabled, selected, available, onChange } = props
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const groups = useMemo(() => groupPermissions(available), [available])

  const onToggle = useCallback(
    (perm: TPermission) => {
      const next = selectedSet.has(perm)
        ? selected.filter((p) => p !== perm)
        : [...selected, perm]
      onChange(next)
    },
    [selected, selectedSet, onChange]
  )

  const onToggleGroup = useCallback(
    (group: TPermissionGroup) => {
      const allSelected = group.permissions.every((p) => selectedSet.has(p))
      if (allSelected) {
        const groupSet = new Set(group.permissions)
        onChange(selected.filter((p) => !groupSet.has(p)))
      } else {
        const merged = new Set([...selected, ...group.permissions])
        onChange([...merged])
      }
    },
    [selected, selectedSet, onChange]
  )

  const onSelectAll = useCallback(() => {
    const allSelected =
      available.length === selected.length && available.every((p) => selectedSet.has(p))
    onChange(allSelected ? [] : [...available])
  }, [available, selected, selectedSet, onChange])

  const allSelected =
    available.length > 0 &&
    available.length === selected.length &&
    available.every((p) => selectedSet.has(p))

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography
          variant='caption'
          fontWeight={600}
          color='text.secondary'
          sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          Permissions ({selected.length}/{available.length})
        </Typography>
        <CheckboxInput
          size='small'
          disabled={disabled}
          checked={allSelected}
          id='tdsk-perm-select-all'
          label={allSelected ? `Deselect All` : `Select All`}
          onChange={() => onSelectAll()}
        />
      </Box>

      <Box
        sx={{
          maxHeight: 320,
          overflowY: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        {groups.map((group, idx) => {
          const groupAllSelected = group.permissions.every((p) => selectedSet.has(p))
          const groupSomeSelected =
            !groupAllSelected && group.permissions.some((p) => selectedSet.has(p))

          return (
            <Box key={group.resource}>
              {idx > 0 && <Divider />}
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography
                  variant='body2'
                  fontWeight={600}
                >
                  {formatResourceLabel(group.resource)}
                </Typography>
                <CheckboxInput
                  size='small'
                  disabled={disabled}
                  checked={groupAllSelected}
                  indeterminate={groupSomeSelected}
                  id={`tdsk-perm-group-${group.resource}`}
                  label={groupAllSelected ? `None` : `All`}
                  onChange={() => onToggleGroup(group)}
                />
              </Box>
              <Box sx={{ px: 1.5, py: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {group.permissions.map((perm) => (
                  <Box
                    key={perm}
                    sx={{ minWidth: '45%' }}
                  >
                    <CheckboxInput
                      size='small'
                      disabled={disabled}
                      checked={selectedSet.has(perm)}
                      id={`tdsk-perm-${perm}`}
                      label={formatPermissionLabel(perm)}
                      onChange={() => onToggle(perm)}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
