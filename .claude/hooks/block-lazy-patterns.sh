#!/bin/bash
# Hook: Block lazy patterns in code files written by Claude
# Runs as PreToolUse hook on Edit|Write for code files (.ts, .tsx, .js, .jsx)
# Exit 0 = allow, Exit 2 = block with message on stderr

# Only check code files
case "$CLAUDE_FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    ;;
  *)
    exit 0
    ;;
esac

# Read tool input from stdin
INPUT=$(cat)

# Extract the new content being written
# For Edit: new_string field; For Write: content field
NEW_CONTENT=$(echo "$INPUT" | jq -r '.new_string // .content // ""' 2>/dev/null)

if [ -z "$NEW_CONTENT" ]; then
  exit 0
fi

# Block TODO/FIXME/HACK/XXX comments being added
# Match: // TODO, /* TODO, // FIXME, etc. (with optional colon)
if echo "$NEW_CONTENT" | grep -qE '(//|/\*|\*)\s*(TODO|FIXME|HACK|XXX)\b'; then
  echo "BLOCK: You are adding a TODO/FIXME/HACK comment to code. This is banned." >&2
  echo "Either implement the functionality fully or tell the user what you cannot do and why." >&2
  exit 2
fi

# Block deferral comments in code
if echo "$NEW_CONTENT" | grep -qiE '//\s*(for now|temporary|will (fix|handle|implement|add|do)|handle later|placeholder|stub|out of scope|come back to)'; then
  echo "BLOCK: You are adding a deferral comment (for now, temporary, will fix later, placeholder, etc)." >&2
  echo "Do the work now or explain to the user why you cannot." >&2
  exit 2
fi

# Block empty/stub function implementations
if echo "$NEW_CONTENT" | grep -qE '(throw new Error\(.not implemented.\)|throw new Error\(.TODO.\))'; then
  echo "BLOCK: You are writing a stub/unimplemented function. Implement it fully." >&2
  exit 2
fi

exit 0
