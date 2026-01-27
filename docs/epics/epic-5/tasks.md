# Epic 5: Agents - Task Tracking

**Goal:** Enable autonomous execution of complex workflows through secure environments and external tool integration.

## Task Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

**📊 Current Status**: 0% Complete (Not started)

---

## 1. Agent Sandbox & Environment

### 1.1 Container Infrastructure
- [ ] **TASK-1.1.1**: Research containerization options (Docker, Firecracker, gVisor)
- [ ] **TASK-1.1.2**: Create agent container base image specification
- [ ] **TASK-1.1.3**: Implement container orchestration module at `repos/backend/src/agents/`
- [ ] **TASK-1.1.4**: Implement container lifecycle management (create, start, stop, destroy)
- [ ] **TASK-1.1.5**: Configure container resource limits (CPU, memory, disk)
- [ ] **TASK-1.1.6**: Implement container networking isolation
- [ ] **TASK-1.1.7**: Create Dockerfile for agent sandbox base image

### 1.2 CLI Tool Integration
- [ ] **TASK-1.2.1**: Create agent runtime environment specification
- [ ] **TASK-1.2.2**: Pre-install `claude-code` CLI in agent image
- [ ] **TASK-1.2.3**: Pre-install `codex` CLI in agent image
- [ ] **TASK-1.2.4**: Pre-install `gemini-cli` in agent image
- [ ] **TASK-1.2.5**: Implement CLI tool detection and version management
- [ ] **TASK-1.2.6**: Create wrapper scripts for CLI invocation with credentials

### 1.3 Sandbox Security
- [ ] **TASK-1.3.1**: Implement filesystem isolation (ephemeral volumes)
- [ ] **TASK-1.3.2**: Implement network egress controls
- [ ] **TASK-1.3.3**: Implement process isolation and monitoring
- [ ] **TASK-1.3.4**: Implement execution time limits
- [ ] **TASK-1.3.5**: Create security audit logging for agent actions
- [ ] **TASK-1.3.6**: Implement container escape prevention measures
- [ ] **TASK-1.3.7**: Create security scanning for agent outputs

---

## 2. Git Integration

### 2.1 Project repository Management
- [ ] **TASK-2.1.1**: Create projects API endpoint at `repos/backend/src/endpoints/projects/projects.ts`
- [ ] **TASK-2.1.2**: Implement `POST /_/projects` - Register project
- [ ] **TASK-2.1.3**: Implement `GET /_/projects` - List projects
- [ ] **TASK-2.1.4**: Implement `GET /_/projects/:id` - Get project details
- [ ] **TASK-2.1.5**: Implement `PUT /_/projects/:id` - Update project
- [ ] **TASK-2.1.6**: Implement `DELETE /_/projects/:id` - Delete project

### 2.2 Git Authentication
- [ ] **TASK-2.2.1**: Create git credentials schema (SSH keys, tokens)
- [ ] **TASK-2.2.2**: Implement SSH key storage as encrypted secrets
- [ ] **TASK-2.2.3**: Implement GitHub personal access token storage
- [ ] **TASK-2.2.4**: Implement GitLab token storage
- [ ] **TASK-2.2.5**: Create credential injection mechanism for containers
- [ ] **TASK-2.2.6**: Implement SSH agent forwarding for containers

### 2.3 Git Operations
- [ ] **TASK-2.3.1**: Implement `git clone` execution in agent sandbox
- [ ] **TASK-2.3.2**: Implement shallow clone for large git repositories
- [ ] **TASK-2.3.3**: Implement branch checkout
- [ ] **TASK-2.3.4**: Implement `git add` for modified files
- [ ] **TASK-2.3.5**: Implement `git commit` with agent-generated messages
- [ ] **TASK-2.3.6**: Implement `git push` to remote
- [ ] **TASK-2.3.7**: Implement PR/MR creation via API (GitHub, GitLab)
- [ ] **TASK-2.3.8**: Handle git operation failures gracefully

---

## 3. Browser Automation

### 3.1 Headless Browser Setup
- [ ] **TASK-3.1.1**: Research browser automation options (Playwright, Puppeteer)
- [ ] **TASK-3.1.2**: Install Playwright in agent container image
- [ ] **TASK-3.1.3**: Configure headless Chrome/Chromium in container
- [ ] **TASK-3.1.4**: Implement browser session management
- [ ] **TASK-3.1.5**: Configure browser resource limits

### 3.2 Browser Control API
- [ ] **TASK-3.2.1**: Create browser automation module at `repos/backend/src/agents/browser/`
- [ ] **TASK-3.2.2**: Implement page navigation commands
- [ ] **TASK-3.2.3**: Implement element interaction (click, type, select)
- [ ] **TASK-3.2.4**: Implement screenshot capture
- [ ] **TASK-3.2.5**: Implement page content extraction (text, HTML)
- [ ] **TASK-3.2.6**: Implement form filling
- [ ] **TASK-3.2.7**: Implement file download handling

### 3.3 Browser Automation Use Cases
- [ ] **TASK-3.3.1**: Implement web research task execution
- [ ] **TASK-3.3.2**: Implement data scraping with rate limiting
- [ ] **TASK-3.3.3**: Implement UI testing automation
- [ ] **TASK-3.3.4**: Handle CAPTCHAs (escalate to user when needed)
- [ ] **TASK-3.3.5**: Implement cookie/session management

---

## 4. Streaming Feedback

### 4.1 Streaming Proxy Infrastructure
- [ ] **TASK-4.1.1**: Create streaming proxy module at `repos/backend/src/agents/streaming/`
- [ ] **TASK-4.1.2**: Implement WebSocket server for agent streaming
- [ ] **TASK-4.1.3**: Implement SSE fallback for streaming
- [ ] **TASK-4.1.4**: Create message protocol for agent events

### 4.2 Log Streaming
- [ ] **TASK-4.2.1**: Capture container stdout/stderr in real-time
- [ ] **TASK-4.2.2**: Parse and categorize log messages
- [ ] **TASK-4.2.3**: Stream logs to connected clients
- [ ] **TASK-4.2.4**: Implement log buffering for disconnected clients
- [ ] **TASK-4.2.5**: Store logs for post-execution review

### 4.3 Execution Status Streaming
- [ ] **TASK-4.3.1**: Define execution step event schema
- [ ] **TASK-4.3.2**: Stream agent thinking/planning steps
- [ ] **TASK-4.3.3**: Stream file change events
- [ ] **TASK-4.3.4**: Stream git operation status
- [ ] **TASK-4.3.5**: Stream browser action events
- [ ] **TASK-4.3.6**: Stream completion/error events

---

## 5. User Credentials & Secrets

### 5.1 User-Scoped Secrets
- [ ] **TASK-5.1.1**: Extend secrets schema for user-scope (vs org/project scope)
- [ ] **TASK-5.1.2**: Implement user secret CRUD operations
- [ ] **TASK-5.1.3**: Create UI for managing personal secrets
- [ ] **TASK-5.1.4**: Implement secret scope validation in API

### 5.2 AI Provider Keys
- [ ] **TASK-5.2.1**: Create dedicated AI key storage interface
- [ ] **TASK-5.2.2**: Implement OpenAI API key storage per user
- [ ] **TASK-5.2.3**: Implement Anthropic API key storage per user
- [ ] **TASK-5.2.4**: Implement Google AI API key storage per user
- [ ] **TASK-5.2.5**: Validate API keys on storage

### 5.3 Runtime Injection
- [ ] **TASK-5.3.1**: Implement secure key injection into agent containers
- [ ] **TASK-5.3.2**: Inject keys as environment variables
- [ ] **TASK-5.3.3**: Inject keys into CLI config files
- [ ] **TASK-5.3.4**: Clear keys from container after execution
- [ ] **TASK-5.3.5**: Audit log key usage

---

## 6. Agent Management API

### 6.1 Agents CRUD
- [ ] **TASK-6.1.1**: Create agents endpoint at `repos/backend/src/endpoints/agents.ts`
- [ ] **TASK-6.1.2**: Implement `POST /_/agents` - Create agent configuration
- [ ] **TASK-6.1.3**: Implement `GET /_/agents` - List agent configs
- [ ] **TASK-6.1.4**: Implement `GET /_/agents/:id` - Get agent details
- [ ] **TASK-6.1.5**: Implement `PUT /_/agents/:id` - Update agent
- [ ] **TASK-6.1.6**: Implement `DELETE /_/agents/:id` - Delete agent

### 6.2 Agent Execution
- [ ] **TASK-6.2.1**: Implement `POST /_/agents/:id/run` - Start agent execution
- [ ] **TASK-6.2.2**: Implement `GET /_/agents/:id/runs` - List agent runs
- [ ] **TASK-6.2.3**: Implement `GET /_/agents/:id/runs/:runId` - Get run details
- [ ] **TASK-6.2.4**: Implement `POST /_/agents/:id/runs/:runId/stop` - Stop running agent
- [ ] **TASK-6.2.5**: Implement `GET /_/agents/:id/runs/:runId/logs` - Get run logs
- [ ] **TASK-6.2.6**: Implement `GET /_/agents/:id/runs/:runId/stream` - Stream run output

---

## 7. Frontend / UI

### 7.1 Agents Page
- [ ] **TASK-7.1.1**: Create Agents page at `repos/admin/src/pages/Agents/Agents.tsx`
- [ ] **TASK-7.1.2**: Create Agent detail page at `repos/admin/src/pages/Agents/Agent.tsx`
- [ ] **TASK-7.1.3**: Implement agent list with status indicators
- [ ] **TASK-7.1.4**: Implement agent creation wizard
- [ ] **TASK-7.1.5**: Add route for Agents in admin router

### 7.2 Agent Configuration UI
- [ ] **TASK-7.2.1**: Create agent task definition form
- [ ] **TASK-7.2.2**: Implement project selector
- [ ] **TASK-7.2.3**: Implement CLI tool selector (claude-code, gemini-cli, codex, etc.)
- [ ] **TASK-7.2.4**: Implement resource limit configuration
- [ ] **TASK-7.2.5**: Implement timeout configuration
- [ ] **TASK-7.2.6**: Implement credential/secret linking

### 7.3 Agent Execution UI
- [ ] **TASK-7.3.1**: Create agent run page at `repos/admin/src/pages/Agents/AgentRun.tsx`
- [ ] **TASK-7.3.2**: Implement real-time log viewer component
- [ ] **TASK-7.3.3**: Implement execution step visualization
- [ ] **TASK-7.3.4**: Implement file diff viewer for changes
- [ ] **TASK-7.3.5**: Implement "Stop Agent" button
- [ ] **TASK-7.3.6**: Implement run history list

### 7.4 User Secrets UI
- [ ] **TASK-7.4.1**: Create personal secrets section in Account page
- [ ] **TASK-7.4.2**: Implement AI API key input forms
- [ ] **TASK-7.4.3**: Implement API key validation feedback
- [ ] **TASK-7.4.4**: Show which agents use which keys

---

## Deliverables Checklist

- [ ] Agent can be configured with project and credentials
- [ ] Agent can clone a user project via git url into sandbox
- [ ] Agent can execute CLI tools (claude-code, codex, gemini-cli)
- [ ] Agent can modify code within sandbox
- [ ] Agent can push changes back to git remote
- [ ] Agent can optionally create PR/MR for changes
- [ ] Real-time logs stream to UI during execution
- [ ] Users can store personal AI provider API keys
- [ ] Agent sandbox is secure and isolated

---

## Dependencies

- **Epic 1**: Base Setup (Auth, Users, Orgs, basic UI)
- **Epic 2**: Proxy Feature (Secrets management)
- **Epic 3**: FaaS (Function execution patterns)
- **Epic 4**: AI Engine (AI provider integration)

## Technical Notes

- Container orchestration likely requires Kubernetes or similar
- Consider Firecracker for lightweight VM-based isolation
- Git operations should handle large repositories efficiently
- Browser automation adds significant resource requirements
- WebSocket is preferred over SSE for bidirectional agent communication
- API keys must never be logged or exposed in streams
- Consider implementing agent templates for common tasks
- Rate limiting is essential for browser automation to avoid abuse
- Agent executions should have hard time limits (e.g., 30 minutes max)
