
import { TSIcon, colors } from '@tdsk/components'
import { LogoContainer, LogoBtn, LogoText } from '@TAF/components/Sidebar/Sidebar.styles'

const gotoHome = () => {
  const { search, pathname } = window.location
  pathname !== `/` && (window.location.href = `/${search}`)
}

const style = {
  width: `28px`,
  height: `28px`,
  fill: colors.primary.main,
}

export type TSBLogo = {
  full?:boolean
}

export const SBLogo = (props:TSBLogo) => {
  const { full } = props

  return (
    <LogoContainer className="tdsk-logo-icon-container" >
      <LogoBtn className="tdsk-logo-icon-button" onClick={gotoHome} >
        <TSIcon svgStyle={style} />
        {full && (
          <LogoText
            noWrap
            variant="h6"
            component="a"
          >
            Threaded Stack
          </LogoText>
        ) || null}
      </LogoBtn>
    </LogoContainer>
  )
}