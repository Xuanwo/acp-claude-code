#!/usr/bin/env node

import { AgentSideConnection } from '@zed-industries/agent-client-protocol'
import { ClaudeACPAgent } from './agent.js'
import { Writable, Readable } from 'node:stream'
import { WritableStream, ReadableStream } from 'node:stream/web'

async function main() {
  // Only log to stderr in debug mode
  const DEBUG = process.env.ACP_DEBUG === 'true'
  
  const log = (message: string) => {
    if (DEBUG) {
      console.error(`[ACP-Claude] ${message}`)
    }
  }
  
  log('Starting Claude Code ACP Bridge...')
  
  try {
    // Prevent any accidental stdout writes that could corrupt the protocol
    console.log = (...args) => {
      console.error('[WARNING] console.log intercepted:', ...args)
    }
    
    log('Creating ACP connection via stdio...')
    
    // Convert Node.js streams to Web Streams
    // IMPORTANT: stdout is for sending to client, stdin is for receiving from client
    const outputStream = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>
    const inputStream = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
    
    // We're implementing an Agent, so we use AgentSideConnection
    // First parameter is output (to client), second is input (from client)
    new AgentSideConnection(
      (client) => new ClaudeACPAgent(client),
      outputStream,  // WritableStream for sending data to client (stdout)
      inputStream    // ReadableStream for receiving data from client (stdin)
    )
    
    log('Claude Code ACP Bridge is running')
    
    // Keep the process alive
    process.stdin.resume()
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log('Received SIGINT, shutting down...')
      process.exit(0)
    })
    
    process.on('SIGTERM', () => {
      log('Received SIGTERM, shutting down...')
      process.exit(0)
    })
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('[FATAL] Uncaught exception:', error)
      process.exit(1)
    })
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason)
      process.exit(1)
    })
    
  } catch (error) {
    console.error('[FATAL] Error starting ACP bridge:', error)
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