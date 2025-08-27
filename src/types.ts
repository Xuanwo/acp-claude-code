import type {
  Agent,
  Client,
  InitializeParams,
  InitializeResponse,
  SendUserMessageParams,
  UserMessageChunk,
  AssistantMessageChunk,
  StreamAssistantMessageChunkParams,
  PushToolCallParams,
  PushToolCallResponse,
  UpdateToolCallParams,
  RequestToolCallConfirmationParams,
  RequestToolCallConfirmationResponse,
  ToolCallId,
  ToolCallStatus,
  Icon
} from '@zed-industries/agentic-coding-protocol'

// Claude Code SDK types
export interface ClaudeMessage {
  type: 'system' | 'user' | 'assistant' | 'result'
  content?: string
  toolCalls?: any[]
  metadata?: any
}

export interface ClaudeQueryOptions {
  sessionId?: string
  workingDirectory?: string
  systemPrompt?: string
  maxTurns?: number
  allowedTools?: string[]
  permissionMode?: string
}

// Re-export ACP types for convenience
export type {
  Agent,
  Client,
  InitializeParams,
  InitializeResponse,
  SendUserMessageParams,
  UserMessageChunk,
  AssistantMessageChunk,
  StreamAssistantMessageChunkParams,
  PushToolCallParams,
  PushToolCallResponse,
  UpdateToolCallParams,
  RequestToolCallConfirmationParams,
  RequestToolCallConfirmationResponse,
  ToolCallId,
  ToolCallStatus,
  Icon
}