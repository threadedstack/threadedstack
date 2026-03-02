# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.

## Admin

* **ArtifactRenderer Component**
  * The artifact render components should be moved to the repos/components sub-repo
  * This will allow other future planned applications reuse them, which avoids code duplication, and ensures consistency.


## Repl

* **Agent Name**
  * The Agent name doesn't update when switching between ages
* **HUD**
  * The Ink implementation displayed metadata and details in the TUI
  * Those are no longer displayed in the current pi version
* **Opening Header Screen**
  * When the the cli is started, only the `Select project` select menu is shown
  * We should show a modern and clean intro Threaded Stack header above that
  * The Ink implementation displayed a header when starting the repl TUI, but it is no longer displayed
  * This header should be display when the cli first starts
* **Slash Commands**
  * `/info` command - If the current thread has messages, and the user switchs to a new thread, then uses the `/info` command, it still displays the message of the original thread
  * Slash commands that have sub-menu multi selects do not display consistently
    * For example using the `/threads` or `/projects` command will display a sub menu. The sub-menu displays, but it shows up in random locations on the screen
    * It should show up in the same consistent location every time for all sub-menus
* **Project with no Agents**
  * When the cli is started, the project select screen is shown
    * If a project is selected with no agents, the agent select screen is shown with the text `No matching commands`
    * At this point the only option is to force exit the cli
      * Instead it should show a message that the project has no agents and a the only option should be a `back` option, which takes the user back to the project select screen