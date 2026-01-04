import { useParams } from 'react-router'
import { AccountView } from '@neondatabase/neon-js/auth/react'

export const Account = () => {
  const { pathname } = useParams()
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '2rem 1rem',
      }}
    >
      <AccountView pathname={pathname} />
    </div>
  )
}

export default Account
