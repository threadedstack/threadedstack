import type { TMessage } from '@TAG/types'
import { Context } from '@TAG/agent/context'
import { getProvider } from '@TAG/agent/provider'

// These would be imported from WASM component in actual implementation
// For now, we'll define the interface
declare const onToken: (token: string) => void
declare const executeShell: (cmd: string, args: string[]) => string
declare const webSearch: (query: string) => string

const ctx = new Context({
  max: Number(process.env.AGENT_MAX_TOKENS) || 100000,
})

// Simple in-memory history for this WASM instance run
const history: TMessage[] = []

/**
 * Main entry point for WASM agent
 * This function is called from the Host via WASM bridge
 */
export const processRequest = async (prompt: string): Promise<void> => {
  try {
    // Get provider configuration from environment (injected by Host)
    const provider = getProvider({
      url: process.env.AGENT_URL || '',
      model: process.env.AGENT_MODEL || '',
      key: process.env.AGENT_API_KEY || '',
      type: (process.env.AGENT_PROVIDER as any) || 'openai',
      path: process.env.AGENT_PATH,
    })

    history.push({ role: 'user', content: prompt })

    // 1. ReAct Intent Check - Handle tool commands
    if (prompt.startsWith('/run ')) {
      const cmdParts = prompt.slice(5).trim().split(' ')
      const [cmd, ...args] = cmdParts

      try {
        onToken(`[Tool] Running ${cmd}...\n`)
        const output = executeShell(cmd, args)
        onToken(`[Output]\n${output}\n`)
        history.push({
          role: 'assistant',
          content: `Executed ${cmd}. Output: ${output}`,
        })
      } catch (e: any) {
        onToken(`[Error] ${e.toString()}\n`)
        history.push({
          role: 'assistant',
          content: `Error executing ${cmd}: ${e.toString()}`,
        })
      }
      return
    }

    // 2. Web search command
    if (prompt.startsWith('/search ')) {
      const query = prompt.slice(8).trim()
      try {
        onToken(`[Search] Searching for: ${query}...\n`)
        const results = webSearch(query)
        onToken(`[Results]\n${results}\n`)
        history.push({
          role: 'assistant',
          content: `Search results for "${query}": ${results}`,
        })
      } catch (e: any) {
        onToken(`[Error] ${e.toString()}\n`)
      }
      return
    }

    // 3. Standard Chat - Use LLM
    const systemPrompt = `You are a helpful coding agent. You can execute shell commands using /run <command> and search the web using /search <query>. Always explain your reasoning and actions clearly.`

    const { system, messages } = ctx.compose(systemPrompt, history)

    // Convert messages to simple format for provider
    const userMessage = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')

    // Stream tokens as they arrive
    onToken('[Agent] Thinking...\n')
    const response = await provider.complete(system, userMessage)
    onToken(response)
    onToken('\n')

    history.push({ role: 'assistant', content: response })
  } catch (error: any) {
    onToken(`[Error] ${error.message}\n`)
    throw error
  }
}
