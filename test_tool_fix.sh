#!/bin/bash

set -e

echo "Testing ACP tool call fix..."

INPUT_PIPE=$(mktemp -u)
OUTPUT_FILE=$(mktemp)

# Create named pipe
mkfifo "$INPUT_PIPE"

# Start ACP server
ACP_DEBUG=true node dist/cli.js < "$INPUT_PIPE" > "$OUTPUT_FILE" 2>&1 &
PID=$!

echo "Started acp-claude-code with PID: $PID"

sleep 1
if ! kill -0 $PID 2>/dev/null; then
    echo "Error: Failed to start"
    cat "$OUTPUT_FILE"
    rm -f "$INPUT_PIPE" "$OUTPUT_FILE"
    exit 1
fi

# Send requests
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}' > "$INPUT_PIPE"
sleep 2

CWD=$(pwd)
echo '{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"'$CWD'","mcpServers":[]}}' > "$INPUT_PIPE"
sleep 2

# Extract session ID
SESSION_ID=$(grep -o '"sessionId":"[^"]*"' "$OUTPUT_FILE" | tail -1 | cut -d'"' -f4)
echo "Session ID: $SESSION_ID"

if [ -n "$SESSION_ID" ]; then
    # Send prompt that triggers tool use
    echo '{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"'$SESSION_ID'","prompt":[{"type":"text","text":"Please read the package.json file"}]}}' > "$INPUT_PIPE"
    
    # Wait for tool execution
    sleep 8
    
    echo ""
    echo "=== Checking for tool_call notifications ==="
    grep -E '"sessionUpdate":"tool_call"' "$OUTPUT_FILE" | head -3 || echo "No tool_call found"
    
    echo ""
    echo "=== Checking for tool_call_update notifications ==="
    grep -E '"sessionUpdate":"tool_call_update"' "$OUTPUT_FILE" | head -3 || echo "No tool_call_update found"
fi

# Cleanup
kill $PID 2>/dev/null || true
sleep 1
kill -9 $PID 2>/dev/null || true
rm -f "$INPUT_PIPE" "$OUTPUT_FILE"

echo ""
echo "Test completed!"