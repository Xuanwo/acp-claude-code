// Re-export all types from the agent-client-protocol
export * from "@zed-industries/agent-client-protocol";

// Claude Code SDK message types
export interface ClaudeMessage {
  type: string;
  text?: string;
  id?: string;
  tool_name?: string;
  input?: unknown;
  output?: string;
  error?: string;
  event?: ClaudeStreamEvent;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      // For tool_use blocks
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  result?: string;
  subtype?: string;
}

export interface ClaudeStreamEvent {
  type: string;
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type: string;
    text?: string;
  };
}

export interface ClaudeQueryOptions {
  maxTurns?: number;
  permissionMode?: "ask_on_edit" | "ask_always" | "auto" | "default";
  onStatus?: (status: string) => void;
}
