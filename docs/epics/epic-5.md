
# **Epic 5: Agents**

**Goal:** Enable autonomous execution of complex workflows through secure environments and external tool integration.

## 1. Agent Sandbox & Environment

* Create a secure, containerized environment to execute CLI tools (e.g., `claude-code`, `codex`, `gemini-cli`).
* Ensure isolation for safe execution of arbitrary code or commands.

## 2. Git Integration

* Allow the Agent to authenticate and `git clone` repositories defined in the database.
* Enable the Agent to modify code within the sandbox and `git push` changes back to the remote.

## 3. Browser Automation

* Implement headless browser control (using Puppeteer or Playwright).
* Allow the Agent to drive the browser for research, testing, or scraping tasks.

## 4. Streaming Feedback

* Implement a **Streaming Proxy** to pipe real-time Agent logs, execution steps, and terminal output back to the UI for user visibility.

## 5. User Credentials & Secrets

* Enable users to securely store personal AI Provider API keys in `secrets` (User-scope).
* Inject these keys into the Agent environment at runtime to power the underlying models.



## Deliverables / Acceptance Criteria

* An Agent that can successfully clone a user repository, modify code or perform an automation task, and push the changes back to the source.