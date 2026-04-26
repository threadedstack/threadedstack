# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.


## Backend

### Custom Endpoints

* There are three custom endpoints types (agent, faas, proxy) with corresponding endpoint services
* These custom service classes in the `repos/backend/src/services/endpoints` directory each extend the `BaseEndpoint` service.
* The services classes are reused in multiple places, mainly in `repos/backend/src/endpoints`, but potentially other places too.
* Each depends on the database, passed in as `db` to the `execute` function
* The `AgentEndpoint` service also has a number of other functions that requires passing in the `db`
* To reduce complexity, instead we should add a constructor function to the `BaseEndpoint`
  * It would accept the `db` instance, and store it on the class instance
  * Update the `execute` and other functions as needed to use `this.db` instead of passing it in as an argument
  * Update all call sites to pass in the `db` on initialization, and remove it from the service function calls

### Open AI Chat completions

  * Need to investigate `repos/backend/src/endpoints/agent/oaiChatCompletions.ts`
  * Currently it checks if the body has messages (i.e. message history)
  * If it does, first it will:
    * Create a new thread
    * Then, create new messages in the database tied to the new thread (i.e. seed thread)
    * This works, but requires recreating new threads and messages on every request
  * This logic should continue to exist, but the code should be updated to:
    * Check if a `threadId` is passed via the `req.body` || `header` and reuse it
      * This and allow threads and their messages to be reused
      * This would allow the backend to keep track of the messages
      * The entire message history would not need to be sent on every request
      * Only the new message would need to be sent
  * Would also need to update the repos/integration tests to validate the functionality, and ensure no regressions.


## Domain

### Parser

* The parser events should types should use an enum following existing repository patterns for enums
  * Then all places where a string is used to reference a parser event type should be updated to use the `EParserEvtType` enum instead of a string
* The `TToolState` should also be an enum and not strings, and all locations that reference it should be updated to use the enum instead of a string
* 

## Admin UI

### Create/Edit Sandbox Drawer

* Needs to be cleaned up and simplified. Options are not well organized or separated properly. Some options are in an Accordion, while others are just displayed directly. No consistency and no organization makes for a bad user experience.


## Threads

* Using the sidebar to navigate to a sandbox page, in the main content area, a list of running sandboxes should be displayed, but currently it does not display. If I refresh the browser, then it displays as expected
* Sidebar nav: sessions sometimes don't appear under their parent sandbox even when they exist on the backend. Something in the nav items is not being updated when switching between a running session and its parent sandbox.

* Normalize `navigate` calls to use the `nav` service
* Remove duplicate components / styles, refactor so they can be shared


## Multi-Repo


