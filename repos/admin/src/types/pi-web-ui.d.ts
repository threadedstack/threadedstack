// Type declarations for pi-web-ui Lit web components used in React JSX
// These custom elements are registered by importing from @mariozechner/pi-web-ui

import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'pi-chat-panel': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
      'agent-interface': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
      'message-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
      'message-editor': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
      'agent-model-selector': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }
  }
}
