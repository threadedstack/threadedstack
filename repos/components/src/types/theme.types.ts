declare module '@mui/material/styles' {
  interface Border {
    muted?: string
    section?: string
    default?: string
    highlight?: string
  }

  interface Editor {
    background?: string
    rbackground?: string
  }

  interface TypeBackground {
    muted: string
    paper: string
    default: string
    section?: string
    header?: string
    input?: string
  }

  interface Colors {
    background?: string
    foreground?: string
    paper?: string
    primary?: string
    primaryForeground?: string
    secondary?: string
    secondaryForeground?: string
    muted?: string
    mutedForeground?: string
    accent?: string
    accentForeground?: string
    destructive?: string
    destructiveForeground?: string
    inputBackground?: string
    headerBackground?: string
    sectionBackground?: string
    border?: string
    input?: string
    ring?: string
    shadow?: string
    shadowAlt?: string
    shadowColor?: string
    shadowPaper?: string
    shadowContrast?: string
  }

  interface Palette {
    border: Border
    editor: Editor
    colors: Colors
    background: TypeBackground
  }

  interface PaletteOptions {
    border?: Border
    editor?: Editor
    colors: Colors
  }
}

export {}
