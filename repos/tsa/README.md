# @tdsk/tsa

Terminal CLI for [Threaded Stack](https://threadedstack.com) — manage sandboxes, interact with AI agents, and sync files from your terminal.

## Install

```bash
npm install -g @tdsk/tsa
```

## Quick Start

```bash
# Authenticate with your API key
tsa login <your-api-key>

# Launch a sandbox with an AI tool runtime
tsa run <sandbox-id>

# Start an interactive AI chat session
tsa chat

# List available sandboxes
tsa sandbox --list

# Check auth status
tsa status
```

## Supported Platforms

| Platform | Architecture |
|----------|-------------|
| macOS | Apple Silicon (arm64) |
| macOS | Intel (x64) |
| Linux | x64 |
| Linux | arm64 |
| Windows | x64 |

## Documentation

Full documentation available at [threadedstack.com/docs](https://www.threadedstack.com/docs).

## License

ISC
