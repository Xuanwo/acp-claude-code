import { query } from '@anthropic-ai/claude-code'
import {
  Agent,
  Client,
  PROTOCOL_VERSION,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  AuthenticateRequest,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  LoadSessionRequest,
  LoadSessionResponse,
} from '@zed-industries/agent-client-protocol'
import type { ClaudeMessage, ClaudeStreamEvent } from './types.js'

interface AgentSession {
  pendingPrompt: AsyncIterableIterator<ClaudeMessage> | null
  abortController: AbortController | null
}

export class ClaudeACPAgent implements Agent {
  private sessions: Map<string, AgentSession> = new Map()
  private DEBUG = process.env.ACP_DEBUG === 'true'
  
  constructor(private client: Client) {
    this.log('Initialized with client')
  }
  
  private log(message: string, ...args: unknown[]) {
    if (this.DEBUG) {
      console.error(`[ClaudeACPAgent] ${message}`, ...args)
    }
  }
  
  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    this.log(`Initialize with protocol version: ${params.protocolVersion}`)
    
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    }
  }
  
  async newSession(_params: NewSessionRequest): Promise<NewSessionResponse> {
    this.log('Creating new session')
    
    const sessionId = Math.random().toString(36).substring(2)
    
    this.sessions.set(sessionId, {
      pendingPrompt: null,
      abortController: null,
    })
    
    this.log(`Created session: ${sessionId}`)
    
    return {
      sessionId,
    }
  }
  
  async loadSession?(_params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.log('Load session not implemented')
    throw new Error('Load session not supported')
  }
  
  async authenticate(_params: AuthenticateRequest): Promise<void> {
    this.log('Authenticate called')
    // Claude Code SDK handles authentication internally through ~/.claude/config.json
    // Users should run `claude setup-token` or login through the CLI
    this.log('Using Claude Code authentication from ~/.claude/config.json')
  }
  
  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const session = this.sessions.get(params.sessionId)
    
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`)
    }
    
    this.log(`Processing prompt for session: ${params.sessionId}`)
    
    // Cancel any pending prompt
    if (session.abortController) {
      session.abortController.abort()
    }
    
    session.abortController = new AbortController()
    
    try {
      // Convert prompt content blocks to a single string
      const promptText = params.prompt
        .filter((block): block is { type: 'text', text: string } => 
          block.type === 'text'
        )
        .map(block => block.text)
        .join('')
      
      this.log(`Prompt: ${promptText.substring(0, 100)}...`)
      
      // Start Claude query
      const messages = query({
        prompt: promptText,
        options: {
          maxTurns: 10,
          permissionMode: 'default'
        }
      })
      
      session.pendingPrompt = messages
      
      // Process messages and send updates
      for await (const message of messages) {
        if (session.abortController?.signal.aborted) {
          return { stopReason: 'cancelled' }
        }
        
        await this.handleClaudeMessage(params.sessionId, message)
      }
      
      session.pendingPrompt = null
      
      return {
        stopReason: 'end_turn',
      }
      
    } catch (error) {
      this.log('Error during prompt processing:', error)
      
      if (session.abortController?.signal.aborted) {
        return { stopReason: 'cancelled' }
      }
      
      // Send error to client
      await this.client.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        },
      })
      
      return {
        stopReason: 'end_turn',
      }
    } finally {
      session.pendingPrompt = null
      session.abortController = null
    }
  }
  
  async cancel(params: CancelNotification): Promise<void> {
    this.log(`Cancel requested for session: ${params.sessionId}`)
    
    const session = this.sessions.get(params.sessionId)
    if (session) {
      session.abortController?.abort()
      
      if (session.pendingPrompt && session.pendingPrompt.return) {
        await session.pendingPrompt.return()
        session.pendingPrompt = null
      }
    }
  }
  
  private async handleClaudeMessage(sessionId: string, message: ClaudeMessage): Promise<void> {
    this.log(`Handling message type: ${message.type}`, JSON.stringify(message).substring(0, 200))
    
    switch (message.type) {
      case 'system':
        // System messages are internal, don't send to client
        break
        
      case 'assistant':
        // Handle assistant message from Claude
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              await this.client.sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: 'agent_message_chunk',
                  content: {
                    type: 'text',
                    text: content.text || '',
                  },
                },
              })
            }
          }
        }
        break
        
      case 'result':
        // Result message indicates completion
        this.log('Query completed with result:', message.result)
        break
        
      case 'text':
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: message.text || '',
            },
          },
        })
        break
        
      case 'tool_use_start':
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: message.id || '',
            title: message.tool_name || 'Tool',
            kind: this.mapToolKind(message.tool_name || ''),
            status: 'pending',
            rawInput: (message.input || {}) as Record<string, unknown>,
          },
        })
        break
        
      case 'tool_use_output':
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: message.id || '',
            status: 'completed',
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: message.output || '',
                },
              },
            ],
            rawOutput: { output: message.output },
          },
        })
        break
        
      case 'tool_use_error':
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: message.id || '',
            status: 'failed',
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: `Error: ${message.error}`,
                },
              },
            ],
            rawOutput: { error: message.error },
          },
        })
        break
        
      case 'stream_event': {
        // Handle stream events if needed
        const event = message.event as ClaudeStreamEvent
        if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: event.content_block.text || '',
              },
            },
          })
        } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: event.delta.text || '',
              },
            },
          })
        }
        break
      }
        
      default:
        this.log(`Unhandled message type: ${message.type}`)
    }
  }
  
  private mapToolKind(toolName: string): 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other' {
    const lowerName = toolName.toLowerCase()
    
    if (lowerName.includes('read') || lowerName.includes('view') || lowerName.includes('get')) {
      return 'read'
    } else if (lowerName.includes('write') || lowerName.includes('create') || lowerName.includes('update') || lowerName.includes('edit')) {
      return 'edit'
    } else if (lowerName.includes('delete') || lowerName.includes('remove')) {
      return 'delete'
    } else if (lowerName.includes('move') || lowerName.includes('rename')) {
      return 'move'
    } else if (lowerName.includes('search') || lowerName.includes('find') || lowerName.includes('grep')) {
      return 'search'
    } else if (lowerName.includes('run') || lowerName.includes('execute') || lowerName.includes('bash')) {
      return 'execute'
    } else if (lowerName.includes('think') || lowerName.includes('plan')) {
      return 'think'
    } else if (lowerName.includes('fetch') || lowerName.includes('download')) {
      return 'fetch'
    } else {
      return 'other'
    }
  }
}