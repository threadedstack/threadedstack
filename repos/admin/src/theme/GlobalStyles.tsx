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

    code, kbd, pre {
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Courier New', monospace;
      font-size: 0.875em;
    }

    *:focus-visible {
      outline: 2px solid #3370DE;
      outline-offset: 2px;
    }

    ::selection {
      background-color: rgba(51, 112, 222, 0.2);
    }

    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(128, 128, 128, 0.3);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(128, 128, 128, 0.5);
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
