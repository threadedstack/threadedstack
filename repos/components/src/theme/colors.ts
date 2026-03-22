export const white = `#FFFFFF`

export const grey = {
  0: `#ffffff`,
  5: `#fcfcfc`,
  10: `#f9f9f9`,
  25: `#f2f2f2`,
  50: `#e6e6e6`,
  100: `#cecece`,
  200: `#b8b8b8`,
  300: `#969696`,
  400: `#767676`,
  500: `#666666`,
  600: `#565656`,
  700: `#464646`,
  800: `#363636`,
  825: `#303030`,
  850: `#2a2a2a`,
  875: `#242424`,
  900: `#1e1e1e`,
  925: `#141414`,
}

export const primary = {
  50: `#EBF2FE`,
  100: `#D2E3FC`,
  200: `#A8C8F8`,
  300: `#7DACF3`,
  350: `#6B9BEA`,
  400: `#5390EC`,
  main: `#3370DE`,
  500: `#2A5DB8`,
  600: `#214A92`,
  700: `#1B3E7A`,
  800: `#153162`,
  900: `#10254A`,
}

export const editor = {
  light: {
    background: white,
    rbackground: grey[5],
    gbackground: grey[25],
  },
  dark: {
    background: grey[925],
    rbackground: grey[900],
    gbackground: grey[850],
  },
}

const states = {
  dark: {
    info: `#4FC3F7`,
    success: `#2cb67d`,
    warning: `#F59E0B`,
    disabled: grey[300],
    danger: `#EF4444`,
  },
  light: {
    info: `#0284C7`,
    success: `#059669`,
    warning: `#D97706`,
    disabled: grey[300],
    danger: `#DC2626`,
  },
}

export const border = {
  dark: {
    alt: grey[50],
    altMuted: grey[200],
    dark: grey[900],
    muted: `#2D3139`,
    section: `#2D3139`,
    default: `#2D3139`,
    highlight: primary[600],
  },
  light: {
    alt: grey[825],
    altMuted: grey[800],
    muted: `#E5E7EB`,
    dark: `#D1D5DB`,
    section: `#E5E7EB`,
    default: `#E5E7EB`,
    highlight: primary[100],
  },
}

export const shadows = {
  light: {
    xs: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`,
    sm: `0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)`,
    md: `0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.06)`,
    lg: `0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.06)`,
    xl: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)`,
    ring: `0 0 0 2px rgba(37, 99, 235, 0.25)`,
  },
  dark: {
    xs: `0 1px 2px 0 rgba(0, 0, 0, 0.3)`,
    sm: `0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)`,
    md: `0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)`,
    lg: `0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)`,
    xl: `0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)`,
    ring: `0 0 0 2px rgba(51, 112, 222, 0.35)`,
  },
}

export const gradients = {
  light: {
    headline: `linear-gradient(135deg, ${primary[500]}, ${primary.main})`,
    button: `linear-gradient(135deg, ${primary.main}, ${primary[500]})`,
  },
  dark: {
    button: `linear-gradient(135deg, ${primary.main}, ${primary[400]})`,
    headline: `linear-gradient(135deg, ${primary.main}, ${primary[350]})`,
  },
}

const dark = {
  grey,
  border: border.dark,
  editor: editor.dark,
  states: states.dark,
  background: `#1A1D21`,
  foreground: grey[100],
  paper: `#21252B`,
  primary: primary.main,
  primaryForeground: grey[50],
  contrastText: grey[0],
  secondary: grey[200],
  secondaryForeground: grey[200],
  muted: grey[700],
  mutedForeground: grey[400],
  accent: grey[600],
  accentForeground: grey[200],
  destructive: `#EF4444`,
  destructiveForeground: grey[100],
  sectionBackground: `#1A1D21`,
  inputBackground: `#181B1F`,
  headerBackground: `#1E2228`,
  mutedBackground: `#1E2228`,
  input: grey[800],
  placeholder: grey[600],
  ring: primary[500],
  shadows: shadows.dark,
  shadowColor: grey[900],
  shadowContrast: grey[875],
  shadow: shadows.dark.xs,
  shadowAlt: shadows.dark.sm,
  shadowPaper: shadows.dark.md,
  gradients: gradients.dark,
}

const light = {
  grey,
  border: border.light,
  states: states.light,
  editor: editor.light,
  background: `#FAFBFC`,
  foreground: grey[900],
  paper: grey[0],
  primary: primary.main,
  primaryForeground: grey[900],
  contrastText: grey[0],
  secondary: grey[400],
  secondaryForeground: grey[700],
  muted: grey[200],
  mutedForeground: grey[500],
  mutedBackground: grey[10],
  accent: grey[300],
  accentForeground: grey[800],
  destructive: `#DC2626`,
  destructiveForeground: grey[50],
  inputBackground: grey[5],
  sectionBackground: `#FAFBFC`,
  // Custom color override, may need to add to theme some how
  headerBackground: `#F4F5F6`,
  input: grey[200],
  ring: primary[500],
  placeholder: grey[700],

  shadows: shadows.light,
  shadowColor: grey[50],
  shadowContrast: grey[25],
  shadow: shadows.light.xs,
  shadowAlt: shadows.light.sm,
  shadowPaper: shadows.light.md,
  gradients: gradients.light,
}

export const colors = {
  grey,
  dark,
  light,
  white,
  states,
  editor,
  primary,
  gradients,
}
