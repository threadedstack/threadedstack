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
  50: `#DFE9F4`,
  100: `#BFD3E9`,
  200: `#9FBDE0`,
  300: `#80A7D6`,
  400: `#608FCC`,
  main: `#4D7EC0`,
  500: `#416FAE`,
  600: `#365F9B`,
  700: `#2A4F89`,
  800: `#1F3F76`,
  900: `#152E64`,
}

const dark = {
  background: grey[875],
  foreground: grey[100],
  paper: grey[850],
  primary: primary.main,
  primaryForeground: grey[50],
  contrastText: grey[875],
  secondary: grey[200],
  secondaryForeground: grey[300],
  muted: grey[700],
  mutedForeground: grey[400],
  accent: grey[600],
  accentForeground: grey[200],
  destructive: `#d33d3d`,
  destructiveForeground: grey[100],
  sectionBackground: grey[900],
  inputBackground: grey[900],
  headerBackground: grey[900],
  border: grey[825],
  input: grey[800],
  ring: primary[500],
  shadowColor: grey[900],
  shadowContrast: grey[875],
  shadow: `0px 1px 1px 0px ${grey[900]}`,
  shadowAlt: `0px 0px 0px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 2px -1px rgba(0,0,0,0.12)`,
  shadowPaper: `0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)`,
}

const light = {
  background: grey[0],
  foreground: grey[900],
  paper: grey[25],
  primary: primary.main,
  primaryForeground: grey[900],
  contrastText: grey[0],
  secondary: grey[400],
  secondaryForeground: grey[700],
  muted: grey[200],
  mutedForeground: grey[500],
  accent: grey[300],
  accentForeground: grey[800],
  destructive: `#d33d3d`,
  destructiveForeground: grey[50],
  inputBackground: grey[5],
  sectionBackground: grey[10],
  headerBackground: grey[5],
  border: grey[50],
  input: grey[200],
  ring: primary[500],
  shadowColor: grey[50],
  shadowContrast: grey[25],
  shadow: `0px 1px 1px 0px ${grey[50]}`,
  shadowAlt: `0px 0px 0px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 2px -1px rgba(0,0,0,0.12)`,
  shadowPaper: `0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)`,
}

const states = {
  info: primary[400],
  success: `#2cb67d`,
  //warning: `#f4a261`,
  warning: `#ef6b05`,
  disabled: grey[300],
  danger: `#d33d3d`,
}

const editor = {
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

export const colors = {
  grey,
  dark,
  light,
  white,
  states,
  editor,
  primary,
}
