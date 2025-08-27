import { query } from '@anthropic-ai/claude-code'
import type {
  Agent,
  Client,
  InitializeParams,
  InitializeResponse,
  SendUserMessageParams
} from './types.js'
import type { ClaudeMessage } from './types.js'
import {
  convertUserMessageToPrompt,
  createStreamChunkParams
} from './converters.js'

export class ClaudeACPAgent implements Agent {
  private activeQuery: AsyncIterableIterator<ClaudeMessage> | null = null
  private isAuthenticated = false
  
  constructor(private client: Client) {
    console.error('[ClaudeACPAgent] Initialized with client')
  }
  
  async initialize(params: InitializeParams): Promise<InitializeResponse> {
    console.error(`[ClaudeACPAgent] Initialize with protocol version: ${params.protocolVersion}`)
    
    // Try to check if Claude Code is already authenticated
    // Claude Code SDK will handle authentication internally
    try {
      // The SDK will use the existing Claude Code authentication
      // (from ~/.claude/config.json or the auth token)
      this.isAuthenticated = true
      console.error('[ClaudeACPAgent] Using Claude Code authentication')
    } catch (error) {
      console.error('[ClaudeACPAgent] Authentication check failed:', error)
      this.isAuthenticated = false
    }
    
    return {
      isAuthenticated: this.isAuthenticated,
      protocolVersion: params.protocolVersion
    }
  }
  
  async authenticate(): Promise<void> {
    console.error('[ClaudeACPAgent] Authenticate called')
    
    // Claude Code SDK should handle authentication through its own mechanism
    // Users should run `claude setup-token` or login through the CLI
    console.error('[ClaudeACPAgent] Please authenticate using: claude setup-token')
    
    // The SDK will handle the actual authentication
    this.isAuthenticated = true
  }
  
  async sendUserMessage(params: SendUserMessageParams): Promise<void> {
    console.error('[ClaudeACPAgent] sendUserMessage called')
    
    // Convert user message chunks to prompt
    const prompt = convertUserMessageToPrompt(params.chunks)
    console.error(`[ClaudeACPAgent] Converted prompt: ${prompt.substring(0, 100)}...`)
    
    try {
      // Start Claude query - the SDK will use existing Claude Code authentication
      const messages = query({
        prompt,
        options: {
          maxTurns: 10,
          permissionMode: 'default'
          // The SDK will automatically use the authenticated session
        }
      })
      
      // Store for potential cancellation
      this.activeQuery = messages
      
      // Stream responses back through client
      for await (const message of messages) {
        console.error(`[ClaudeACPAgent] Received message type: ${message.type}`)
        
        // Convert to ACP format and send
        const chunkParams = createStreamChunkParams(message)
        if (chunkParams) {
          await this.client.streamAssistantMessageChunk(chunkParams)
        }
        
        // Handle tool calls if present
        // Note: toolCalls might not exist on all message types
        const toolCalls = (message as any).toolCalls
        if (toolCalls && toolCalls.length > 0) {
          // For now, we'll skip tool calls
          console.error('[ClaudeACPAgent] Tool calls detected but not yet implemented')
        }
      }
      
      this.activeQuery = null
      console.error('[ClaudeACPAgent] Message processing complete')
      
    } catch (error) {
      console.error('[ClaudeACPAgent] Error during message processing:', error)
      this.activeQuery = null
      throw error
    }
  }
  
  async cancelSendMessage(): Promise<void> {
    console.error('[ClaudeACPAgent] cancelSendMessage called')
    
    if (this.activeQuery && this.activeQuery.return) {
      await this.activeQuery.return()
      this.activeQuery = null
    }
  }
}