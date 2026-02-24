# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into seperate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.



## Admin

### Organization

* **Mode Quick Start Button Location**
  * The current location of the Quick start button does not make sense.
  * It's show on the Organization List page only, which is often only displayed when an Organization is **NOT** active.
  * The Button and it's functionality should be Moved to the Organization Page and Added as the first action in QuickActions Card Component
* **Quick Actions**
  * The QuickActions Card Component should be converted into it's own Component so it can be reused in other places. The Org page should then be updated to consume it
    * It should allow passing in a list of actions, which are then rendered based on the order they are passed in.
* **Manage Members**
  * Clicking the `Manage Members` button in the Org Members list should navigate to the Org Members page. This is currently broken and instead navigate to the Home page

### Organization Members

* **User Specific API Keys**
  * There's a bug in how API Keys are displayed in the `UserApiKeysDrawer` component
  * The first time API Keys are loaded for a User (User-A) they are displayed, but if I switch to a different User (User-B), the API Keys are not updated, and it still shows the API Keys from the first User (User-A).
    * Basically API Keys per-user are not updating, and only show the first loaded User API Keys instead of switching to showing the selected User's API Keys. 
* **Merge two Drawers into One Drawer**
  * Currently there is a Drawer for editing a Users Role, and there is also a Drawer for managing a user API Keys
    * The content from the API Keys drawer should me moved into the Users Role Drawer so there is a single Drawer component for managing Users access within an organization
    * Once merged into a single Drawer component, the Users API Keys Drawer should be removed


### Organization Api Keys

* **ApiKey Drawer**
  * In the Generate API key Drawer component, a User selector should be added to allow selecting the User the API key will belong to.
    * This would work the same as creating an API Key for a user from the `UsersAPIKeyDrawer` component.
    * Instead is should show a User select dropdown, to allow selecting Users from the Organization

### Project Page

* **Project Stats**
  * When a Project is selected from the Orgs Projects page, and the app navigates to the Project page. The Project stats show inaccurate values.
    * It looks like this is because the projects child entities have not been loaded
    * For example, the number Endpoints will show 0, but if I navigate to the Endpoints page for the project, then back to the Project page, the correct number of Endpoints is displayed. This is true for all stats at the top of the page, except Agents, which always seems to display 3, which may be hard-coded or something else is going on. Either way it is **NOT** correct.


### Endpoints

* **Switching Projects**
  * When a project (Proj-A) is selected for the Projects page and I navigate to the **Endpoints** page for the project (Proj-A), the correct endpoints display, but if I navigate back to the **Projects** page and select a different project (Proj-B), and again navigate to the **Endpoints** page
  * Then I expect Endpoints for the newly selected project (Proj-B) to be displayed
  * But I **still** see the Endpoints for the fist selected project (Proj-A)
  * Basically the Endpoints page is not updating when switching between projects
  * Other pages look to be working correctly (i.e. Agents Page)
* The Endpoints list table should add a column to display the Endpoint type (i.e. Proxy, Faas, or Agent).
* **Endpoint Drawer - Test Tab**
  * The `Method` Select should not be configurable
    * Instead it should display the method matching with the Endpoint type of the endpoint 
      * Proxy Endpoint Type - Matches the `method` property of the endpoint
      * FaaS Endpoint Type - **Always** a `POST`
      * Agent Endpoint Type - **Always** a `POST`
  * If the `Method` is `GET`, a query params Key/Value Editor should be displayed
    * When the request is made, these should be converted in to query params and appended to the request
  * If the `Method` is **NOT** `GET`, a Select box should be display and show different body option types:
    * **JSON** - Key/Value Editor should be displayed that is converted to JSON body object on request
    * **FORM** - Key/Value Editor should be displayed that is converted to FormData body object on request
    * **RAW** - Current implementation with monaco editor
  * The **Send Request** Button should be aligned `right`, not `left`

### Project Members

* **Member Users Table**
  * On the Project Members PAge, the users displayed in the Table always have the name of **Unknown**. The Other details look correct. 


## Backend

* **FAAS API** 
  * When calling a FAAS function via the API, the following warning is displayed:
    ```sh
      Error: Function execution failed: #<Object> could not be cloned.\nat FaaSEndpoint.execute (/tdsk/repos/backend/src/services/endpoints/faasEndpoint.ts:90:13)\nat async action (/tdsk/repos/backend/src/endpoints/proxy/endpoint.ts:39:5)\n
    ```
