#!/usr/bin/env node

import { AgentSideConnection } from '@zed-industries/agent-client-protocol'
import { ClaudeACPAgent } from './agent.js'
import { Writable, Readable } from 'node:stream'
import { WritableStream, ReadableStream } from 'node:stream/web'

async function main() {
  console.error('[Main] Starting Claude Code ACP Bridge...')
  
  try {
    // Create ACP connection using stdio
    console.error('[Main] Creating ACP connection via stdio...')
    
    // Convert Node.js streams to Web Streams
    const input = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>
    const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
    
    // We're implementing an Agent, so we use AgentSideConnection
    // It expects a function that receives a Client and returns an Agent
    new AgentSideConnection(
      (client) => new ClaudeACPAgent(client),
      input,  // WritableStream for output (to client)
      output  // ReadableStream for input (from client)
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