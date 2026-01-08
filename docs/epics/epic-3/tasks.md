# Epic 3: FaaS (Function as a Service) - Task Tracking

**Goal:** Secure, serverless execution of custom user code.

## Task Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## 1. Compute Engine (Backend)

### 1.1 Runtime Environment Setup
- [ ] **TASK-1.1.1**: Research and select WASM runtime (Wasmer, Wasmtime, or similar)
- [ ] **TASK-1.1.2**: Install WASM runtime dependencies in backend
- [ ] **TASK-1.1.3**: Create compute engine module at `repos/backend/src/compute/`
- [ ] **TASK-1.1.4**: Implement WASM module loader
- [ ] **TASK-1.1.5**: Implement memory limits configuration
- [ ] **TASK-1.1.6**: Implement CPU time limits configuration
- [ ] **TASK-1.1.7**: Implement network access controls (sandbox isolation)

### 1.2 Sandbox Security
- [ ] **TASK-1.2.1**: Create sandbox configuration schema
- [ ] **TASK-1.2.2**: Implement file system isolation (no host FS access)
- [ ] **TASK-1.2.3**: Implement network isolation (whitelist allowed hosts)
- [ ] **TASK-1.2.4**: Implement resource quotas (memory, CPU, execution time)
- [ ] **TASK-1.2.5**: Implement syscall filtering
- [ ] **TASK-1.2.6**: Create security audit logging for function executions

### 1.3 Execution Logic (`/faas/*`)
- [ ] **TASK-1.3.1**: Create FaaS router at `repos/backend/src/middleware/faasEngine.ts`
- [ ] **TASK-1.3.2**: Implement function lookup from `functions` table by endpoint path
- [ ] **TASK-1.3.3**: Implement function code retrieval and caching
- [ ] **TASK-1.3.4**: Implement context injection (req.body, headers, query params)
- [ ] **TASK-1.3.5**: Implement secrets injection into runtime environment
- [ ] **TASK-1.3.6**: Execute function code within WASM sandbox
- [ ] **TASK-1.3.7**: Capture function output (stdout, return value)
- [ ] **TASK-1.3.8**: Handle function errors and exceptions
- [ ] **TASK-1.3.9**: Return response to caller with appropriate status codes
- [ ] **TASK-1.3.10**: Implement execution timeout handling

---

## 2. Function Management API

### 2.1 Functions CRUD API
- [ ] **TASK-2.1.1**: Create functions endpoint at `repos/backend/src/endpoints/functions.ts`
- [ ] **TASK-2.1.2**: Implement `POST /_/functions` - Create function
- [ ] **TASK-2.1.3**: Implement `GET /_/functions` - List functions
- [ ] **TASK-2.1.4**: Implement `GET /_/functions/:id` - Get function by ID
- [ ] **TASK-2.1.5**: Implement `PUT /_/functions/:id` - Update function
- [ ] **TASK-2.1.6**: Implement `DELETE /_/functions/:id` - Delete function
- [ ] **TASK-2.1.7**: Implement `POST /_/functions/:id/execute` - Test execute function
- [ ] **TASK-2.1.8**: Implement function versioning support

### 2.2 Function Configuration Schema
- [ ] **TASK-2.2.1**: Define function code storage schema (inline vs blob)
- [ ] **TASK-2.2.2**: Define runtime language enum (TypeScript, JavaScript, Python)
- [ ] **TASK-2.2.3**: Define dependencies schema (npm packages, pip packages)
- [ ] **TASK-2.2.4**: Define environment variables schema
- [ ] **TASK-2.2.5**: Define endpoint association (function-to-endpoint linking)
- [ ] **TASK-2.2.6**: Define timeout and resource limit configuration
- [ ] **TASK-2.2.7**: Implement schema validation for function creation

---

## 3. Function Editor UI

### 3.1 Monaco Editor Integration
- [ ] **TASK-3.1.1**: Install Monaco Editor npm package in admin
- [ ] **TASK-3.1.2**: Create Monaco wrapper component at `repos/admin/src/components/CodeEditor/`
- [ ] **TASK-3.1.3**: Configure TypeScript language support
- [ ] **TASK-3.1.4**: Configure JavaScript language support
- [ ] **TASK-3.1.5**: Configure Python language support
- [ ] **TASK-3.1.6**: Implement syntax highlighting themes (light/dark)
- [ ] **TASK-3.1.7**: Implement auto-completion for runtime APIs
- [ ] **TASK-3.1.8**: Implement inline error display

### 3.2 Functions Pages
- [ ] **TASK-3.2.1**: Create Functions page at `repos/admin/src/pages/Functions/Functions.tsx`
- [ ] **TASK-3.2.2**: Create Function detail/editor page at `repos/admin/src/pages/Functions/Function.tsx`
- [ ] **TASK-3.2.3**: Implement function list table with pagination
- [ ] **TASK-3.2.4**: Implement function creation wizard
- [ ] **TASK-3.2.5**: Integrate Monaco editor for code editing
- [ ] **TASK-3.2.6**: Implement runtime language selector dropdown
- [ ] **TASK-3.2.7**: Implement dependencies configuration panel
- [ ] **TASK-3.2.8**: Implement environment variables configuration
- [ ] **TASK-3.2.9**: Implement endpoint linking interface
- [ ] **TASK-3.2.10**: Add route for Functions in admin router

### 3.3 Function Testing UI
- [ ] **TASK-3.3.1**: Create test execution panel component
- [ ] **TASK-3.3.2**: Implement request body input (JSON editor)
- [ ] **TASK-3.3.3**: Implement headers input for test requests
- [ ] **TASK-3.3.4**: Implement "Run" button with execution
- [ ] **TASK-3.3.5**: Display execution output (stdout, return value)
- [ ] **TASK-3.3.6**: Display execution errors with stack traces
- [ ] **TASK-3.3.7**: Display execution metrics (time, memory used)

---

## 4. Language Support

### 4.1 TypeScript/JavaScript Runtime
- [ ] **TASK-4.1.1**: Research TypeScript compilation options (esbuild, QuickJS)
- [ ] **TASK-4.1.2**: Implement TypeScript transpiler integration
- [ ] **TASK-4.1.3**: Implement JavaScript runtime (V8 isolate or QuickJS)
- [ ] **TASK-4.1.4**: Create standard library stubs (fetch, console, etc.)
- [ ] **TASK-4.1.5**: Implement npm package resolution for dependencies
- [ ] **TASK-4.1.6**: Bundle dependencies with function code
- [ ] **TASK-4.1.7**: Create TypeScript type definitions for runtime APIs

### 4.2 Python Runtime
- [ ] **TASK-4.2.1**: Research Python WASM options (Pyodide, RustPython)
- [ ] **TASK-4.2.2**: Implement Pyodide or similar WASM Python runtime
- [ ] **TASK-4.2.3**: Create Python standard library access
- [ ] **TASK-4.2.4**: Implement pip package resolution for dependencies
- [ ] **TASK-4.2.5**: Bundle Python dependencies with function code
- [ ] **TASK-4.2.6**: Create Python API documentation for runtime

---

## 5. Git Integration (Investigation)

### 5.1 Git Push Workflow Research
- [ ] **TASK-5.1.1**: Research Git webhook integration patterns
- [ ] **TASK-5.1.2**: Design function-to-file mapping strategy
- [ ] **TASK-5.1.3**: Document Git-based deployment workflow
- [ ] **TASK-5.1.4**: Create proof-of-concept for Git push trigger

### 5.2 Git Integration Implementation (Optional)
- [ ] **TASK-5.2.1**: Implement webhook receiver endpoint
- [ ] **TASK-5.2.2**: Implement repository cloning on webhook
- [ ] **TASK-5.2.3**: Implement function file detection and sync
- [ ] **TASK-5.2.4**: Implement automatic function deployment on push
- [ ] **TASK-5.2.5**: Implement rollback capability

---

## 6. Function Deployment & Operations

### 6.1 Function Logs
- [ ] **TASK-6.1.1**: Create function logs table schema
- [ ] **TASK-6.1.2**: Implement log capture during execution
- [ ] **TASK-6.1.3**: Implement `GET /_/functions/:id/logs` endpoint
- [ ] **TASK-6.1.4**: Create logs viewer UI component
- [ ] **TASK-6.1.5**: Implement log filtering (by time, level)
- [ ] **TASK-6.1.6**: Implement log retention policy

### 6.2 Function Metrics
- [ ] **TASK-6.2.1**: Create function metrics schema
- [ ] **TASK-6.2.2**: Track invocation count per function
- [ ] **TASK-6.2.3**: Track execution duration statistics
- [ ] **TASK-6.2.4**: Track error rate per function
- [ ] **TASK-6.2.5**: Implement `GET /_/functions/:id/metrics` endpoint
- [ ] **TASK-6.2.6**: Create metrics dashboard in UI

---

## Deliverables Checklist

- [ ] User can write a function in the Monaco editor UI
- [ ] User can configure function runtime (TS/JS/Python)
- [ ] User can configure function dependencies
- [ ] User can link function to an endpoint
- [ ] User can test execute function via UI
- [ ] Function executes via public API endpoint (`/faas/:path`)
- [ ] Function returns computed result to caller
- [ ] Function execution is sandboxed and secure
- [ ] (Optional) User can deploy function via Git push

---

## Dependencies

- **Epic 1**: Base Setup (Auth, Users, Teams, basic UI)
- **Epic 2**: Proxy Feature (Secrets management for secret injection)

## Technical Notes

- WASM runtime selection is critical - consider Wasmer for its maturity
- QuickJS is a lightweight option for JS/TS execution
- Pyodide is the most mature Python-in-WASM solution
- Consider cold start optimization (keep runtimes warm)
- Function code should be stored in database, not filesystem
- Consider implementing function warm pools for frequently-used functions
