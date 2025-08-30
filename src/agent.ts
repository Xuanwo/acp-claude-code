import { query } from "@anthropic-ai/claude-code";
import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-code";
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
} from "@zed-industries/agent-client-protocol";
import type { ACPToolCallContent, ACPToolCallRegularContent, ClaudeMessage, ClaudeStreamEvent, ClaudeTodoList, RequestPermissionRequest } from "./types.js";
import { toAsyncIterable } from "./utils.js";

interface AgentSession {
  pendingPrompt: AsyncIterableIterator<SDKMessage> | null;
  abortController: AbortController | null;
  claudeSessionId?: string; // Claude's actual session_id, obtained after first message
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan"; // Permission mode for this session
  todoWriteToolCallIds: Set<string>; // Set of tool_call_id for todo_write tool
  toolCallContents: Map<string, ACPToolCallContent[]>; // Map of tool_call_id to tool call content
  toolCallIds: Map<string | undefined, string | undefined>; // Map of tool name to tool call ID
}

export class ClaudeACPAgent implements Agent {
  private sessions: Map<string, AgentSession> = new Map();
  private DEBUG = process.env.ACP_DEBUG === "true";
  private defaultPermissionMode:
    | "default"
    | "acceptEdits"
    | "bypassPermissions"
    | "plan" =
    (process.env.ACP_PERMISSION_MODE as
      | "default"
      | "acceptEdits"
      | "bypassPermissions"
      | "plan") || "default";
  private pathToClaudeCodeExecutable: string | undefined =
    process.env.ACP_PATH_TO_CLAUDE_CODE_EXECUTABLE;

  constructor(private client: Client) {
    this.log("Initialized with client");
  }

  private log(message: string, ...args: unknown[]) {
    if (this.DEBUG) {
      console.error(`[ClaudeACPAgent] ${message}`, ...args);
    }
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    this.log(`Initialize with protocol version: ${params.protocolVersion}`);

    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true, // Enable session loading
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true,
        },
      },
    };
  }

  async newSession(_params: NewSessionRequest): Promise<NewSessionResponse> {
    this.log("Creating new session");

    // For now, create a temporary session ID
    // We'll get the real Claude session_id on the first message
    // and store it for future use
    const sessionId = Math.random().toString(36).substring(2);

    this.sessions.set(sessionId, {
      pendingPrompt: null,
      abortController: null,
      claudeSessionId: undefined, // Will be set after first message
      permissionMode: this.defaultPermissionMode,
      todoWriteToolCallIds: new Set(),
      toolCallContents: new Map(),
      toolCallIds: new Map(),
    });

    this.log(`Created session: ${sessionId}`);

    return {
      sessionId,
    };
  }

  async loadSession?(params: LoadSessionRequest): Promise<void> {
    this.log(`Loading session: ${params.sessionId}`);

    // Check if we already have this session
    const existingSession = this.sessions.get(params.sessionId);
    if (existingSession) {
      this.log(
        `Session ${params.sessionId} already exists with Claude session_id: ${existingSession.claudeSessionId}`,
      );
      // Keep the existing session with its Claude session_id intact
      return; // Return null to indicate success
    }

    // Create a new session entry for this ID if it doesn't exist
    // This handles the case where the agent restarts but Zed still has the session ID
    this.sessions.set(params.sessionId, {
      pendingPrompt: null,
      abortController: null,
      claudeSessionId: undefined,
      permissionMode: this.defaultPermissionMode,
      todoWriteToolCallIds: new Set(),
      toolCallContents: new Map(),
      toolCallIds: new Map(),
    });

    this.log(
      `Created new session entry for loaded session: ${params.sessionId}`,
    );
    return; // Return null to indicate success
  }

  async authenticate(_params: AuthenticateRequest): Promise<void> {
    this.log("Authenticate called");
    // Claude Code SDK handles authentication internally through ~/.claude/config.json
    // Users should run `claude setup-token` or login through the CLI
    this.log("Using Claude Code authentication from ~/.claude/config.json");
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const currentSessionId = params.sessionId;
    const session = this.sessions.get(currentSessionId);

    if (!session) {
      this.log(
        `Session ${currentSessionId} not found in map. Available sessions: ${Array.from(this.sessions.keys()).join(", ")}`,
      );
      throw new Error(`Session ${currentSessionId} not found`);
    }

    this.log(`Processing prompt for session: ${currentSessionId}`);
    this.log(
      `Session state: claudeSessionId=${session.claudeSessionId}, pendingPrompt=${!!session.pendingPrompt}, abortController=${!!session.abortController}`,
    );
    this.log(
      `Available sessions: ${Array.from(this.sessions.keys()).join(", ")}`,
    );

    // Cancel any pending prompt
    if (session.abortController) {
      session.abortController.abort();
    }

    session.abortController = new AbortController();

    let allowAlways = false;

    try {
      const userMessage = {
        type: "user",
        message: {
          role: "user",
          content: [] as SDKUserMessage["message"]["content"],
        },
      };
      const textMessagePieces: string[] = [];
      let imageIdx = 0;
      for (const block of params.prompt) {
          if (block.type === "text") {
            textMessagePieces.push(block.text);
          }
          if (block.type === "image") {
            imageIdx++;
            textMessagePieces.push(`[Image #${imageIdx}]`);
            userMessage.message.content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: block.mimeType,
                data: block.data,
              }
            });
          }
          let uri;
          if (block.type === "resource") {
            uri = block.resource.uri;
          }
          if (block.type === "resource_link") {
            uri = block.uri;
          }
          if (uri) {
            if (uri.startsWith("file://")) {
              const filePath = uri.substring(7);
              textMessagePieces.push("@" + filePath);
            } else {
              textMessagePieces.push(uri);
            }
          }
      }

      const promptText = textMessagePieces.join("");
      if (promptText) {
        userMessage.message.content.push({
          type: "text",
          text: promptText,
        });
      }

      if (!session.claudeSessionId) {
        this.log("First message for this session, no resume");
      } else {
        this.log(`Resuming Claude session: ${session.claudeSessionId}`);
      }

      // Check for permission mode hints in the prompt
      let permissionMode = session.permissionMode || this.defaultPermissionMode;

      // Allow dynamic permission mode switching via special commands
      if (promptText.includes("[ACP:PERMISSION:ACCEPT_EDITS]")) {
        permissionMode = "acceptEdits";
        session.permissionMode = "acceptEdits";
      } else if (promptText.includes("[ACP:PERMISSION:BYPASS]")) {
        permissionMode = "bypassPermissions";
        session.permissionMode = "bypassPermissions";
      } else if (promptText.includes("[ACP:PERMISSION:DEFAULT]")) {
        permissionMode = "default";
        session.permissionMode = "default";
      }

      this.log(`Using permission mode: ${permissionMode}`);

      // Start Claude query
      const messages = query({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prompt: toAsyncIterable([userMessage]) as any,
        options: {
          permissionMode,
          pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
          // Resume if we have a Claude session_id
          resume: session.claudeSessionId || undefined,
          canUseTool: async (toolName: string, input: Record<string, unknown>) => {
            if (allowAlways) {
              return { behavior: 'allow', updatedInput: input };
            }

            const toolCallId = session.toolCallIds.get(toolName);
            const permissionOptions: RequestPermissionRequest['options'] = [
              {
                optionId: 'allow_always',
                name: 'Allow Always',
                kind: 'allow_always',
              },
              {
                optionId: 'allow_once',
                name: 'Allow',
                kind: 'allow_once',
              },
              {
                optionId: 'reject',
                name: 'Reject',
                kind: 'reject_once',
              }
            ];
            const requestPermissionParams: RequestPermissionRequest = {
              sessionId: params.sessionId,
              options: permissionOptions,
              toolCall: {
                toolCallId: toolCallId || '',
              },
            };

            const output = await this.client.requestPermission(requestPermissionParams);

            if (output.outcome.outcome === 'cancelled') {
              return { behavior: 'deny', message: 'User cancelled' };
            }

            if (output.outcome.optionId === 'allow_always') {
              allowAlways = true;
            }

            return { behavior: 'allow', updatedInput: input };
          },
        },
      });

      session.pendingPrompt = messages as AsyncIterableIterator<SDKMessage>;

      // Process messages and send updates
      let messageCount = 0;

      for await (const message of messages) {
        if (session.abortController?.signal.aborted) {
          return { stopReason: "cancelled" };
        }

        messageCount++;
        this.log(
          `Processing message #${messageCount} of type: ${(message as SDKMessage).type}`,
        );

        // Extract and store Claude's session_id from any message that has it
        const sdkMessage = message as SDKMessage;
        this.tryToStoreClaudeSessionId(currentSessionId, sdkMessage);

        // Log message type and content for debugging
        if (sdkMessage.type === "user") {
          this.log(`Processing user message`);
        } else if (sdkMessage.type === "assistant") {
          this.log(`Processing assistant message`);
          // Log assistant message content for debugging
          if ("message" in sdkMessage && sdkMessage.message) {
            const assistantMsg = sdkMessage.message as {
              content?: Array<{ type: string; text?: string }>;
            };
            if (assistantMsg.content) {
              this.log(
                `Assistant content: ${JSON.stringify(assistantMsg.content).substring(0, 200)}`,
              );
            }
          }
        }

        await this.handleClaudeMessage(
          currentSessionId,
          message as ClaudeMessage,
        );
      }

      this.log(`Processed ${messageCount} messages total`);
      this.log(`Final Claude session_id: ${session.claudeSessionId}`);
      session.pendingPrompt = null;

      // Ensure the session is properly saved with the Claude session_id
      this.sessions.set(currentSessionId, session);

      return {
        stopReason: "end_turn",
      };
    } catch (error) {
      this.log("Error during prompt processing:", error);

      if (session.abortController?.signal.aborted) {
        return { stopReason: "cancelled" };
      }

      // Send error to client
      await this.client.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        },
      });

      return {
        stopReason: "end_turn",
      };
    } finally {
      session.pendingPrompt = null;
      session.abortController = null;
    }
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.log(`Cancel requested for session: ${params.sessionId}`);

    const session = this.sessions.get(params.sessionId);
    if (session) {
      session.abortController?.abort();

      if (session.pendingPrompt && session.pendingPrompt.return) {
        await session.pendingPrompt.return();
        session.pendingPrompt = null;
      }
    }
  }

  private async sendAgentPlan(sessionId: string, todos: ClaudeTodoList): Promise<void> {
    // The status and priority of ACP plan entry can directly correspond to the status and priority in claude-code todo, just need to remove the todo id.
    const planEntries = todos.map((todo) => {
      return {
        content: todo.content,
        status: todo.status,
        priority: todo.priority ?? "low",
      };
    });
    await this.client.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: "plan",
        entries: planEntries,
      },
    });
  }

  private async handleClaudeMessage(
    sessionId: string,
    message: ClaudeMessage | SDKMessage,
  ): Promise<void> {
    // Use a more flexible type handling approach
    const msg = message as ClaudeMessage;
    const messageType = "type" in message ? message.type : undefined;
    this.log(
      `Handling message type: ${messageType}`,
      JSON.stringify(message).substring(0, 200),
    );

    const session = this.sessions.get(sessionId);

    switch (messageType) {
      case "system":
        // System messages are internal, don't send to client
        break;

      case "user":
        // Handle user message that may contain tool results
        if (msg.message && msg.message.content) {
          for (const content of msg.message.content) {
            if (content.type === "tool_result") {
              this.log(`Tool result received for: ${content.tool_use_id}`);

              if (content.tool_use_id && session?.todoWriteToolCallIds.has(content.tool_use_id)) {
                continue;
              }

              const newContent: ACPToolCallRegularContent = {
                type: "content",
                content: {
                  type: "text",
                  text: (content.content || "") + "\n",
                },
              }

              const prevToolCallContent = session?.toolCallContents.get(content.tool_use_id || "") || [];
              const toolCallContent = [...prevToolCallContent, newContent];
              session?.toolCallContents.set(content.tool_use_id || "", toolCallContent);

              // Send tool_call_update with completed status
              await this.client.sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "tool_call_update",
                  toolCallId: content.tool_use_id || "",
                  status: "completed",
                  content: toolCallContent,
                  rawOutput: content.content ? { output: content.content } : undefined,
                },
              });
            }
          }
        }
        break;

      case "assistant":
        // Handle assistant message from Claude
        if (msg.message && msg.message.content) {
          for (const content of msg.message.content) {
            if (content.type === "text") {
              // Send text content without adding extra newlines
              // Claude already formats the text properly
              await this.client.sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: {
                    type: "text",
                    text: content.text || "",
                  },
                },
              });
            } else if (content.type === "tool_use") {
              // Handle tool_use blocks in assistant messages
              this.log(
                `Tool use block in assistant message: ${content.name}, id: ${content.id}`,
              );

              session?.toolCallIds.set(content.name, content.id);
              if (content.name === "TodoWrite" && content.input?.todos) {
                session?.todoWriteToolCallIds.add(content.id || "");
                const todos = content.input.todos as ClaudeTodoList;
                await this.sendAgentPlan(sessionId, todos);
              } else {
                const toolCallContent = this.getToolCallContent(content.name || "", content.input as Record<string, unknown>);
                session?.toolCallContents.set(content.id || "", toolCallContent);
                // Send tool_call notification to client
                await this.client.sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call",
                    toolCallId: content.id || "",
                    title: content.name || "Tool",
                    kind: this.mapToolKind(content.name || ""),
                    status: "pending",
                    content: toolCallContent,
                    rawInput: content.input as Record<string, unknown>,
                  },
                });
              }
            }
          }
        } else if ("text" in msg && typeof msg.text === "string") {
          // Handle direct text in assistant message
          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: {
                type: "text",
                text: msg.text,
              },
            },
          });
        }
        break;

      case "result":
        // Result message indicates completion
        this.log("Query completed with result:", msg.result);
        break;

      case "text":
        // Direct text messages - preserve formatting without extra newlines
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: msg.text || "",
            },
          },
        });
        break;

      case "tool_use_start": {
        // Log the tool call details for debugging
        this.log(`Tool call started: ${msg.tool_name}`, `ID: ${msg.id}`);

        // Handle tool input - ensure it's a proper object
        const input = msg.input || {};

        // Log the input for debugging
        if (this.DEBUG) {
          try {
            this.log(`Tool input:`, JSON.stringify(input, null, 2));

            // Special logging for content field
            if (input && typeof input === "object" && "content" in input) {
              const content = (input as Record<string, unknown>).content;
              if (typeof content === "string") {
                const preview = content.substring(0, 100);
                this.log(
                  `Content preview: ${preview}${content.length > 100 ? "..." : ""}`,
                );
              }
            }
          } catch (e) {
            this.log("Error logging input:", e);
          }
        }

        if (
          msg.tool_name === "TodoWrite" &&
          input &&
          typeof input === "object" &&
          "todos" in input
        ) {
          const todos = (
            input as {
              todos: ClaudeTodoList;
            }
          ).todos;
          if (todos && Array.isArray(todos)) {
            session?.todoWriteToolCallIds.add(msg.id || "");
            await this.sendAgentPlan(sessionId, todos);
          }
        } else {
          const toolCallContent = this.getToolCallContent(msg.tool_name || "", input as Record<string, unknown>);
          session?.toolCallContents.set(msg.id || "", toolCallContent);

          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: "tool_call",
              toolCallId: msg.id || "",
              title: msg.tool_name || "Tool",
              kind: this.mapToolKind(msg.tool_name || ""),
              status: "pending",
              content: toolCallContent,
              // Pass the input directly without extra processing
              rawInput: input as Record<string, unknown>,
            },
          });
        }
        break;
      }

      case "tool_use_output": {
        const outputText = msg.output || "";

        // Log the tool output for debugging
        this.log(`Tool call completed: ${msg.id}`);
        this.log(`Tool output length: ${outputText.length} characters`);

        if (msg.id && session?.todoWriteToolCallIds.has(msg.id)) {
          break;
        }

        const newContent: ACPToolCallRegularContent = {
          type: "content",
          content: {
            type: "text",
            text: outputText,
          },
        }
        const prevToolCallContent = session?.toolCallContents.get(msg.id || "") || [];
        const toolCallContent = [...prevToolCallContent, newContent];
        session?.toolCallContents.set(msg.id || "", toolCallContent);

        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: msg.id || "",
            status: "completed",
            content: toolCallContent,
            // Pass output directly without extra wrapping
            rawOutput: msg.output ? { output: outputText } : undefined,
          },
        });
        break;
      }

      case "tool_use_error":
        await this.client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: msg.id || "",
            status: "failed",
            content: [
              {
                type: "content",
                content: {
                  type: "text",
                  text: `Error: ${msg.error}`,
                },
              },
            ],
            rawOutput: { error: msg.error },
          },
        });
        break;

      case "stream_event": {
        // Handle stream events if needed
        const event = msg.event as ClaudeStreamEvent;
        if (
          event.type === "content_block_start" &&
          event.content_block?.type === "text"
        ) {
          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: {
                type: "text",
                text: event.content_block.text || "",
              },
            },
          });
        } else if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          await this.client.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: {
                type: "text",
                text: event.delta.text || "",
              },
            },
          });
        } else if (event.type === "content_block_stop") {
          // Content block ended - Claude handles its own formatting
          this.log("Content block stopped");
        }
        break;
      }

      default:
        this.log(
          `Unhandled message type: ${messageType}`,
          JSON.stringify(message).substring(0, 500),
        );
    }
  }

  private mapToolKind(
    toolName: string,
  ):
    | "read"
    | "edit"
    | "delete"
    | "move"
    | "search"
    | "execute"
    | "think"
    | "fetch"
    | "other" {
    const lowerName = toolName.toLowerCase();

    if (
      lowerName.includes("read") ||
      lowerName.includes("view") ||
      lowerName.includes("get")
    ) {
      return "read";
    } else if (
      lowerName.includes("write") ||
      lowerName.includes("create") ||
      lowerName.includes("update") ||
      lowerName.includes("edit")
    ) {
      return "edit";
    } else if (lowerName.includes("delete") || lowerName.includes("remove")) {
      return "delete";
    } else if (lowerName.includes("move") || lowerName.includes("rename")) {
      return "move";
    } else if (
      lowerName.includes("search") ||
      lowerName.includes("find") ||
      lowerName.includes("grep")
    ) {
      return "search";
    } else if (
      lowerName.includes("run") ||
      lowerName.includes("execute") ||
      lowerName.includes("bash")
    ) {
      return "execute";
    } else if (lowerName.includes("think") || lowerName.includes("plan")) {
      return "think";
    } else if (lowerName.includes("fetch") || lowerName.includes("download")) {
      return "fetch";
    } else {
      return "other";
    }
  }

  private getToolCallContent(toolName: string, toolInput: Record<string, unknown>): ACPToolCallContent[] {
    const result: ACPToolCallContent[] = [];
    switch (toolName) {
      case "Edit": {
        if (toolInput.file_path && toolInput.old_string && toolInput.new_string) {
          result.push({
            type: "diff",
            path: toolInput.file_path as string,
            oldText: toolInput.old_string as string,
            newText: toolInput.new_string as string,
          });
        }
        break;
      };
      case "MultiEdit": {
        if (toolInput.file_path && toolInput.edits) {
          for (const edit of toolInput.edits as Array<{
            old_string: string;
            new_string: string;
          }>) {
            result.push({
              type: "diff",
              path: toolInput.file_path as string,
              oldText: edit.old_string as string,
              newText: edit.new_string as string,
            });
          }
        }
      };
    };
    return result;
  }

  private tryToStoreClaudeSessionId(sessionId: string, sdkMessage: SDKMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (
      "session_id" in sdkMessage &&
      typeof sdkMessage.session_id === "string" &&
    sdkMessage.session_id
    ) {
      if (session.claudeSessionId !== sdkMessage.session_id) {
        this.log(
          `Updating Claude session_id from ${session.claudeSessionId} to ${sdkMessage.session_id}`,
        );
        session.claudeSessionId = sdkMessage.session_id;
        return sdkMessage.session_id;
      }
    }
  }
}
