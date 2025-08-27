# ACP Claude Code Bridge

A bridge implementation that enables Claude Code to work with the Agent Client Protocol (ACP), allowing it to integrate with Zed editor and other ACP-compatible clients.

## Architecture

This project implements an ACP Agent that wraps the Claude Code SDK, providing:
- Session management with 1:1 mapping between ACP and Claude sessions
- Streaming responses
- Message format conversion between ACP and Claude SDK

## Installation

```bash
npm install
npm run build
```

## Usage

### As an ACP Agent for Zed

Run the agent via stdio (which Zed expects):

```bash
node dist/index.js
```

### Configuration in Zed

Add to your Zed configuration:

```json
{
  "agents": {
    "claude-code": {
      "command": "node",
      "args": ["/path/to/acp-claude-code/dist/index.js"]
    }
  }
}
```

## Development

```bash
# Run in development mode
npm run dev

# Type checking
npm run typecheck

# Build
npm run build
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