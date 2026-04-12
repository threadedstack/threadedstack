import type { THeaderMenuItem } from '@tdsk/components'

import { nav } from '@TAF/services/nav'
import { useUser } from '@TAF/state/selectors'
import { Header as SharedHeader } from '@tdsk/components'
import { useThemeToggle } from '@TAF/hooks/theme/useThemeToggle'
import { Breadcrumbs } from '@TAF/components/Breadcrumbs/Breadcrumbs'

type THeaderProps = {
  navItems?: THeaderMenuItem[]
}

export const Header = (props: THeaderProps) => {
  const [user] = useUser()
  const { themeType, onThemeToggle } = useThemeToggle()

  return (
    <SharedHeader
      breadcrumbs={<Breadcrumbs />}
      user={user}
      menuItems={props.navItems}
      themeType={themeType}
      onThemeToggle={onThemeToggle}
      onNavigateHome={() => nav.home()}
    />
  )
}
