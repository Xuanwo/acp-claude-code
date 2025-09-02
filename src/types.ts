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
    role?: string;
    content?: Array<{
      type: string;
      text?: string;
      // For tool_use blocks in assistant messages
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      // For tool_result in user messages
      tool_use_id?: string;
      content?: string;
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

// type from https://github.com/Yuyz0112/claude-code-reverse/blob/c0d99ea1ab7168c12ba74838cfea355ce10f6c56/results/tools/TodoWrite.tool.yaml#L242-L259
export type ClaudeTodoList =  Array<{
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority?: "high" | "medium" | "low";
}>

export interface ACPToolCallRegularContent {
  type: "content";
  content: {
    type: "text";
    text: string;
  };
}

export interface ACPToolCallDiffContent {
  type: "diff";
  path: string;
  oldText: string;
  newText: string;
}

export type ACPToolCallContent = ACPToolCallRegularContent | ACPToolCallDiffContent;
