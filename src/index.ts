#!/usr/bin/env node

import { ClientConnection } from '@zed-industries/agentic-coding-protocol'
import { ClaudeACPAgent } from './agent.js'

async function main() {
  console.error('[Main] Starting Claude Code ACP Bridge...')
  
  try {
    // Create ACP connection using stdio
    console.error('[Main] Creating ACP connection via stdio...')
    
    // We're implementing an Agent, so we use ClientConnection
    // It expects a function that receives a Client and returns an Agent
    const connection = new ClientConnection(
      (client) => new ClaudeACPAgent(client),
      process.stdout as any, // WritableStream for output (to client)
      process.stdin as any   // ReadableStream for input (from client)
    )
    
    console.error('[Main] Claude Code ACP Bridge is running')
    
    // Keep the process alive
    process.stdin.resume()
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error('[Main] Received SIGINT, shutting down...')
      process.exit(0)
    })
    
    process.on('SIGTERM', async () => {
      console.error('[Main] Received SIGTERM, shutting down...')
      process.exit(0)
    })
    
  } catch (error) {
    console.error('[Main] Fatal error:', error)
    process.exit(1)
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('[Main] Unhandled error:', error)
    process.exit(1)
  })
}

export { ClaudeACPAgent }