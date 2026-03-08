# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.



## Admin

* **Login Page**
  * The inputs for email and password should use the TextInput component from tdsk/components repo. Because the labels use standard MUI labels which is incorrect
  * When in light theme mode, the input background turns while, but the test of the page still looks like dark mode. The whole page should have a light them mode style. Should align with the light theme mode of the Hero component in the website repo.
  * The background colored blobs should animate and more like they do in the Hero component in the website repo.

* **Quick Start Drawer**
  * 

* **Web Provider Component**
  * The **AgentDrawer** Component defines code for setting the Web Provider settings. This should be extracted out into it's own component.


## Website

* **Header**
  * The Left side Icon and title text `Threaded Stack` should match the same styles as the admin repo. Currently the title text is smaller and colored blue, but it should match the same theme styles used by the admin repo

* **Documentation**
  * Lots of missing documentation pages
  * The Headers in the markdown are styled to look too purple, need to be more blue.
  * When in light theme mode, the `<code>` element does not standout very well, needs styles updated.
  * Need to add some images to the docs
    * Maybe use playwright to capture pictures of the Admin web app?
    * Also need images form Repl application
    * Should include flows using Repl
* **Get Started** buttons should link to the login page of Admin web app
* Add - `Contact` and `About` pages
  * Update links in the footer to link to these pages, currently link to nothing


## Integration

* **Failed Org Member CRUD Tests**
  * A number of the integration tests in `crud-org-members.spec.ts` were set to **skip** because they are suddenly failing. For each of the tests remove the top level `test.skip`, and fix the issue. It could be a code issue, or test issue. You must investigate and figure out what is causing the problem.
  * The Viewer and Member users are being unlinked from the organization. Seems like there may be a test that remove the org-id from the roles table, that ties the user to the organization