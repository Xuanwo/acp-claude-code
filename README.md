# ACP Claude Code Bridge

A bridge implementation that enables Claude Code to work with the Agent Client Protocol (ACP), allowing it to integrate with Zed editor and other ACP-compatible clients.

## Architecture

This project implements an ACP Agent that wraps the Claude Code SDK, providing:
- Session management with 1:1 mapping between ACP and Claude sessions
- Streaming responses
- Message format conversion between ACP and Claude SDK

## Installation

The package is available on npm and can be run directly without installation using `npx` or `pnpx`:

```bash
# No installation needed! Run directly with npx
npx acp-claude-code

# Or if you use pnpm
pnpx acp-claude-code
```

If you want to specify a particular version:

```bash
npx acp-claude-code@0.1.0
```

## Usage

### As an ACP Agent for Zed

Run the agent using npx or pnpx:

```bash
# Using npm's npx
npx acp-claude-code

# Using pnpm's pnpx
pnpx acp-claude-code
```

### Configuration in Zed

Add to your Zed configuration:

```json
{
  "agents": {
    "claude-code": {
      "command": "npx",
      "args": ["acp-claude-code"]
    }
  }
}
```

Or if you prefer using pnpm:

```json
{
  "agents": {
    "claude-code": {
      "command": "pnpx",
      "args": ["acp-claude-code"]
    }
  }
}
```

## Development

### Building from source

If you want to build and run from source instead of using the npm package:

```bash
# Clone the repository
git clone https://github.com/xuanwo/acp-claude-code.git
cd acp-claude-code

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run directly
node dist/index.js
```

For development with hot reload:

```bash
# Run in development mode
pnpm run dev

# Type checking
pnpm run typecheck

# Build
pnpm run build
```

## Features

### Implemented
- ✅ Basic ACP protocol implementation
- ✅ Session management
- ✅ Streaming responses
- ✅ Text content blocks
- ✅ Claude SDK integration

### Planned
- [ ] Tool call support
- [ ] Permission management
- [ ] Image/audio content blocks
- [ ] Session persistence
- [ ] Advanced error handling

## Authentication

This bridge uses Claude Code's built-in authentication. You need to authenticate Claude Code first:

```bash
# Login with your Anthropic account
claude setup-token

# Or if you're already logged in through the Claude Code CLI, it will use that session
```

The bridge will automatically use the existing Claude Code authentication from `~/.claude/config.json`.

## License

MIT
