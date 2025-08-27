# ACP Claude Code Bridge

A bridge implementation that enables Claude Code to work with the Agent Client Protocol (ACP), allowing it to integrate with Zed editor and other ACP-compatible clients.

## Architecture

This project implements an ACP Agent that wraps the Claude Code SDK, providing:
- **Session persistence**: Maintains conversation context across multiple messages
- **Streaming responses**: Real-time output from Claude
- **Tool call support**: Full integration with Claude's tool use capabilities (TODO)
- **Message format conversion**: Seamless translation between ACP and Claude SDK formats

## Usage

Add to your Zed configuration:

```json
{
  "agent_servers": {
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
  "agent_servers": {
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

# Lint checking
pnpm run lint
```

## Features

### Implemented
- ✅ Full ACP protocol implementation
- ✅ Session persistence with Claude's native session management
- ✅ Streaming responses
- ✅ Text content blocks
- ✅ Claude SDK integration
- ✅ Tool call support with proper status updates
- ✅ Session loading capability

### Planned
- [ ] Permission management
- [ ] Image/audio content blocks
- [ ] Advanced error handling
- [ ] Session export/import

## Authentication

This bridge uses Claude Code's built-in authentication. You need to authenticate Claude Code first:

```bash
# Login with your Anthropic account
claude setup-token

# Or if you're already logged in through the Claude Code CLI, it will use that session
```

The bridge will automatically use the existing Claude Code authentication from `~/.claude/config.json`.

## Debugging

Enable debug logging to troubleshoot issues:

```bash
# Set the debug environment variable
ACP_DEBUG=true npx acp-claude-code
```

This will output detailed logs including:
- Session creation and management
- Message processing
- Tool call execution
- Claude SDK interactions

## Troubleshooting

### Session not persisting
The bridge now correctly maintains session context using Claude's native session management. Each ACP session maps to a Claude session that persists throughout the conversation.

### "Claude Code process exited" error
Make sure you're authenticated with Claude Code:
```bash
claude setup-token
```

### Tool calls not working
Tool calls are fully supported. Ensure your Zed client is configured to handle tool call updates properly.

## Technical Details

### Session Management
The bridge uses a two-step session management approach:
1. Creates an ACP session ID initially
2. On first message, obtains and stores Claude's session ID
3. Uses Claude's `resume` parameter for subsequent messages to maintain context

### Message Flow
1. **Client → Agent**: ACP protocol messages
2. **Agent → Claude SDK**: Converted to Claude SDK format with session resume
3. **Claude SDK → Agent**: Stream of response messages
4. **Agent → Client**: Converted back to ACP protocol format

## License

MIT
