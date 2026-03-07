# TODO

The following are a list of confirmed issues found or required updates across the mono-repo.
Items are split into separate groups, with the sub repo name as the header.

**IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.



## Admin

**Login Page**
  * The Login page has different overall styles from the rest of the admin pages
  * It was built first before the other pages styles were updated and so doesn't align with the global styles applied everywhere.
  * The whole page needs a re-style to make it clean, modern and professional. It is the gateway into the platform, so it should set a good first impression.

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
