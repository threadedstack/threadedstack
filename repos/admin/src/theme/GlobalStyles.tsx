export type TGlobalCSS = Record<string, any>

const globalCss = (props: TGlobalCSS) => {
  return `
    :root {
      color-scheme: light dark;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      margin: 0;
      padding: 0;
      width: 100%;
      display: flex;
      overflow-x: hidden;
      min-height: 100vh;
      flex-direction: row;
      font-family: 'Ubuntu', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body #root {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    :any-link {
      text-decoration: none;
    }

    :any-link:active {
      text-decoration: none;
    }

    code {
      font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
        monospace;
    }
    
    .text-center {
      text-align: center;
    }

    .text-left {
      text-align: left;
    }

    .text-right {
      text-align: right;
    }
    
    .hidden {
      height: 0px !important;
      max-height: 0px !important;
      min-height: 0px !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    .inherit {
      font: inherit;
      color: inherit;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      line-height: inherit;
      letter-spacing: inherit;
    }

  `
}

export const GlobalStyles = (props: TGlobalCSS) => {
  return <style>{globalCss?.(props) || ``}</style>
}
