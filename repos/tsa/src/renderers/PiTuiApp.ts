import type { SelectItem, SlashCommand, EditorTheme } from '@mariozechner/pi-tui'
import type { TSelectItem } from '@TSA/types'
import type { ChatLogic } from '@TSA/renderers/chatLogic'

import chalk from 'chalk'
import {
  TUI,
  Text,
  Spacer,
  Loader,
  Editor,
  Container,
  SelectList,
  ProcessTerminal,
  CombinedAutocompleteProvider,
} from '@mariozechner/pi-tui'
import { themed } from '@TSA/theme'
import { commands } from '@TSA/commands'
import { Version } from '@TSA/constants/version'
import { PiTuiChat } from '@TSA/renderers/PiTuiChat'
import { PiTuiStatus } from '@TSA/renderers/PiTuiStatus'

const selectListTheme = {
  noMatch: (s: string) => chalk.dim(s),
  scrollInfo: (s: string) => chalk.dim(s),
  description: (s: string) => chalk.dim(s),
  selectedText: (s: string) => chalk.white(s),
  selectedPrefix: (s: string) => chalk.cyan(s),
}

const editorTheme: EditorTheme = {
  borderColor: (s) => chalk.cyan(s),
  selectList: selectListTheme,
}

/**
 * PiTuiApp — main pi-tui application class.
 * Creates and manages the TUI layout, connects ChatLogic callbacks
 * to update TUI components, and orchestrates phase transitions.
 */
export class PiTuiApp {
  #tui: TUI
  #terminal: ProcessTerminal
  #logic: ChatLogic

  // --- Layout components ---
  #mainContainer: Container
  #statusBar: PiTuiStatus
  #chatView: PiTuiChat
  #editor: Editor

  // --- Transient components (swapped per phase) ---
  #welcomeText: Text | null = null
  #loader: Loader | null = null
  #errorText: Text | null = null
  #selectList: SelectList | null = null
  #pickerLabel: Text | null = null

  // --- Inline menu (replaces overlay for slash command menus) ---
  #inlineMenu: Container | null = null

  constructor(chatLogic: ChatLogic) {
    this.#logic = chatLogic

    // Create terminal and TUI
    this.#terminal = new ProcessTerminal()
    this.#tui = new TUI(this.#terminal)

    // Create persistent components
    this.#mainContainer = new Container()
    this.#statusBar = new PiTuiStatus()
    this.#chatView = new PiTuiChat()

    // Create editor with slash-command autocomplete
    this.#editor = new Editor(this.#tui, editorTheme, { paddingX: 1 })
    this.#setupAutocomplete()
    this.#setupEditor()

    // Wire up ChatLogic callbacks
    this.#connectCallbacks()

    // Wire up menu handlers for slash commands that use showMenu/closeMenu
    this.#connectMenuHandlers()

    // Render initial phase
    this.#renderPhase(chatLogic.phase)
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  start(): void {
    this.#tui.start()
  }

  stop(): void {
    this.#loader?.stop()
    this.#tui.stop()
  }

  // ----------------------------------------------------------------
  // Editor setup
  // ----------------------------------------------------------------

  #setupEditor(): void {
    this.#editor.onSubmit = (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      this.#editor.addToHistory(trimmed)
      this.#editor.setText(``)

      if (this.#logic.phase === `login`) {
        this.#logic.handleLoginSubmit(trimmed)
      } else if (this.#logic.phase === `chat`) {
        this.#logic.handleSubmit(trimmed)
      }
    }
  }

  #setupAutocomplete(): void {
    const slashCommands: SlashCommand[] = commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
    }))
    const provider = new CombinedAutocompleteProvider(slashCommands, process.cwd())
    this.#editor.setAutocompleteProvider(provider)
  }

  // ----------------------------------------------------------------
  // Callback wiring
  // ----------------------------------------------------------------

  #connectCallbacks(): void {
    this.#logic.onPhaseChange = (phase) => {
      this.#renderPhase(phase)
    }

    this.#logic.onMessagesChange = (messages) => {
      this.#chatView.setMessages(messages)
      this.#tui.requestRender()
    }

    this.#logic.onStreamingChange = (text, _isStreaming, toolCalls) => {
      this.#chatView.setStreaming(text, toolCalls)
      this.#tui.requestRender()
    }

    this.#logic.onError = (error) => {
      this.#showError(error)
    }

    this.#logic.onAgentSelected = (agent) => {
      this.#chatView.setWelcome(
        agent.name || agent.id,
        agent.description || ``,
        this.#logic.contextFiles.length
      )
      this.#statusBar.setStatus({
        agentName: agent.name || agent.id,
        connection: this.#logic.connection,
        orgName: this.#logic.orgName || undefined,
        projectName: this.#logic.projectName || undefined,
      })
      this.#tui.requestRender()
    }

    this.#logic.onStatusChange = (meta) => {
      this.#statusBar.setStatus(meta)
      this.#tui.requestRender()
    }
  }

  #connectMenuHandlers(): void {
    this.#logic._showMenuHandler = (
      prompt: string,
      items: TSelectItem[],
      onSelect: (item: TSelectItem) => void,
      _options?: { onAction?: (item: TSelectItem) => void }
    ) => {
      this.#showInlineSelectList(prompt, items, onSelect)
    }

    this.#logic._closeMenuHandler = () => {
      this.#removeInlineMenu()
    }
  }

  // ----------------------------------------------------------------
  // Phase rendering
  // ----------------------------------------------------------------

  #renderPhase(phase: string): void {
    // Clear the main container
    this.#clearMain()

    // Stop any running loader
    this.#loader?.stop()
    this.#loader = null

    switch (phase) {
      case `login`:
        this.#renderLoginPhase()
        break
      case `loading`:
        this.#renderLoadingPhase()
        break
      case `error`:
        this.#renderErrorPhase()
        break
      case `pickProject`:
        this.#renderPickProjectPhase()
        break
      case `pickAgent`:
        this.#renderPickAgentPhase()
        break
      case `chat`:
        this.#renderChatPhase()
        break
    }

    this.#tui.requestRender()
  }

  #clearMain(): void {
    this.#tui.clear()
    this.#welcomeText = null
    this.#errorText = null
    this.#selectList = null
    this.#pickerLabel = null
  }

  // --- Login Phase ---

  #renderLoginPhase(): void {
    this.#welcomeText = new Text(
      [
        themed(`bold`, `Threaded Stack Agent (TSA)`),
        ``,
        themed(`muted`, `You are not logged in.`),
        `${themed(`muted`, `Run `)}${themed(`primary`, `/login <api-key> [--insecure]`)}${themed(`muted`, ` to authenticate.`)}`,
        ``,
        themed(`muted`, `Type /help for commands, /exit to quit.`),
      ].join(`\n`),
      2,
      1
    )

    this.#tui.addChild(this.#welcomeText)
    this.#tui.addChild(new Spacer(1))
    this.#tui.addChild(this.#editor)
    this.#tui.setFocus(this.#editor)
  }

  // --- Loading Phase ---

  #renderLoadingPhase(): void {
    this.#loader = new Loader(this.#tui, chalk.cyan, chalk.dim, `Connecting...`)
    this.#tui.addChild(new Spacer(1))
    this.#tui.addChild(this.#loader)
    this.#loader.start()
  }

  // --- Error Phase ---

  #renderErrorPhase(): void {
    const errMsg = this.#logic.error?.message || `Unknown error`
    this.#errorText = new Text(
      [
        themed(`error`, `Error: ${errMsg}`),
        ``,
        themed(`muted`, `Press Ctrl+C to exit.`),
      ].join(`\n`),
      2,
      1
    )
    this.#tui.addChild(this.#errorText)
  }

  #showError(error: Error): void {
    this.#logic.error = error
    this.#renderPhase(`error`)
  }

  // --- Banner ---

  #renderBanner(): void {
    const width = process.stdout.columns ?? 60
    const border = themed(`border`, `\u2500`.repeat(Math.min(width - 4, 50)))
    this.#welcomeText = new Text(
      [
        border,
        ` ${themed(`bold`, `Threaded Stack Agent (TSA)`)} ${themed(`muted`, `v${Version}`)}`,
        border,
      ].join(`\n`),
      1,
      1
    )
    this.#tui.addChild(this.#welcomeText)
  }

  // --- Pick Project Phase ---

  #renderPickProjectPhase(): void {
    this.#renderBanner()
    this.#pickerLabel = new Text(themed(`bold`, `Select a project:`), 1, 1)
    this.#tui.addChild(this.#pickerLabel)

    const items: SelectItem[] = this.#logic.projects.map((p: any) => ({
      value: p.id,
      label: p.name || p.id,
      description: p.description,
    }))

    this.#selectList = new SelectList(items, 15, selectListTheme)
    this.#selectList.onSelect = (item: SelectItem) => {
      const project = this.#logic.projects.find((p: any) => p.id === item.value)
      if (project) this.#logic.selectProject(project)
    }
    this.#selectList.onCancel = () => {
      this.#logic.destroy()
      this.#logic.onExit?.()
    }

    this.#tui.addChild(this.#selectList)
    this.#tui.setFocus(this.#selectList as any)
  }

  // --- Pick Agent Phase ---

  #renderPickAgentPhase(): void {
    this.#renderBanner()
    this.#pickerLabel = new Text(themed(`bold`, `Select an agent:`), 1, 1)
    this.#tui.addChild(this.#pickerLabel)

    const items: SelectItem[] = this.#logic.agents.map((a: any) => ({
      value: a.id,
      label: a.name || a.id,
      description: a.description,
    }))

    const backItem = {
      value: `← Back to projects`,
      label: `← Back to projects`,
      description: `Navigate back to the projects list.`,
    }

    items.push(backItem)

    this.#selectList = new SelectList(items, 15, selectListTheme)
    this.#selectList.onSelect = (item: SelectItem) => {
      if (item.value === backItem.value) return this.#logic.goBackToProjects()

      const agent = this.#logic.agents.find((a: any) => a.id === item.value)
      if (agent) this.#logic.selectAgent(agent)

      // TODO: Log agent "item.label" not found1
    }
    this.#selectList.onCancel = () => {
      if (this.#logic.projects.length > 0) {
        this.#logic.goBackToProjects()
      } else {
        this.#logic.destroy()
        this.#logic.onExit?.()
      }
    }

    this.#tui.addChild(this.#selectList)
    this.#tui.setFocus(this.#selectList as any)
  }

  // --- Chat Phase ---

  #renderChatPhase(): void {
    this.#tui.addChild(this.#statusBar)
    this.#tui.addChild(this.#chatView)
    this.#tui.addChild(new Spacer(1))
    this.#tui.addChild(this.#editor)
    this.#tui.setFocus(this.#editor)
  }

  // ----------------------------------------------------------------
  // Inline menu (used by slash commands like /threads, /agents, etc.)
  // Rendered as a regular child below the editor for stable positioning.
  // ----------------------------------------------------------------

  #showInlineSelectList(
    prompt: string,
    items: TSelectItem[],
    onSelect: (item: TSelectItem) => void
  ): void {
    this.#removeInlineMenu()

    const selectItems: SelectItem[] = items.map((i) => ({
      value: i.id,
      label: i.label,
      description: i.description,
    }))

    this.#inlineMenu = new Container()
    const label = new Text(themed(`bold`, prompt), 1, 0)
    this.#inlineMenu.addChild(label)

    const list = new SelectList(selectItems, 10, selectListTheme)
    list.onSelect = (selected: SelectItem) => {
      const original = items.find((i) => i.id === selected.value)
      if (original) {
        this.#removeInlineMenu()
        onSelect(original)
      }
    }
    list.onCancel = () => {
      this.#removeInlineMenu()
    }

    this.#inlineMenu.addChild(list)

    this.#tui.addChild(this.#inlineMenu)
    this.#tui.setFocus(list as any)
    this.#tui.requestRender()
  }

  #removeInlineMenu(): void {
    if (this.#inlineMenu) {
      this.#tui.removeChild(this.#inlineMenu)
      this.#inlineMenu = null
      this.#tui.setFocus(this.#editor)
      this.#tui.requestRender()
    }
  }
}
