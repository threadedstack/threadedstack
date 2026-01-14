import { useUser } from '@TAF/state/selectors'

export const useIsAdmin = () => {
  const [user] = useUser()
  return user?.role === `admin`
}
