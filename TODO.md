## TODO


### Admin

* General
  * Search inputs at top of page should have a white background
* Endpoints
  * Sometimes navigating to Endpoints page doesn't load the Endpoints
    * Shows spinner forever
    * Refresh fixes it
  * Opening the EndpointDrawer shows error:
    ```
    MUI: You have provided an out-of-range value `b0000000-0000-0000-0000-000000000002` for the select (name="function-select") component.
    Consider providing a value that matches one of the available options or ''.
    The available values are "".
    ```

  * Agent type
    * Basically all options in AgentDrawer should be exposed to Agent Overrides
    * Allow selecting custom function tools in agent overrides
    * Allow overriding AI provider options
    * Allow overriding Exposed secrets
    * Currently have to type in the agent-id, should use agent selector
  * Proxy Type
    * Too many options, Not easy to configure, Need to simplify
* The quickstart drawer UI needs cleaned up
  * Add Provider specific Icons to Provider select step
  * Inputs should have a different background then their container
    * Currently the backgrounds are the same between input and container
  * Add Cancel button in bottom left corner like other Drawers
  * Need more padding on the last step
* Usage page does not load
  * Shows error - `Org Owner not found`
* The Agent, Thread and Chat page need cleaned up
  * Agent Drawer
    * That's of errors and warnings when opening
    * Secrets selector shows a secrets UUID instead of it's name?
    * Providers selector showing empty tag instead of provider name
    * Functions sometimes not loaded, so don't display in function selector
  * Thread
    * When viewing a Thread history, AI messages are squished
    * Edit Thread Drawer is completely messed up
      * UI all squished together
    * Threads page has an Agent selector
      * This should be an AI provider selector instead
      * Allow easy switching of AI providers attached to an agent 
  * Chat
    * AI messages are squished to the right
* Agents Page
  * Provider not showing in Agents list
* Threads page
  * Clicking on thread does not go to Thread page
  * Clicking the view thread action just switches to messages tab
    * Should load the Thread page
* Sidebar nav
  * Sub Agents under the Agents Nav item get cut off
    * Can't see full name, need a solution for nav sub items
  * Simplify - TOO MANY ITEMS
* All org agents are being loaded for all projects even when they don't belong to the project
  * Should only show Agents that belong to the project
* Org page
  * Doesn't show Org members
    * Just shows an empty list
* Users
  * Update to be a table instead of UserCard

### Agent
* Add open-router and ollama support
* Review
 
### Repl
* Review


#### Work

* Create Selector components for Providers, Agents, Functions, Endpoints, Secrets, ENVs
  * Reuse the Selector component across entities Drawers for consistency
  * Ensure item can be selected and loaded and linked to each other

### ALL
* Plans and Subscriptions are not working as expected
  * Don't load properly in admin UI
  * Properly not loading properly from backend
  * Need to switch to Stripe instead
  * Whole implementation needs to be refactored
