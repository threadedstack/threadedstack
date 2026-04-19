import { useContext } from 'react'
import { PermissionsContext } from '@TSC/contexts/PermissionsContext'

export const usePermissionsContext = () => useContext(PermissionsContext)
