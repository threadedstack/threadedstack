const globalCss = () => `
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
    overflow-x: clip;
    min-height: 100vh;
    flex-direction: column;
    font-family: 'Ubuntu', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body #root {
    width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
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

  .gradient-text-dark {
    background: linear-gradient(135deg, #3370DE, #6B9BEA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gradient-text-light {
    background: linear-gradient(135deg, #3370DE, #244EA0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gradient-bg-cta {
    background: linear-gradient(135deg, #1a3a7a 0%, #244EA0 30%, #3370DE 70%, #4a8cf0 100%);
    position: relative;
    overflow: hidden;
  }

  .gradient-bg-cta::before {
    content: '';
    position: absolute;
    inset: -20% -40% -20% -40%;
    background:
      radial-gradient(ellipse at 30% 50%, rgba(107,155,234,0.25) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 50%, rgba(74,140,240,0.2) 0%, transparent 50%);
    pointer-events: none;
    animation: ctaGlow 8s ease-in-out infinite;
  }

  @keyframes ctaGlow {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(20%); }
  }

  .gradient-bg-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
  }
`

export const GlobalStyles = () => <style>{globalCss()}</style>
