# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ACP (Agent Client Protocol) bridge that enables Claude Code to work with Zed editor and other ACP-compatible clients. It wraps the Claude Code SDK to provide ACP protocol compatibility.

## Common Development Tasks

### Build and Development Commands

- `pnpm run build` - Build the TypeScript project to dist/
- `pnpm run dev` - Run in development mode with hot reload using tsx
- `pnpm run typecheck` - Run TypeScript type checking without emitting files
- `pnpm run lint` - Run ESLint on the src/ directory
- `pnpm run start` - Run the built application from dist/

### Testing the ACP Agent

- Run directly: `node dist/index.js` (after building)
- Run in development: `pnpm run dev`
- Debug mode: Set `ACP_DEBUG=true` environment variable for verbose logging

## Architecture

The project implements the Agent Client Protocol with three main components:

1. **Agent (src/agent.ts)** - Core ClaudeACPAgent class that:
   - Manages sessions with 1:1 mapping between ACP and Claude sessions
   - Handles streaming responses from Claude Code SDK
   - Converts between ACP and Claude message formats
   - Maps tool calls to appropriate ACP tool kinds

2. **Server (src/index.ts)** - Entry point that:
   - Initializes the ACP server using stdio transport
   - Sets up the ClaudeACPAgent with the ACP client

3. **Types (src/types.ts)** - TypeScript interfaces for Claude SDK messages

## Key Implementation Details

### Session Management

- Sessions are stored in a Map with random IDs
- Each session tracks `pendingPrompt` and `abortController`
- Cancellation is handled via AbortController

### Message Processing

- Claude SDK messages are processed in `handleClaudeMessage()`
- Tool calls are mapped to ACP tool kinds (read, edit, delete, move, search, execute, think, fetch, other)
- Streaming text is sent as agent_message_chunk updates

### Authentication

- Uses Claude Code's built-in authentication from ~/.claude/config.json
- Users should authenticate via `claude setup-token` before using

## Package Management

- Use `pnpm` for all package management operations
- Install packages with exact versions (no ^ or ~ prefixes)

## Important Files

- **package.json** - Project configuration and scripts
- **tsconfig.json** - TypeScript compiler configuration
- **.eslintrc.json** - ESLint rules configuration
- **dist/** - Compiled JavaScript output (gitignored)
