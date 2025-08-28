import { query } from '@anthropic-ai/claude-code'
import type { SDKMessage } from '@anthropic-ai/claude-code'
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
  pendingPrompt: AsyncIterableIterator<SDKMessage> | null
  abortController: AbortController | null
  claudeSessionId?: string  // Claude's actual session_id, obtained after first message
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'  // Permission mode for this session
}

export class ClaudeACPAgent implements Agent {
  private sessions: Map<string, AgentSession> = new Map()
  private DEBUG = process.env.ACP_DEBUG === 'true'
  private defaultPermissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' = 
    (process.env.ACP_PERMISSION_MODE as 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan') || 'default'
  
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
        loadSession: true,  // Enable session loading
      },
    }
  }
  
  async newSession(_params: NewSessionRequest): Promise<NewSessionResponse> {
    this.log('Creating new session')
    
    // For now, create a temporary session ID
    // We'll get the real Claude session_id on the first message
    // and store it for future use
    const sessionId = Math.random().toString(36).substring(2)
    
    this.sessions.set(sessionId, {
      pendingPrompt: null,
      abortController: null,
      claudeSessionId: undefined,  // Will be set after first message
      permissionMode: this.defaultPermissionMode,
    })
    
    this.log(`Created session: ${sessionId}`)
    
    return {
      sessionId,
    }
  }
  
  async loadSession?(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.log(`Loading session: ${params.sessionId}`)
    
    // Check if we already have this session
    const existingSession = this.sessions.get(params.sessionId)
    if (existingSession) {
      this.log(`Session ${params.sessionId} already exists with Claude session_id: ${existingSession.claudeSessionId}`)
      // Keep the existing session with its Claude session_id intact
      return null  // Return null to indicate success
    }
    
    // Create a new session entry for this ID if it doesn't exist
    // This handles the case where the agent restarts but Zed still has the session ID
    this.sessions.set(params.sessionId, {
      pendingPrompt: null,
      abortController: null,
      claudeSessionId: undefined,
      permissionMode: this.defaultPermissionMode,
    })
    
    this.log(`Created new session entry for loaded session: ${params.sessionId}`)
    return null  // Return null to indicate success
  }
  
  async authenticate(_params: AuthenticateRequest): Promise<void> {
    this.log('Authenticate called')
    // Claude Code SDK handles authentication internally through ~/.claude/config.json
    // Users should run `claude setup-token` or login through the CLI
    this.log('Using Claude Code authentication from ~/.claude/config.json')
  }
  
  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const currentSessionId = params.sessionId
    const session = this.sessions.get(currentSessionId)
    
    if (!session) {
      this.log(`Session ${currentSessionId} not found in map. Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`)
      throw new Error(`Session ${currentSessionId} not found`)
    }
    
    this.log(`Processing prompt for session: ${currentSessionId}`)
    this.log(`Session state: claudeSessionId=${session.claudeSessionId}, pendingPrompt=${!!session.pendingPrompt}, abortController=${!!session.abortController}`)
    this.log(`Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`)
    
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
      
      this.log(`Prompt received (${promptText.length} chars): ${promptText.substring(0, 100)}...`)
      
      // Use simple string prompt - Claude SDK will handle history with resume
      const queryInput = promptText
      
      if (!session.claudeSessionId) {
        this.log('First message for this session, no resume')
      } else {
        this.log(`Resuming Claude session: ${session.claudeSessionId}`)
      }
      
      // Check for permission mode hints in the prompt
      let permissionMode = session.permissionMode || this.defaultPermissionMode
      
      // Allow dynamic permission mode switching via special commands
      if (promptText.includes('[ACP:PERMISSION:ACCEPT_EDITS]')) {
        permissionMode = 'acceptEdits'
        session.permissionMode = 'acceptEdits'
      } else if (promptText.includes('[ACP:PERMISSION:BYPASS]')) {
        permissionMode = 'bypassPermissions'
        session.permissionMode = 'bypassPermissions'
      } else if (promptText.includes('[ACP:PERMISSION:DEFAULT]')) {
        permissionMode = 'default'
        session.permissionMode = 'default'
      }
      
      this.log(`Using permission mode: ${permissionMode}`)
      
      // Start Claude query
      const messages = query({
        prompt: queryInput,
        options: {
          maxTurns: 10,
          permissionMode: permissionMode,
          // Resume if we have a Claude session_id
          resume: session.claudeSessionId || undefined
        }
      })
      
      session.pendingPrompt = messages as AsyncIterableIterator<SDKMessage>
      
      // Process messages and send updates
      let messageCount = 0
      
      for await (const message of messages) {
        if (session.abortController?.signal.aborted) {
          return { stopReason: 'cancelled' }
        }
        
        messageCount++
        this.log(`Processing message #${messageCount} of type: ${(message as SDKMessage).type}`)
        
        // Extract and store Claude's session_id from any message that has it
        const sdkMessage = message as SDKMessage
        if ('session_id' in sdkMessage && typeof sdkMessage.session_id === 'string' && sdkMessage.session_id) {
          if (session.claudeSessionId !== sdkMessage.session_id) {
            this.log(`Updating Claude session_id from ${session.claudeSessionId} to ${sdkMessage.session_id}`)
            session.claudeSessionId = sdkMessage.session_id
            // Update the session in the map to ensure persistence
            this.sessions.set(currentSessionId, session)
          }
        }
        
        // Log message type and content for debugging
        if (sdkMessage.type === 'user') {
          this.log(`Processing user message`)
        } else if (sdkMessage.type === 'assistant') {
          this.log(`Processing assistant message`)
          // Log assistant message content for debugging
          if ('message' in sdkMessage && sdkMessage.message) {
            const assistantMsg = sdkMessage.message as { content?: Array<{ type: string; text?: string }> }
            if (assistantMsg.content) {
              this.log(`Assistant content: ${JSON.stringify(assistantMsg.content).substring(0, 200)}`)
            }
          }
        }
        
        await this.handleClaudeMessage(currentSessionId, message as ClaudeMessage)
      }
      
      this.log(`Processed ${messageCount} messages total`)
      this.log(`Final Claude session_id: ${session.claudeSessionId}`)
      session.pendingPrompt = null
      
      // Ensure the session is properly saved with the Claude session_id
      this.sessions.set(currentSessionId, session)
      
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
  
  private async handleClaudeMessage(sessionId: string, message: ClaudeMessage | SDKMessage): Promise<void> {
    // Use a more flexible type handling approach
    const msg = message as ClaudeMessage
    const messageType = 'type' in message ? message.type : undefined
    this.log(`Handling message type: ${messageType}`, JSON.stringify(message).substring(0, 200))
    
    switch (messageType) {
      case 'system':
        // System messages are internal, don't send to client
        break
        
      case 'user':
        // Handle user message echo from Claude (for context)
        this.log('User message echoed from Claude')
        // User messages are already known to the client, don't send back
        break
        
      case 'assistant':
        // Handle assistant message from Claude
        if (msg.message && msg.message.content) {
          for (const content of msg.message.content) {
            if (content.type === 'text') {
              // Send text content without adding extra newlines
              // Claude already formats the text properly
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
            } else if (content.type === 'tool_use') {
              // Handle tool_use blocks in assistant messages
              this.log(`Tool use block in assistant message: ${content.name}, id: ${content.id}`)
              
              // Send tool_use information to client
              await this.client.sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: 'agent_message_chunk',
                  content: {
                    type: 'text',
                    text: `\n[Using tool: ${content.name}]\n`,
                  },
                },
              })
              
              // If this is TodoWrite, format the todos nicely
              if (content.name === 'TodoWrite' && content.input?.todos) {
                const todos = content.input.todos as Array<{content: string, status: string, activeForm: string}>
                let todoText = '📝 Todo List:\n'
                todos.forEach((todo, index) => {
                  const statusEmoji = todo.status === 'completed' ? '✅' : 
                                     todo.status === 'in_progress' ? '🔄' : '⏳'
                  todoText += `${index + 1}. ${statusEmoji} ${todo.content}\n`
                })
                
                await this.client.sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: 'agent_message_chunk',
                    content: {
                      type: 'text',
                      text: todoText + '\n',
                    },
                  },
                })
              }
            }
          }
        } else if ('text' in msg && typeof msg.text === 'string') {
          // Handle direct text in assistant message
          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: msg.text,
              },
            },
          })
        }
        break
        
      case 'result':
        // Result message indicates completion
        this.log('Query completed with result:', msg.result)
        break
        
      case 'text':
        // Direct text messages - preserve formatting without extra newlines
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: msg.text || '',
            },
          },
        })
        break
        
      case 'tool_use_start': {
        // Log the tool call details for debugging
        this.log(`Tool call started: ${msg.tool_name}`, `ID: ${msg.id}`)
        
        // Handle tool input - ensure it's a proper object
        const input = msg.input || {}
        
        // Log the input for debugging
        if (this.DEBUG) {
          try {
            this.log(`Tool input:`, JSON.stringify(input, null, 2))
            
            // Special logging for content field
            if (input && typeof input === 'object' && 'content' in input) {
              const content = (input as Record<string, unknown>).content
              if (typeof content === 'string') {
                const preview = content.substring(0, 100)
                this.log(`Content preview: ${preview}${content.length > 100 ? '...' : ''}`)
              }
            }
          } catch (e) {
            this.log('Error logging input:', e)
          }
        }
        
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: msg.id || '',
            title: msg.tool_name || 'Tool',
            kind: this.mapToolKind(msg.tool_name || ''),
            status: 'pending',
            // Pass the input directly without extra processing
            rawInput: input as Record<string, unknown>,
          },
        })
        
        // For TodoWrite tool, also send formatted todo list as text
        if (msg.tool_name === 'TodoWrite' && input && typeof input === 'object' && 'todos' in input) {
          const todos = (input as {todos: Array<{content: string, status: string, activeForm: string}>}).todos
          if (todos && Array.isArray(todos)) {
            let todoText = '\n📝 Todo List Update:\n'
            todos.forEach((todo, index) => {
              const statusEmoji = todo.status === 'completed' ? '✅' : 
                                 todo.status === 'in_progress' ? '🔄' : '⏳'
              todoText += `  ${index + 1}. ${statusEmoji} ${todo.content}\n`
            })
            
            await this.client.sessionUpdate({
              sessionId,
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: {
                  type: 'text',
                  text: todoText,
                },
              },
            })
          }
        }
        break
      }
        
      case 'tool_use_output': {
        const outputText = msg.output || ''
        
        // Log the tool output for debugging
        this.log(`Tool call completed: ${msg.id}`)
        this.log(`Tool output length: ${outputText.length} characters`)
        
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: msg.id || '',
            status: 'completed',
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: outputText,
                },
              },
            ],
            // Pass output directly without extra wrapping
            rawOutput: msg.output ? { output: outputText } : undefined,
          },
        })
        break
      }
        
      case 'tool_use_error':
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: msg.id || '',
            status: 'failed',
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: `Error: ${msg.error}`,
                },
              },
            ],
            rawOutput: { error: msg.error },
          },
        })
        break
        
      case 'stream_event': {
        // Handle stream events if needed
        const event = msg.event as ClaudeStreamEvent
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
        } else if (event.type === 'content_block_stop') {
          // Content block ended - Claude handles its own formatting
          this.log('Content block stopped')
        }
        break
      }
        
      default:
        this.log(`Unhandled message type: ${messageType}`, JSON.stringify(message).substring(0, 500))
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