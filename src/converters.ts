import type {
  UserMessageChunk,
  AssistantMessageChunk,
  StreamAssistantMessageChunkParams
} from './types.js'
import type { ClaudeMessage } from './types.js'

/**
 * Convert ACP UserMessageChunk array to Claude SDK prompt string
 */
export function convertUserMessageToPrompt(chunks: UserMessageChunk[]): string {
  let prompt = ''
  
  for (const chunk of chunks) {
    if ('text' in chunk) {
      prompt += chunk.text
    } else if ('path' in chunk) {
      // Handle file path references
      prompt += `\n[File: ${chunk.path}]\n`
    }
  }
  
  return prompt.trim()
}

/**
 * Convert Claude SDK message to ACP AssistantMessageChunk
 */
export function convertClaudeMessageToChunk(message: ClaudeMessage): AssistantMessageChunk | null {
  switch (message.type) {
    case 'assistant':
    case 'result':
      if (message.content) {
        return { text: message.content }
      }
      break
      
    case 'system':
      // System messages might be internal thoughts
      if (message.content) {
        return { thought: message.content }
      }
      break
  }
  
  return null
}

/**
 * Create a StreamAssistantMessageChunkParams from Claude message
 */
export function createStreamChunkParams(message: ClaudeMessage): StreamAssistantMessageChunkParams | null {
  const chunk = convertClaudeMessageToChunk(message)
  if (chunk) {
    return { chunk }
  }
  return null
}